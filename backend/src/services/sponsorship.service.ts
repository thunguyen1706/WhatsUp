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
  static async createDonation(userId: string, data: {
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
   * Get event sponsors (public)
   */
  static async getEventSponsors(eventId: string, tier?: string, limit?: number) {
    let queryStr = `
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
    `;
    
    const params: any[] = [eventId];
    
    if (tier) {
      queryStr += ` AND st.name = $${params.length + 1}`;
      params.push(tier);
    }
    
    queryStr += ` ORDER BY s.amount_cents DESC`;
    
    if (limit) {
      queryStr += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }

    const result = await query(queryStr, params);
    return result.rows;
  }

  /**
   * Get my sponsorships with filtering and pagination
   */
  static async getMySponsorships(
    userId: string,
    status?: string,
    page?: number,
    limit?: number
  ) {
    let queryStr = `
      SELECT 
        s.*,
        st.name as tier_name,
        e.name as event_name,
        e.start_date as event_date,
        e.end_date as event_end_date
      FROM sponsorships s
      LEFT JOIN sponsorship_tiers st ON s.tier_id = st.id
      JOIN events e ON s.event_id = e.id
      WHERE s.user_id = $1
    `;
    
    const params: any[] = [userId];
    let paramCount = 1;
    
    if (status) {
      queryStr += ` AND s.status = $${++paramCount}`;
      params.push(status);
    }
    
    queryStr += ` ORDER BY s.created_at DESC`;
    
    if (page && limit) {
      const offset = (page - 1) * limit;
      queryStr += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      params.push(limit, offset);
    } else if (limit) {
      queryStr += ` LIMIT $${++paramCount}`;
      params.push(limit);
    }

    const result = await query(queryStr, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM sponsorships s
      WHERE s.user_id = $1
    `;
    const countParams = [userId];
    
    if (status) {
      countQuery += ` AND s.status = $2`;
      countParams.push(status);
    }
    
    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    return {
      sponsorships: result.rows,
      pagination: {
        total,
        page: page || 1,
        limit: limit || total,
        pages: limit ? Math.ceil(total / limit) : 1
      }
    };
  }

  /**
   * Get event sponsorship details with analytics
   */
  static async getEventSponsorshipDetails(
    eventId: string,
    userId: string,
    userRole: string,
    filters?: {
      start_date?: any;
      end_date?: any;
    }
  ) {
    // Check if user has access (organizer or sponsor of this event)
    const isOrganizer = await EventRolesService.hasEventRole(userId, eventId, ['ORGANIZER', 'CO_ORGANIZER']);
    const isSponsor = await query(
      'SELECT 1 FROM sponsorships WHERE event_id = $1 AND user_id = $2 AND status = $3 LIMIT 1',
      [eventId, userId, 'CONFIRMED']
    );
    const isAdmin = userRole === 'ADMIN';
    
    if (!isOrganizer && isSponsor.rows.length === 0 && !isAdmin) {
      throw new AppError('Access denied', 403);
    }

    let queryStr = `
      SELECT 
        s.*,
        st.name as tier_name,
        u.name as sponsor_name,
        u.email as sponsor_email
      FROM sponsorships s
      LEFT JOIN sponsorship_tiers st ON s.tier_id = st.id
      JOIN users u ON s.user_id = u.id
      WHERE s.event_id = $1
    `;
    
    const params = [eventId];
    let paramCount = 1;
    
    if (filters?.start_date) {
      queryStr += ` AND s.created_at >= $${++paramCount}`;
      params.push(filters.start_date);
    }
    
    if (filters?.end_date) {
      queryStr += ` AND s.created_at <= $${++paramCount}`;
      params.push(filters.end_date);
    }
    
    queryStr += ` ORDER BY s.created_at DESC`;

    const sponsorships = await query(queryStr, params);

    // Get summary stats
    const statsQuery = `
      SELECT 
        COUNT(*) as total_sponsorships,
        COUNT(*) FILTER (WHERE type = 'SPONSORSHIP') as total_sponsors,
        COUNT(*) FILTER (WHERE type = 'DONATION') as total_donations,
        COUNT(*) FILTER (WHERE status = 'CONFIRMED') as confirmed_count,
        COUNT(*) FILTER (WHERE status = 'PENDING') as pending_count,
        SUM(CASE WHEN status = 'CONFIRMED' THEN amount_cents ELSE 0 END) as total_raised,
        AVG(CASE WHEN status = 'CONFIRMED' THEN amount_cents ELSE NULL END) as avg_amount
      FROM sponsorships
      WHERE event_id = $1
      ${filters?.start_date ? 'AND created_at >= $2' : ''}
      ${filters?.end_date ? 'AND created_at <= $3' : ''}
    `;
    
    const statsParams = [eventId];
    if (filters?.start_date) statsParams.push(filters.start_date);
    if (filters?.end_date) statsParams.push(filters.end_date);
    
    const stats = await query(statsQuery, statsParams);

    return {
      sponsorships: sponsorships.rows,
      stats: stats.rows[0]
    };
  }

  /**
   * Cancel sponsorship (before payment confirmation)
   */
  static async cancelSponsorship(sponsorshipId: string, userId: string) {
    // Check if user owns this sponsorship and it's still pending
    const sponsorship = await query(
      'SELECT user_id, status, payment_intent_id FROM sponsorships WHERE id = $1',
      [sponsorshipId]
    );

    if (sponsorship.rows.length === 0) {
      throw new AppError('Sponsorship not found', 404);
    }

    if (sponsorship.rows[0].user_id !== userId) {
      throw new AppError('Access denied', 403);
    }

    if (sponsorship.rows[0].status !== 'PENDING') {
      throw new AppError('Cannot cancel confirmed sponsorship', 400);
    }

    // Cancel payment intent if exists
    if (sponsorship.rows[0].payment_intent_id) {
      await StripeService.cancelPaymentIntent(sponsorship.rows[0].payment_intent_id);
    }

    // Update status to cancelled
    await query(
      'UPDATE sponsorships SET status = $1 WHERE id = $2',
      ['CANCELLED', sponsorshipId]
    );

    return { success: true };
  }

  /**
   * Send thank you messages to sponsors
   */
  static async sendThankYouMessages(
    eventId: string,
    userId: string,
    userRole: string,
    message: string,
    subject?: string
  ) {
    // Check if user is organizer
    const isOrganizer = await EventRolesService.hasEventRole(userId, eventId, ['ORGANIZER', 'CO_ORGANIZER']);
    if (!isOrganizer && userRole !== 'ADMIN') {
      throw new AppError('Only organizers can send thank you messages', 403);
    }

    // Get all confirmed sponsors for the event
    const sponsors = await query(`
      SELECT 
        s.id as sponsorship_id,
        s.amount_cents,
        s.type,
        s.company_name,
        u.id as user_id,
        u.name as sponsor_name,
        u.email as sponsor_email
      FROM sponsorships s
      JOIN users u ON s.user_id = u.id
      WHERE s.event_id = $1 AND s.status = 'CONFIRMED' AND s.is_anonymous = false
    `, [eventId]);

    if (sponsors.rows.length === 0) {
      throw new AppError('No sponsors found to send messages to', 400);
    }

    // Get event details for context
    const event = await query('SELECT name, start_date FROM events WHERE id = $1', [eventId]);
    const eventName = event.rows[0]?.name || 'Event';

    const results = [];
    
    // Send individual thank you messages
    for (const sponsor of sponsors.rows) {
      try {
        // Here you would integrate with your email service
        // For now, we'll just log the message being sent
        const personalizedMessage = message
          .replace('{sponsor_name}', sponsor.sponsor_name)
          .replace('{company_name}', sponsor.company_name || sponsor.sponsor_name)
          .replace('{event_name}', eventName)
          .replace('{amount}', `${(sponsor.amount_cents / 100).toFixed(2)}`);

        // Log the thank you message (replace with actual email service)
        console.log(`Sending thank you to ${sponsor.sponsor_email}:`, {
          subject: subject || `Thank you for sponsoring ${eventName}!`,
          message: personalizedMessage
        });

        results.push({
          sponsorship_id: sponsor.sponsorship_id,
          sponsor_name: sponsor.sponsor_name,
          status: 'sent'
        });
      } catch (error) {
        results.push({
          sponsorship_id: sponsor.sponsorship_id,
          sponsor_name: sponsor.sponsor_name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      total_recipients: sponsors.rows.length,
      successful: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      results
    };
  }
}