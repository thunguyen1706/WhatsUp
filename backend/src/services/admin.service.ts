import { query } from '../db.js';
import { AppError } from '../middleware/error.middleware.js';
import { CacheService } from './cache.service.js';

export interface UserFilters {
    role?: string;
    email?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export interface AuditLogFilters {
  user_id?: string;
  action?: string;
  resource_type?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export class AdminService {
  /**
   * Get all users with filters
   */
  static async getAllUsers(filters: UserFilters) {
    const { role, email, search, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    let queryText = `
      SELECT id, email, name, role, email_verified, created_at, updated_at
      FROM users
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (role) {
      params.push(role);
      queryText += ` AND role = $${params.length}`;
    }

    if (email) {
      params.push(`%${email}%`);
      queryText += ` AND email ILIKE $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      queryText += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }

    // Get total count
    const countQuery = queryText.replace(
      'SELECT id, email, name, role, email_verified, created_at, updated_at',
      'SELECT COUNT(*)'
    );
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    params.push(limit, offset);
    queryText += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await query(queryText, params);

    return {
      users: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Update user role
   */
  static async updateUserRole(adminId: string, targetUserId: string, newRole: string) {
    // Validate role
    const validRoles = ['USER', 'ORGANIZER', 'SPONSOR', 'ADMIN'];
    if (!validRoles.includes(newRole)) {
      throw new AppError('Invalid role', 400);
    }

    // Prevent self-demotion from admin
    if (targetUserId === adminId && newRole !== 'ADMIN') {
      throw new AppError('Cannot remove your own admin privileges', 400);
    }

    // Get current user info
    const currentUser = await query(
      'SELECT role, email, name FROM users WHERE id = $1',
      [targetUserId]
    );

    if (currentUser.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const oldRole = currentUser.rows[0].role;

    // Update role
    const result = await query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, name, role',
      [newRole, targetUserId]
    );

    // Log audit
    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, changes)
       VALUES ($1, 'UPDATE_USER_ROLE', 'user', $2, $3::jsonb)`,
      [adminId, targetUserId, JSON.stringify({ 
          old_role: oldRole, 
          new_role: newRole,
        user_email: currentUser.rows[0].email 
      })]
    );

    return {
      user: result.rows[0],
      changes: { from: oldRole, to: newRole }
    };
  }

  /**
   * Delete user
   */
  static async deleteUser(adminId: string, targetUserId: string) {
    // Prevent self-deletion
    if (targetUserId === adminId) {
      throw new AppError('Cannot delete your own account', 400);
    }

    // Check if user exists
    const user = await query(
      'SELECT email, name, role FROM users WHERE id = $1',
      [targetUserId]
    );

    if (user.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    // Prevent deletion of other admins
    if (user.rows[0].role === 'ADMIN') {
      throw new AppError('Cannot delete admin users', 403);
    }

    // Delete user
    await query('DELETE FROM users WHERE id = $1', [targetUserId]);

    // Log audit
    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, changes)
       VALUES ($1, 'DELETE_USER', 'user', $2, $3::jsonb)`,
      [adminId, targetUserId, JSON.stringify({ deleted_user: user.rows[0] })]
    );

    return {
      deletedUser: { id: targetUserId, email: user.rows[0].email }
    };
  }

  /**
   * Get system overview
   */
  static async getSystemOverview() {
    const [userStats, eventStats, ticketStats, sponsorStats] = await Promise.all([
      this.getUserStatistics(),
      this.getEventStatistics(),
      this.getTicketStatistics(),
      this.getSponsorshipStatistics()
    ]);

    const interactionTrends = await this.getInteractionTrends();
    const topEvents = await this.getTopPerformingEvents();
    const systemHealth = await this.getSystemHealth();

    return {
      users: userStats,
      events: eventStats,
      tickets: ticketStats,
      sponsorships: sponsorStats,
      trends: interactionTrends,
      topEvents,
      system: systemHealth
    };
  }

  /**
   * Get event analytics
   */
  static async getEventAnalytics(eventId: string, days: number = 30) {
    const event = await query(`
      SELECT e.*, u.name as organizer_name, u.email as organizer_email
      FROM events e
      JOIN users u ON e.organizer_id = u.id
      WHERE e.id = $1
    `, [eventId]);

    if (event.rows.length === 0) {
      throw new AppError('Event not found', 404);
    }

    const [ticketAnalytics, engagement, funnel, demographics, sponsorships, hourlyActivity] = 
      await Promise.all([
      this.getTicketAnalytics(eventId, days),
      this.getEngagementMetrics(eventId, days),
      this.getConversionFunnel(eventId),
      this.getDemographics(eventId),
        this.getSponsorshipData(eventId),
        this.getHourlyActivity(eventId)
    ]);

    return {
      event: event.rows[0],
      ticketSales: ticketAnalytics,
      engagement,
      funnel,
      demographics,
      sponsorships,
      hourlyActivity,
      period: `${days} days`
    };
  }

  /**
   * Get audit logs
   */
  static async getAuditLogs(filters: AuditLogFilters) {
    const { user_id, action, resource_type, start_date, end_date, page = 1, limit = 100 } = filters;
    const offset = (page - 1) * limit;

    let queryText = `
      SELECT a.*, u.email as user_email, u.name as user_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    
    const queryParams: any[] = [];

    if (user_id) {
      queryParams.push(user_id);
      queryText += ` AND a.user_id = $${queryParams.length}`;
    }

    if (action) {
      queryParams.push(action);
      queryText += ` AND a.action = $${queryParams.length}`;
    }

    if (resource_type) {
      queryParams.push(resource_type);
      queryText += ` AND a.resource_type = $${queryParams.length}`;
    }

    if (start_date) {
      queryParams.push(start_date);
      queryText += ` AND a.created_at >= $${queryParams.length}`;
    }

    if (end_date) {
      queryParams.push(end_date);
      queryText += ` AND a.created_at <= $${queryParams.length}`;
    }

    // Get total count
    const countQuery = queryText.replace(
      'SELECT a.*, u.email as user_email, u.name as user_name',
      'SELECT COUNT(*)'
    );
    const countResult = await query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    queryParams.push(limit, offset);
    queryText += ` ORDER BY a.created_at DESC LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;

    const result = await query(queryText, queryParams);

    return {
      logs: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get system health
   */
  static async getSystemHealth() {
    try {
      const dbCheck = await query('SELECT NOW()');
      const cacheInfo = await CacheService.info();
      
      return {
        database: dbCheck.rows.length > 0 ? 'healthy' : 'unhealthy',
        cache: cacheInfo ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        database: 'unhealthy',
        cache: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Helper methods
  private static async getUserStatistics() {
    const result = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE role = 'USER') as total_users,
        COUNT(*) FILTER (WHERE role = 'ORGANIZER') as total_organizers,
        COUNT(*) FILTER (WHERE role = 'SPONSOR') as total_sponsors,
        COUNT(*) FILTER (WHERE role = 'ADMIN') as total_admins,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_users_week,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as new_users_month
      FROM users
    `);
    return result.rows[0];
  }

  private static async getEventStatistics() {
    const result = await query(`
      SELECT 
        COUNT(*) as total_events,
        COUNT(*) FILTER (WHERE status = 'PUBLISHED') as published_events,
        COUNT(*) FILTER (WHERE status = 'DRAFT') as draft_events,
        COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled_events,
        COUNT(*) FILTER (WHERE starts_at > NOW()) as upcoming_events,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_events_week
      FROM events
    `);
    return result.rows[0];
  }

  private static async getTicketStatistics() {
    const result = await query(`
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(*) FILTER (WHERE status = 'CONFIRMED') as confirmed_tickets,
        SUM(CASE WHEN status = 'CONFIRMED' THEN price_cents ELSE 0 END) as total_revenue_cents,
        COUNT(DISTINCT user_id) FILTER (WHERE status = 'CONFIRMED') as unique_buyers
      FROM tickets
    `);
    return result.rows[0];
  }

  private static async getSponsorshipStatistics() {
    const result = await query(`
      SELECT 
        COUNT(*) as total_donations,
        SUM(CASE WHEN status = 'CONFIRMED' THEN amount_cents ELSE 0 END) as total_sponsorship_cents,
        COUNT(DISTINCT user_id) as unique_sponsors
      FROM donations
      WHERE status = 'CONFIRMED'
    `);
    return result.rows[0];
  }

  private static async getInteractionTrends() {
    const result = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE action = 'view') as views,
        COUNT(*) FILTER (WHERE action = 'click') as clicks,
        COUNT(*) FILTER (WHERE action = 'save') as saves,
        COUNT(*) FILTER (WHERE action = 'purchase') as purchases
      FROM interactions
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `);
    return result.rows;
  }

  private static async getTopPerformingEvents() {
    const result = await query(`
      SELECT 
        e.id, e.title, e.category,
        COUNT(DISTINCT t.id) as tickets_sold,
        SUM(t.price_cents) as revenue,
        COUNT(DISTINCT i.user_id) as unique_interactions
      FROM events e
      LEFT JOIN tickets t ON t.event_id = e.id AND t.status = 'CONFIRMED'
      LEFT JOIN interactions i ON i.event_id = e.id
      WHERE e.status = 'PUBLISHED'
      GROUP BY e.id
      ORDER BY revenue DESC NULLS LAST
      LIMIT 10
    `);
    return result.rows;
  }

  private static async getTicketAnalytics(eventId: string, days: number) {
    const result = await query(`
      SELECT 
        DATE(purchased_at) as date,
        COUNT(*) as tickets_sold,
        SUM(quantity) as total_quantity,
        SUM(price_cents) as revenue
      FROM tickets
      WHERE event_id = $1 
        AND status = 'CONFIRMED'
        AND purchased_at > NOW() - INTERVAL '${days} days'
      GROUP BY DATE(purchased_at)
      ORDER BY date DESC
    `, [eventId]);
    return result.rows;
  }

  private static async getEngagementMetrics(eventId: string, days: number) {
    const result = await query(`
      SELECT 
        action,
        COUNT(*) as count,
        COUNT(DISTINCT user_id) as unique_users
      FROM interactions
      WHERE event_id = $1
        AND created_at > NOW() - INTERVAL '${days} days'
      GROUP BY action
    `, [eventId]);
    return result.rows;
  }

  private static async getConversionFunnel(eventId: string) {
    const result = await query(`
        SELECT 
        COUNT(DISTINCT user_id) FILTER (WHERE action = 'view') as viewed,
        COUNT(DISTINCT user_id) FILTER (WHERE action = 'click') as clicked,
        COUNT(DISTINCT user_id) FILTER (WHERE action = 'save') as saved,
        COUNT(DISTINCT user_id) FILTER (WHERE action = 'purchase') as purchased
        FROM interactions
        WHERE event_id = $1
    `, [eventId]);
    return result.rows[0];
  }

  private static async getDemographics(eventId: string) {
    const result = await query(`
      SELECT 
        u.role,
        COUNT(DISTINCT t.id) as tickets_purchased,
        SUM(t.price_cents) as revenue_generated
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.event_id = $1 AND t.status = 'CONFIRMED'
      GROUP BY u.role
    `, [eventId]);
    return result.rows;
  }

  private static async getSponsorshipData(eventId: string) {
    const result = await query(`
      SELECT 
        COUNT(*) as total_sponsors,
        SUM(amount_cents) as total_sponsorship,
        AVG(amount_cents) as avg_sponsorship
      FROM donations
      WHERE event_id = $1 AND status = 'CONFIRMED'
    `, [eventId]);
    return result.rows[0];
  }

  private static async getHourlyActivity(eventId: string) {
    const result = await query(`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as interactions
      FROM interactions
      WHERE event_id = $1
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `, [eventId]);
    return result.rows;
  }
}
