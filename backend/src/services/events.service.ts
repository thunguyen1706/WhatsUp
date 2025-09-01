import { query } from '../db.js';
import { AppError } from '../middleware/error.middleware.js';
import { EventRolesService } from './eventRoles.service.js';
import { CacheService } from './cache.service.js';

export interface CreateEventData {
  title: string;
  description?: string;
  category?: string;
  starts_at: string;
  ends_at?: string;
  location_name?: string;
  location_address?: string;
  location_lat?: number;
  location_lng?: number;
  price_cents?: number;
  capacity?: number;
  image_url?: string;
  // Crowdfunding fields
  funding_goal_cents?: number;
  funding_deadline?: string;
  min_funding_cents?: number;
  allow_donations?: boolean;
  allow_sponsorships?: boolean;
}

export interface EventFilters {
  category?: string;
  location?: string;
  date_from?: string;
  date_to?: string;
  price_min?: number;
  price_max?: number;
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
  lat?: number;
  lng?: number;
  radius?: number;
}

export class EventsService {
  /**
   * Create new event - creator becomes organizer
   */
  static async createEvent(userId: string, data: CreateEventData) {
    const eventData = {
      ...data,
      status: 'DRAFT' // Start as draft
    };

    // Validate dates
    if (new Date(data.starts_at) <= new Date()) {
      throw new AppError('Event start time must be in the future', 400);
    }

    if (data.ends_at && new Date(data.ends_at) <= new Date(data.starts_at)) {
      throw new AppError('Event end time must be after start time', 400);
    }

    if (data.funding_deadline && new Date(data.funding_deadline) <= new Date()) {
      throw new AppError('Funding deadline must be in the future', 400);
    }

    // Prevent duplicate creation: same organizer, same title, same start time
    const dupCheck = await query(
      `SELECT id FROM events WHERE organizer_id = $1 AND LOWER(title) = LOWER($2) AND starts_at = $3 LIMIT 1`,
      [userId, eventData.title, eventData.starts_at]
    );
    if (dupCheck.rows.length > 0) {
      throw new AppError('An event with the same title and start time already exists', 409);
    }

    const result = await query(
      `INSERT INTO events (
        title, description, category, starts_at, ends_at,
        location_name, location_address, location_lat, location_lng,
        price_cents, capacity, image_url, status,
        funding_goal_cents, funding_deadline, min_funding_cents,
        allow_donations, allow_sponsorships, organizer_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        eventData.title,
        eventData.description,
        eventData.category,
        eventData.starts_at,
        eventData.ends_at,
        eventData.location_name,
        eventData.location_address,
        eventData.location_lat,
        eventData.location_lng,
        eventData.price_cents || 0,
        eventData.capacity,
        eventData.image_url,
        eventData.status,
        eventData.funding_goal_cents || 0,
        eventData.funding_deadline,
        eventData.min_funding_cents || 0,
        eventData.allow_donations !== false,
        eventData.allow_sponsorships !== false,
        userId
      ]
    );

    const event = result.rows[0];

    // Make creator the organizer
    await EventRolesService.assignEventRole(event.id, userId, 'ORGANIZER');

    // Clear cache
    await CacheService.invalidatePattern('events:*');

    return event;
  }

  /**
   * Get all events with optional filters and pagination
   */
  static async getEvents(filters: EventFilters = {}, userId?: string) {
    const {
      category,
      location,
      date_from,
      date_to,
      price_min,
      price_max,
      search,
      status = 'PUBLISHED',
      page = 1,
      limit = 20
    } = filters;

    let conditions = ['e.status = $1'];
    let params: any[] = [status];
    let paramCount = 1;

    // Build WHERE conditions
    if (category) {
      paramCount++;
      conditions.push(`e.category = $${paramCount}`);
      params.push(category);
    }

    if (location) {
      paramCount++;
      conditions.push(`(e.location_name ILIKE $${paramCount} OR e.location_address ILIKE $${paramCount})`);
      params.push(`%${location}%`);
    }

    if (date_from) {
      paramCount++;
      conditions.push(`e.starts_at >= $${paramCount}`);
      params.push(date_from);
    }

    if (date_to) {
      paramCount++;
      conditions.push(`e.starts_at <= $${paramCount}`);
      params.push(date_to);
    }

    if (price_min !== undefined) {
      paramCount++;
      conditions.push(`e.price_cents >= $${paramCount}`);
      params.push(price_min * 100);
    }

    if (price_max !== undefined) {
      paramCount++;
      conditions.push(`e.price_cents <= $${paramCount}`);
      params.push(price_max * 100);
    }

    if (search) {
      paramCount++;
      conditions.push(`(e.title ILIKE $${paramCount} OR e.description ILIKE $${paramCount})`);
      params.push(`%${search}%`);
    }

    const offset = (page - 1) * limit;
    paramCount++;
    params.push(limit);
    paramCount++;
    params.push(offset);

    const baseQuery = `
      SELECT 
        e.*,
        COUNT(t.id) FILTER (WHERE t.status = 'CONFIRMED') as attendee_count,
        COUNT(s.id) FILTER (WHERE s.status = 'CONFIRMED') as sponsor_count,
        SUM(cc.amount_cents) FILTER (WHERE cc.status = 'CONFIRMED') as crowdfunding_raised,
        ${userId ? `
          CASE WHEN er.user_id IS NOT NULL THEN er.role ELSE NULL END as user_role,
          CASE WHEN ut.user_id IS NOT NULL THEN true ELSE false END as user_attending
        ` : `
          NULL as user_role,
          false as user_attending
        `}
      FROM events e
      LEFT JOIN tickets t ON e.id = t.event_id
      LEFT JOIN sponsorships s ON e.id = s.event_id
      LEFT JOIN crowdfunding_contributions cc ON e.id = cc.event_id
      ${userId ? `
        LEFT JOIN event_roles er ON e.id = er.event_id AND er.user_id = $${paramCount + 1}
        LEFT JOIN tickets ut ON e.id = ut.event_id AND ut.user_id = $${paramCount + 2} AND ut.status = 'CONFIRMED'
      ` : ''}
      WHERE ${conditions.join(' AND ')}
      GROUP BY e.id${userId ? ', er.user_id, er.role, ut.user_id' : ''}
      ORDER BY e.starts_at ASC
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;

    if (userId) {
      params.push(userId);
      params.push(userId);
    }

    const result = await query(baseQuery, params);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT e.id) as total
      FROM events e
      WHERE ${conditions.join(' AND ')}
    `;
    const countParams = userId ? params.slice(0, -4) : params.slice(0, -2);
    const countResult = await query(countQuery, countParams);

    return {
      events: result.rows.map(row => ({
        ...row,
        attendee_count: parseInt(row.attendee_count || 0),
        sponsor_count: parseInt(row.sponsor_count || 0),
        crowdfunding_raised: parseInt(row.crowdfunding_raised || 0),
        funding_progress: row.funding_goal_cents > 0 
          ? Math.min((parseInt(row.crowdfunding_raised || 0) / row.funding_goal_cents) * 100, 100)
          : 0
      })),
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      }
    };
  }

  /**
   * Get single event by ID
   */
  static async getEvent(eventId: string, userId?: string) {
    let eventQuery = `
      SELECT 
        e.*,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'CONFIRMED') as attendee_count,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'CONFIRMED') as sponsor_count,
        SUM(cc.amount_cents) FILTER (WHERE cc.status = 'CONFIRMED') as crowdfunding_raised,
        ${userId ? `
          er.role as user_role,
          CASE WHEN ut.user_id IS NOT NULL THEN true ELSE false END as user_attending
        ` : `
          NULL as user_role,
          false as user_attending
        `}
      FROM events e
      LEFT JOIN tickets t ON e.id = t.event_id
      LEFT JOIN sponsorships s ON e.id = s.event_id
      LEFT JOIN crowdfunding_contributions cc ON e.id = cc.event_id
      ${userId ? `
        LEFT JOIN event_roles er ON e.id = er.event_id AND er.user_id = $2
        LEFT JOIN tickets ut ON e.id = ut.event_id AND ut.user_id = $2 AND ut.status = 'CONFIRMED'
      ` : ''}
      WHERE e.id = $1
      GROUP BY e.id${userId ? ', er.role, ut.user_id' : ''}
    `;

    const params = userId ? [eventId, userId] : [eventId];
    const result = await query(eventQuery, params);

    if (result.rows.length === 0) {
      throw new AppError('Event not found', 404);
    }

    const event = result.rows[0];

    // Calculate funding progress
    const crowdfundingRaised = parseInt(event.crowdfunding_raised || 0);
    const fundingProgress = event.funding_goal_cents > 0 
      ? Math.min((crowdfundingRaised / event.funding_goal_cents) * 100, 100)
      : 0;

    return {
      ...event,
      attendee_count: parseInt(event.attendee_count || 0),
      sponsor_count: parseInt(event.sponsor_count || 0),
      crowdfunding_raised: crowdfundingRaised,
      funding_progress: fundingProgress
    };
  }

  /**
   * Update event - only organizers can update
   */
  static async updateEvent(eventId: string, userId: string, updates: any) {
    // Check if user is organizer
    const isOrganizer = await EventRolesService.hasEventRole(userId, eventId, ['ORGANIZER', 'CO_ORGANIZER']);
    if (!isOrganizer) {
      throw new AppError('Only organizers can update events', 403);
    }

    // Validate date updates
    if (updates.starts_at && new Date(updates.starts_at) <= new Date()) {
      throw new AppError('Event start time must be in the future', 400);
    }

    if (updates.ends_at && updates.starts_at && new Date(updates.ends_at) <= new Date(updates.starts_at)) {
      throw new AppError('Event end time must be after start time', 400);
    }

    // Build update query
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    const allowedFields = [
      'title', 'description', 'category', 'starts_at', 'ends_at',
      'location_name', 'location_address', 'location_lat', 'location_lng',
      'price_cents', 'capacity', 'image_url', 'funding_goal_cents',
      'funding_deadline', 'min_funding_cents', 'allow_donations', 'allow_sponsorships'
    ];

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && allowedFields.includes(key)) {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (updateFields.length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    values.push(eventId);
    const updateQuery = `
      UPDATE events 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(updateQuery, values);

    // Clear cache
    await CacheService.del([`events:${eventId}`]);
    await CacheService.invalidatePattern('events:*');

    return result.rows[0];
  }

  /**
   * Delete event - only organizers
   */
  static async deleteEvent(eventId: string, userId: string) {
    // Check if user is organizer
    const isOrganizer = await EventRolesService.hasEventRole(userId, eventId, ['ORGANIZER']);
    if (!isOrganizer) {
      throw new AppError('Only organizers can delete events', 403);
    }

    // Check if event has attendees
    const attendees = await query(
      'SELECT COUNT(*) FROM tickets WHERE event_id = $1 AND status = $2',
      [eventId, 'CONFIRMED']
    );

    if (parseInt(attendees.rows[0].count) > 0) {
      throw new AppError('Cannot delete event with confirmed attendees', 400);
    }

    await query('DELETE FROM events WHERE id = $1', [eventId]);

    // Clear cache
    await CacheService.invalidatePattern('events:*');

    return { success: true };
  }

  /**
   * Get event dashboard - only for organizers
   */
  static async getEventDashboard(eventId: string, userId: string) {
    // Check if user is organizer
    const isOrganizer = await EventRolesService.hasEventRole(userId, eventId, ['ORGANIZER', 'CO_ORGANIZER']);
    if (!isOrganizer) {
      throw new AppError('Access denied', 403);
    }

    // Get event details
    const event = await query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (event.rows.length === 0) {
      throw new AppError('Event not found', 404);
    }

    // Get ticket stats
    const ticketStats = await query(`
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(*) FILTER (WHERE status = 'CONFIRMED') as confirmed_tickets,
        SUM(CASE WHEN status = 'CONFIRMED' THEN price_cents ELSE 0 END) as revenue,
        COUNT(DISTINCT user_id) FILTER (WHERE status = 'CONFIRMED') as unique_attendees
      FROM tickets
      WHERE event_id = $1
    `, [eventId]);

    // Get sponsorship stats
    const sponsorshipStats = await query(`
      SELECT 
        COUNT(*) as total_sponsors,
        SUM(CASE WHEN status = 'CONFIRMED' THEN amount_cents ELSE 0 END) as sponsorship_revenue,
        COUNT(*) FILTER (WHERE type = 'SPONSORSHIP') as sponsorships,
        COUNT(*) FILTER (WHERE type = 'DONATION') as donations
      FROM sponsorships
      WHERE event_id = $1
    `, [eventId]);

    // Get crowdfunding stats
    const crowdfundingStats = await query(`
      SELECT 
        COUNT(*) as total_contributors,
        SUM(CASE WHEN status = 'CONFIRMED' THEN amount_cents ELSE 0 END) as total_raised,
        AVG(CASE WHEN status = 'CONFIRMED' THEN amount_cents ELSE NULL END) as avg_contribution
      FROM crowdfunding_contributions
      WHERE event_id = $1
    `, [eventId]);

    // Get recent activities
    const recentActivities = await query(`
      (
        SELECT 
          'ticket_purchase' as type,
          t.created_at,
          u.name as user_name,
          t.quantity,
          t.price_cents as amount
        FROM tickets t
        JOIN users u ON t.user_id = u.id
        WHERE t.event_id = $1 AND t.status = 'CONFIRMED'
        ORDER BY t.created_at DESC
        LIMIT 5
      )
      UNION ALL
      (
        SELECT 
          'sponsorship' as type,
          s.created_at,
          CASE WHEN s.is_anonymous THEN 'Anonymous' ELSE u.name END as user_name,
          1 as quantity,
          s.amount_cents as amount
        FROM sponsorships s
        JOIN users u ON s.user_id = u.id
        WHERE s.event_id = $1 AND s.status = 'CONFIRMED'
        ORDER BY s.created_at DESC
        LIMIT 5
      )
      UNION ALL
      (
        SELECT 
          'crowdfunding' as type,
          cc.created_at,
          CASE WHEN cc.is_anonymous THEN 'Anonymous' ELSE u.name END as user_name,
          1 as quantity,
          cc.amount_cents as amount
        FROM crowdfunding_contributions cc
        JOIN users u ON cc.user_id = u.id
        WHERE cc.event_id = $1 AND cc.status = 'CONFIRMED'
        ORDER BY cc.created_at DESC
        LIMIT 5
      )
      ORDER BY created_at DESC
      LIMIT 15
    `, [eventId]);

    // Get team members
    const team = await EventRolesService.getEventParticipants(eventId, userId);

    // Calculate totals
    const eventData = event.rows[0];
    const totalRevenue = 
      parseInt(ticketStats.rows[0].revenue || 0) +
      parseInt(sponsorshipStats.rows[0].sponsorship_revenue || 0) +
      parseInt(crowdfundingStats.rows[0].total_raised || 0);

    const fundingProgress = eventData.funding_goal_cents > 0 
      ? (parseInt(crowdfundingStats.rows[0].total_raised || 0) / eventData.funding_goal_cents) * 100 
      : 0;

    return {
      event: eventData,
      stats: {
        tickets: {
          ...ticketStats.rows[0],
          total_tickets: parseInt(ticketStats.rows[0].total_tickets || 0),
          confirmed_tickets: parseInt(ticketStats.rows[0].confirmed_tickets || 0),
          revenue: parseInt(ticketStats.rows[0].revenue || 0),
          unique_attendees: parseInt(ticketStats.rows[0].unique_attendees || 0)
        },
        sponsorships: {
          ...sponsorshipStats.rows[0],
          total_sponsors: parseInt(sponsorshipStats.rows[0].total_sponsors || 0),
          sponsorship_revenue: parseInt(sponsorshipStats.rows[0].sponsorship_revenue || 0),
          sponsorships: parseInt(sponsorshipStats.rows[0].sponsorships || 0),
          donations: parseInt(sponsorshipStats.rows[0].donations || 0)
        },
        crowdfunding: {
          ...crowdfundingStats.rows[0],
          total_contributors: parseInt(crowdfundingStats.rows[0].total_contributors || 0),
          total_raised: parseInt(crowdfundingStats.rows[0].total_raised || 0),
          avg_contribution: parseFloat(crowdfundingStats.rows[0].avg_contribution || 0),
          goal: eventData.funding_goal_cents,
          progress: Math.min(fundingProgress, 100),
          deadline: eventData.funding_deadline
        },
        totalRevenue
      },
      team,
      recentActivities: recentActivities.rows
    };
  }

  /**
   * Publish event (make it public)
   */
  static async publishEvent(eventId: string, userId: string) {
    // Check if user is organizer
    const isOrganizer = await EventRolesService.hasEventRole(userId, eventId, ['ORGANIZER']);
    if (!isOrganizer) {
      throw new AppError('Only organizers can publish events', 403);
    }

    // Validate event has required fields
    const event = await query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (event.rows.length === 0) {
      throw new AppError('Event not found', 404);
    }

    const eventData = event.rows[0];
    if (!eventData.title || !eventData.starts_at) {
      throw new AppError('Event must have title and start time before publishing', 400);
    }

    await query(
      'UPDATE events SET status = $1, updated_at = NOW() WHERE id = $2',
      ['PUBLISHED', eventId]
    );

    // Clear cache
    await CacheService.invalidatePattern('events:*');

    return { success: true };
  }

  /**
   * Get events where user is organizer
   */
  static async getOrganizerEvents(userId: string) {
    const result = await query(`
      SELECT 
        e.*,
        er.role as user_role,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'CONFIRMED') as ticket_count,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'CONFIRMED') as sponsor_count,
        SUM(CASE WHEN cc.status = 'CONFIRMED' THEN cc.amount_cents ELSE 0 END) as crowdfunding_raised
      FROM events e
      JOIN event_roles er ON e.id = er.event_id
      LEFT JOIN tickets t ON t.event_id = e.id
      LEFT JOIN sponsorships s ON s.event_id = e.id
      LEFT JOIN crowdfunding_contributions cc ON cc.event_id = e.id
      WHERE er.user_id = $1 
        AND er.role IN ('ORGANIZER', 'CO_ORGANIZER')
      GROUP BY e.id, er.role
      ORDER BY e.created_at DESC
    `, [userId]);

    return result.rows.map(row => ({
      ...row,
      ticket_count: parseInt(row.ticket_count || 0),
      sponsor_count: parseInt(row.sponsor_count || 0),
      crowdfunding_raised: parseInt(row.crowdfunding_raised || 0)
    }));
  }

  /**
   * Get events where user is attending
   */
  static async getAttendingEvents(userId: string) {
    const result = await query(`
      SELECT 
        e.*,
        t.quantity as ticket_quantity,
        t.status as ticket_status,
        t.purchased_at,
        t.price_cents as paid_amount
      FROM events e
      JOIN tickets t ON e.id = t.event_id
      WHERE t.user_id = $1 
        AND t.status = 'CONFIRMED'
      ORDER BY e.starts_at ASC
    `, [userId]);

    return result.rows;
  }

  /**
   * Get popular events (for homepage)
   */
  static async getPopularEvents(limit: number = 6) {
    const cacheKey = `events:popular:${limit}`;
    const cached = await CacheService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await query(`
      SELECT 
        e.*,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'CONFIRMED') as attendee_count,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'CONFIRMED') as sponsor_count,
        SUM(cc.amount_cents) FILTER (WHERE cc.status = 'CONFIRMED') as crowdfunding_raised,
        (COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'CONFIRMED') * 3 + 
         COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'CONFIRMED') * 2 +
         COUNT(DISTINCT cc.id) FILTER (WHERE cc.status = 'CONFIRMED')) as popularity_score
      FROM events e
      LEFT JOIN tickets t ON e.id = t.event_id
      LEFT JOIN sponsorships s ON e.id = s.event_id
      LEFT JOIN crowdfunding_contributions cc ON e.id = cc.event_id
      WHERE e.status = 'PUBLISHED' 
        AND e.starts_at > NOW()
      GROUP BY e.id
      ORDER BY popularity_score DESC, e.starts_at ASC
      LIMIT $1
    `, [limit]);

    const events = result.rows.map(row => ({
      ...row,
      attendee_count: parseInt(row.attendee_count || 0),
      sponsor_count: parseInt(row.sponsor_count || 0),
      crowdfunding_raised: parseInt(row.crowdfunding_raised || 0),
      funding_progress: row.funding_goal_cents > 0 
        ? Math.min((parseInt(row.crowdfunding_raised || 0) / row.funding_goal_cents) * 100, 100)
        : 0
    }));

    // Cache for 1 hour
    await CacheService.set(cacheKey, JSON.stringify(events), 3600);

    return events;
  }

  /**
   * Get events by category
   */
  static async getEventsByCategory(category: string, limit: number = 10) {
    const result = await query(`
      SELECT 
        e.*,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'CONFIRMED') as attendee_count
      FROM events e
      LEFT JOIN tickets t ON e.id = t.event_id
      WHERE e.status = 'PUBLISHED' 
        AND e.category = $1
        AND e.starts_at > NOW()
      GROUP BY e.id
      ORDER BY e.starts_at ASC
      LIMIT $2
    `, [category, limit]);

    return result.rows.map(row => ({
      ...row,
      attendee_count: parseInt(row.attendee_count || 0)
    }));
  }

  /**
   * Get event analytics (for organizers)
   */
  static async getEventAnalytics(eventId: string, userId: string, dateRange?: { from: string; to: string }) {
    // Check if user is organizer
    const isOrganizer = await EventRolesService.hasEventRole(userId, eventId, ['ORGANIZER', 'CO_ORGANIZER']);
    if (!isOrganizer) {
      throw new AppError('Access denied', 403);
    }

    const dateFilter = dateRange 
      ? `AND created_at BETWEEN '${dateRange.from}' AND '${dateRange.to}'`
      : '';

    // Daily ticket sales
    const ticketSales = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as tickets_sold,
        SUM(price_cents) as revenue
      FROM tickets
      WHERE event_id = $1 
        AND status = 'CONFIRMED'
        ${dateFilter}
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [eventId]);

    // Daily contributions
    const contributions = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as contribution_count,
        SUM(amount_cents) as amount
      FROM crowdfunding_contributions
      WHERE event_id = $1 
        AND status = 'CONFIRMED'
        ${dateFilter}
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [eventId]);

    // Views and interactions
    const interactions = await query(`
      SELECT 
        action,
        COUNT(*) as count,
        DATE(created_at) as date
      FROM interactions
      WHERE event_id = $1 
        ${dateFilter}
      GROUP BY action, DATE(created_at)
      ORDER BY date, action
    `, [eventId]);

    return {
      ticketSales: ticketSales.rows,
      contributions: contributions.rows,
      interactions: interactions.rows
    };
  }

  /**
   * Record user interaction for analytics
   */
  static async recordInteraction(eventId: string, userId: string | null, action: string, metadata?: any) {
    await query(`
      INSERT INTO interactions (event_id, user_id, action, metadata)
      VALUES ($1, $2, $3, $4)
    `, [eventId, userId, action, metadata ? JSON.stringify(metadata) : null]);
  }

  
/**
 * Get nearby events based on location
 */
  static async getNearbyEvents(filters: EventFilters & { lat?: number; lng?: number; radius?: number }, userId?: string) {
    const {
      lat,
      lng,
      radius = 50, 
      page = 1,
      limit = 20,
      status = 'PUBLISHED',
      category,
      search,
      price_min,
      price_max
    } = filters;

    let conditions = ['e.status = $1'];
    let params: any[] = [status];
    let paramCount = 1;

  // Add location-based filtering if coordinates provided
    if (lat && lng) {
      paramCount++;
      // Use Haversine formula to calculate distance; cast params to double precision
      conditions.push(`
        (6371 * acos(
        cos(radians($${paramCount}::double precision)) * 
        cos(radians(e.location_lat)) * 
        cos(radians(e.location_lng) - radians($${paramCount + 1}::double precision)) + 
        sin(radians($${paramCount}::double precision)) * 
        sin(radians(e.location_lat))
      )) <= $${paramCount + 2}::double precision
    `);
    params.push(lat, lng, radius);
    paramCount += 2;
  }

  // Add future events only (no parameter consumed)
  conditions.push(`e.starts_at > NOW()`);

  // Add other filters
  if (category) {
    paramCount++;
    conditions.push(`e.category = $${paramCount}`);
    params.push(category);
  }

  if (search) {
    paramCount++;
    conditions.push(`(e.title ILIKE $${paramCount} OR e.description ILIKE $${paramCount})`);
    params.push(`%${search}%`);
  }

  if (price_min !== undefined) {
    paramCount++;
    conditions.push(`e.price_cents >= $${paramCount}`);
    params.push(price_min * 100);
  }

  if (price_max !== undefined) {
    paramCount++;
    conditions.push(`e.price_cents <= $${paramCount}`);
    params.push(price_max * 100);
  }

  const offset = (page - 1) * limit;
  paramCount++;
  params.push(limit);
  paramCount++;
  params.push(offset);

  // Base query with distance calculation for ordering
  let orderBy = 'e.starts_at ASC';
  let distanceSelect = '';
  
  if (lat && lng) {
    distanceSelect = `, 
      (6371 * acos(
        cos(radians(${lat})) * 
        cos(radians(e.location_lat)) * 
        cos(radians(e.location_lng) - radians(${lng})) + 
        sin(radians(${lat})) * 
        sin(radians(e.location_lat))
      )) as distance`;
    orderBy = 'distance ASC, e.starts_at ASC';
  }

  const baseQuery = `
    SELECT 
      e.*,
      u.name as organizer_name,
      COUNT(t.id) FILTER (WHERE t.status = 'CONFIRMED') as attendee_count,
      COUNT(s.id) FILTER (WHERE s.status = 'CONFIRMED') as sponsor_count,
      SUM(cc.amount_cents) FILTER (WHERE cc.status = 'CONFIRMED') as crowdfunding_raised
      ${distanceSelect}
      ${userId ? `,
        CASE WHEN er.user_id IS NOT NULL THEN er.role ELSE NULL END as user_role,
        CASE WHEN ut.user_id IS NOT NULL THEN true ELSE false END as user_attending
      ` : `,
        NULL as user_role,
        false as user_attending
      `}
    FROM events e
    LEFT JOIN users u ON e.organizer_id = u.id
    LEFT JOIN tickets t ON e.id = t.event_id
    LEFT JOIN sponsorships s ON e.id = s.event_id
    LEFT JOIN crowdfunding_contributions cc ON e.id = cc.event_id
    ${userId ? `
      LEFT JOIN event_roles er ON e.id = er.event_id AND er.user_id = $${paramCount + 1}
      LEFT JOIN tickets ut ON e.id = ut.event_id AND ut.user_id = $${paramCount + 2} AND ut.status = 'CONFIRMED'
    ` : ''}
    WHERE ${conditions.join(' AND ')}
    GROUP BY e.id, u.name${userId ? ', er.user_id, er.role, ut.user_id' : ''}
    ORDER BY ${orderBy}
    LIMIT $${paramCount - 1} OFFSET $${paramCount}
  `;

  if (userId) {
    params.push(userId);
    params.push(userId);
  }

  const result = await query(baseQuery, params);

  // Get total count for pagination
  const countQuery = `
    SELECT COUNT(DISTINCT e.id) as total
    FROM events e
    WHERE ${conditions.join(' AND ')}
  `;
  const countParams = userId ? params.slice(0, -4) : params.slice(0, -2);
  const countResult = await query(countQuery, countParams);

  return {
    events: result.rows.map(row => ({
      ...row,
      attendee_count: parseInt(row.attendee_count || 0),
      sponsor_count: parseInt(row.sponsor_count || 0),
      crowdfunding_raised: parseInt(row.crowdfunding_raised || 0),
      funding_progress: row.funding_goal_cents > 0 
        ? Math.min((parseInt(row.crowdfunding_raised || 0) / row.funding_goal_cents) * 100, 100)
        : 0,
      distance: row.distance ? parseFloat(row.distance).toFixed(2) : null
    })),
    pagination: {
      page,
      limit,
      total: parseInt(countResult.rows[0].total),
      totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
    }
  };
}
}