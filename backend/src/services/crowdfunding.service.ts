import { query } from '../db.js';
import { AppError } from '../middleware/error.middleware.js';
import { EventsService } from './events.service.js';

export class CrowdfundingService {
    /**
     * Create crowdfunding contribution
     */
    static async createContribution(
      userId: string, 
      eventId: string, 
      amountCents: number, 
      message?: string, 
      isAnonymous: boolean = false
    ) {
      // Check if event accepts crowdfunding
      const event = await query(
        'SELECT funding_goal_cents, funding_deadline, min_funding_cents, allow_donations FROM events WHERE id = $1 AND status = $2',
        [eventId, 'PUBLISHED']
      );
  
      if (event.rows.length === 0) {
        throw new AppError('Event not found or not accepting contributions', 404);
      }
  
      const eventData = event.rows[0];
  
      if (!eventData.allow_donations) {
        throw new AppError('This event is not accepting donations', 400);
      }
  
      // Check if funding deadline has passed
      if (eventData.funding_deadline && new Date(eventData.funding_deadline) < new Date()) {
        throw new AppError('Funding deadline has passed', 400);
      }
  
      // Check minimum contribution
      if (eventData.min_funding_cents && amountCents < eventData.min_funding_cents) {
        throw new AppError(`Minimum contribution is $${eventData.min_funding_cents / 100}`, 400);
      }
  
      // Create contribution record
      const contribution = await query(`
        INSERT INTO crowdfunding_contributions (
          event_id, user_id, amount_cents, message, is_anonymous, status
        ) VALUES ($1, $2, $3, $4, $5, 'PENDING')
        RETURNING *
      `, [eventId, userId, amountCents, message, isAnonymous]);
  
      // For now, return without payment intent - implement StripeService later
      return {
        contribution: contribution.rows[0],
        clientSecret: null // Will be populated when StripeService is implemented
      };
    }
  
    /**
     * Get crowdfunding progress for an event
     */
    static async getCrowdfundingProgress(eventId: string) {
      const event = await query(
        'SELECT funding_goal_cents, funding_deadline, min_funding_cents FROM events WHERE id = $1',
        [eventId]
      );
  
      if (event.rows.length === 0) {
        throw new AppError('Event not found', 404);
      }
  
      const eventData = event.rows[0];
  
      const contributions = await query(`
        SELECT 
          COUNT(*) as total_contributors,
          SUM(CASE WHEN status = 'CONFIRMED' THEN amount_cents ELSE 0 END) as total_raised,
          COUNT(*) FILTER (WHERE status = 'CONFIRMED') as confirmed_contributions
        FROM crowdfunding_contributions
        WHERE event_id = $1
      `, [eventId]);
  
      const recentContributors = await query(`
        SELECT 
          cc.amount_cents,
          cc.message,
          cc.is_anonymous,
          cc.created_at,
          CASE WHEN cc.is_anonymous THEN 'Anonymous' ELSE u.name END as contributor_name
        FROM crowdfunding_contributions cc
        JOIN users u ON cc.user_id = u.id
        WHERE cc.event_id = $1 AND cc.status = 'CONFIRMED'
        ORDER BY cc.created_at DESC
        LIMIT 10
      `, [eventId]);
  
      const stats = contributions.rows[0];
      const totalRaised = parseInt(stats.total_raised || 0);
      const progress = eventData.funding_goal_cents > 0 
        ? (totalRaised / eventData.funding_goal_cents) * 100 
        : 0;
  
      return {
        goal: eventData.funding_goal_cents,
        raised: totalRaised,
        progress: Math.min(progress, 100),
        contributors: parseInt(stats.total_contributors || 0),
        deadline: eventData.funding_deadline,
        minimumContribution: eventData.min_funding_cents,
        recentContributors: recentContributors.rows,
        isComplete: progress >= 100
      };
    }
  
    /**
     * Get user's contributions to an event
     */
    static async getUserContributions(userId: string, eventId?: string) {
      let whereClause = 'WHERE cc.user_id = $1';
      const params = [userId];
  
      if (eventId) {
        whereClause += ' AND cc.event_id = $2';
        params.push(eventId);
      }
  
      const result = await query(`
        SELECT 
          cc.*,
          e.title as event_title,
          e.starts_at as event_date
        FROM crowdfunding_contributions cc
        JOIN events e ON cc.event_id = e.id
        ${whereClause}
        ORDER BY cc.created_at DESC
      `, params);
  
      return result.rows;
    }
  
    /**
     * Confirm contribution (webhook handler)
     */
    static async confirmContribution(paymentIntentId: string) {
      const result = await query(
        'UPDATE crowdfunding_contributions SET status = $1 WHERE payment_intent_id = $2 RETURNING *',
        ['CONFIRMED', paymentIntentId]
      );
  
      if (result.rows.length > 0) {
        const contribution = result.rows[0];
        
        // Check if funding goal is reached
        await this.checkFundingGoal(contribution.event_id);
        
        // Record interaction
        await EventsService.recordInteraction(
          contribution.event_id, 
          contribution.user_id, 
          'donate',
          { amount: contribution.amount_cents }
        );
      }
  
      return result.rows[0];
    }
  
    /**
     * Check if funding goal is reached and notify
     */
    private static async checkFundingGoal(eventId: string) {
      const progress = await this.getCrowdfundingProgress(eventId);
      
      if (progress.isComplete) {
        // Get event organizers
        const organizers = await query(`
          SELECT u.email, u.name, e.title as event_title
          FROM event_roles er
          JOIN users u ON er.user_id = u.id
          JOIN events e ON er.event_id = e.id
          WHERE er.event_id = $1 AND er.role = 'ORGANIZER'
        `, [eventId]);
  
        // Send notifications to organizers
        for (const organizer of organizers.rows) {
          // Implement notification sending here
          console.log(`Funding goal reached for ${organizer.event_title}! Notify: ${organizer.email}`);
        }
      }
    }
  
    /**
     * Get crowdfunding leaderboard
     */
    static async getCrowdfundingLeaderboard(eventId: string, limit: number = 10) {
      const result = await query(`
        SELECT 
          CASE WHEN cc.is_anonymous THEN 'Anonymous' ELSE u.name END as contributor_name,
          cc.amount_cents,
          cc.message,
          cc.created_at,
          cc.is_anonymous
        FROM crowdfunding_contributions cc
        JOIN users u ON cc.user_id = u.id
        WHERE cc.event_id = $1 AND cc.status = 'CONFIRMED'
        ORDER BY cc.amount_cents DESC, cc.created_at ASC
        LIMIT $2
      `, [eventId, limit]);
  
      return result.rows;
    }
  }