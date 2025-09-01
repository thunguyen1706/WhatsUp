import { query } from '../db.js';
import { AppError } from '../middleware/error.middleware.js';
import { StripeService } from './stripe.service.js';
import { EventRolesService } from './eventRoles.service.js';

export class SponsorshipService {
  /**
   * Create sponsorship tier (organizers only)
   */
  static async createSponsorshipTier(eventId: string, userId: string, data: {
    name: string;
    description?: string;
    amount_cents: number;
    perks?: any[];
    max_sponsors?: number;
    display_order?: number;
  }) {
    // Check if user is organizer
    const isOrganizer = await EventRolesService.hasEventRole(userId, eventId, ['ORGANIZER', 'CO_ORGANIZER']);
    if (!isOrganizer) {
      throw new AppError('Only organizers can create sponsorship tiers', 403);
    }

    const result = await query(`
      INSERT INTO sponsorship_tiers (
        event_id, name, description, amount_cents, perks, max_sponsors, display_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      eventId,
      data.name,
      data.description,
      data.amount_cents,
      JSON.stringify(data.perks || []),
      data.max_sponsors,
      data.display_order || 0
    ]);

    return result.rows[0];
  }

  /**
   * Get sponsorship tiers for an event
   */
  static async getSponsorshipTiers(eventId: string) {
    const result = await query(`
      SELECT 
        st.*,
        (st.max_sponsors - st.current_sponsors) as available_slots
      FROM sponsorship_tiers st
      WHERE st.event_id = $1
      ORDER BY st.display_order, st.amount_cents DESC
    `, [eventId]);

    return result.rows;
  }

  /**
   * Create sponsorship/donation
   */
  static async createSponsorship(userId: string, data: {
    event_id: string;
    tier_id?: string;
    amount_cents: number;
    type: 'DONATION' | 'SPONSORSHIP';
    message?: string;
    company_name?: string;
    company_logo?: string;
    is_anonymous?: boolean;
  }) {
    // Check if event accepts sponsorships
    const event = await query(
      'SELECT allow_sponsorships, allow_donations FROM events WHERE id = $1 AND status = $2',
      [data.event_id, 'PUBLISHED']
    );

    if (event.rows.length === 0) {
      throw new AppError('Event not found', 404);
    }

    const eventData = event.rows[0];
    
    if (data.type === 'SPONSORSHIP' && !eventData.allow_sponsorships) {
      throw new AppError('Event is not accepting sponsorships', 400);
    }
    
    if (data.type === 'DONATION' && !eventData.allow_donations) {
      throw new AppError('Event is not accepting donations', 400);
    }

    // If tier is specified, check availability
    if (data.tier_id) {
      const tier = await query(
        'SELECT max_sponsors, current_sponsors FROM sponsorship_tiers WHERE id = $1',
        [data.tier_id]
      );

      if (tier.rows.length > 0 && tier.rows[0].max_sponsors) {
        if (tier.rows[0].current_sponsors >= tier.rows[0].max_sponsors) {
          throw new AppError('This sponsorship tier is full', 400);
        }
      }
    }

    // Create sponsorship record
    const sponsorship = await query(`
      INSERT INTO sponsorships (
        event_id, user_id, tier_id, amount_cents, type, 
        message, company_name, company_logo, is_anonymous, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')
      RETURNING *
    `, [
      data.event_id,
      userId,
      data.tier_id,
      data.amount_cents,
      data.type,
      data.message,
      data.company_name,
      data.company_logo,
      data.is_anonymous || false
    ]);

    // Create payment intent
    const payment = await StripeService.createSponsorshipPaymentIntent(
      userId,
      data.event_id,
      data.amount_cents / 100,
      data.message
    );

    // Update with payment intent ID
    await query(
      'UPDATE sponsorships SET payment_intent_id = $1 WHERE id = $2',
      [payment.paymentIntentId, sponsorship.rows[0].id]
    );

    return {
      sponsorship: sponsorship.rows[0],
      clientSecret: payment.clientSecret
    };
  }

  /**
   * Confirm sponsorship (webhook)
   */
  static async confirmSponsorship(paymentIntentId: string) {
    const result = await query(
      'UPDATE sponsorships SET status = $1 WHERE payment_intent_id = $2 RETURNING *',
      ['CONFIRMED', paymentIntentId]
    );

    if (result.rows.length > 0) {
      const sponsorship = result.rows[0];
      
      // Update tier count if applicable
      if (sponsorship.tier_id) {
        await query(
          'UPDATE sponsorship_tiers SET current_sponsors = current_sponsors + 1 WHERE id = $1',
          [sponsorship.tier_id]
        );
      }

      // Add SPONSOR role to user for this event
      await EventRolesService.assignEventRole(sponsorship.event_id, sponsorship.user_id, 'SPONSOR');
    }

    return result.rows[0];
  }

  /**
   * Get event sponsors (public)
   */
  static async getEventSponsors(eventId: string) {
    const result = await query(`
      SELECT 
        s.amount_cents,
        s.type,
        s.message,
        s.company_name,
        s.company_logo,
        s.is_anonymous,
        s.created_at,
        st.name as tier_name,
        CASE WHEN s.is_anonymous THEN 'Anonymous' ELSE u.name END as sponsor_name
      FROM sponsorships s
      LEFT JOIN sponsorship_tiers st ON s.tier_id = st.id
      JOIN users u ON s.user_id = u.id
      WHERE s.event_id = $1 AND s.status = 'CONFIRMED'
      ORDER BY s.amount_cents DESC
    `, [eventId]);

    return result.rows;
  }

  /**
   * Get sponsorship dashboard (organizers only)
   */
  static async getSponsorshipDashboard(eventId: string, userId: string) {
    // Check if user is organizer
    const isOrganizer = await EventRolesService.hasEventRole(userId, eventId, ['ORGANIZER', 'CO_ORGANIZER']);
    if (!isOrganizer) {
      throw new AppError('Access denied', 403);
    }

    const sponsors = await query(`
      SELECT 
        s.*,
        u.name as sponsor_name,
        u.email as sponsor_email,
        st.name as tier_name
      FROM sponsorships s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN sponsorship_tiers st ON s.tier_id = st.id
      WHERE s.event_id = $1
      ORDER BY s.created_at DESC
    `, [eventId]);

    const stats = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE type = 'SPONSORSHIP') as total_sponsors,
        COUNT(*) FILTER (WHERE type = 'DONATION') as total_donors,
        SUM(CASE WHEN status = 'CONFIRMED' THEN amount_cents ELSE 0 END) as total_raised,
        AVG(CASE WHEN status = 'CONFIRMED' THEN amount_cents ELSE NULL END) as avg_amount
      FROM sponsorships
      WHERE event_id = $1
    `, [eventId]);

    const tierStats = await query(`
      SELECT 
        st.name,
        st.amount_cents,
        st.max_sponsors,
        st.current_sponsors,
        COUNT(s.id) as actual_sponsors,
        SUM(CASE WHEN s.status = 'CONFIRMED' THEN s.amount_cents ELSE 0 END) as tier_revenue
      FROM sponsorship_tiers st
      LEFT JOIN sponsorships s ON st.id = s.tier_id AND s.status = 'CONFIRMED'
      WHERE st.event_id = $1
      GROUP BY st.id
      ORDER BY st.display_order
    `, [eventId]);

    return {
      sponsors: sponsors.rows,
      stats: stats.rows[0],
      tierStats: tierStats.rows
    };
  }
}