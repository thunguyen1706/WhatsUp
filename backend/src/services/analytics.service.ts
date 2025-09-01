// src/services/analytics.service.ts

import { query } from '../db.js';
import { cache } from '../redis.js';
import { Redis } from 'ioredis';
import { TrendingService } from './trending.service.js';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export interface EventMetric {
  eventId: string;
  metric: 'view' | 'click' | 'save' | 'share' | 'ticket_sale' | 'revenue';
  value: number;
}

export interface UserBehavior {
  userId: string;
  eventId: string;
  action: string;
  metadata?: any;
}

export class AnalyticsService {
  /**
   * Track event metrics in real-time
   */
  static async trackEventMetric(eventId: string, metric: string, value: number = 1) {
    const timestamp = Date.now();
    const minute = Math.floor(timestamp / 60000);
    const hour = Math.floor(timestamp / 3600000);
    const day = Math.floor(timestamp / 86400000);

    // Store in time-series buckets
    const promises = [
      redis.hincrby(`metrics:${eventId}:minute:${minute}`, metric, value),
      redis.hincrby(`metrics:${eventId}:hour:${hour}`, metric, value),
      redis.hincrby(`metrics:${eventId}:day:${day}`, metric, value),
      redis.hincrby(`metrics:${eventId}:total`, metric, value)
    ];

    await Promise.all(promises);

    // Set expiration
    await redis.expire(`metrics:${eventId}:minute:${minute}`, 3600); // 1 hour
    await redis.expire(`metrics:${eventId}:hour:${hour}`, 86400); // 24 hours
    await redis.expire(`metrics:${eventId}:day:${day}`, 2592000); // 30 days

    // Update global metrics
    await this.updateGlobalMetrics(metric, value);
  }

  /**
   * Track user behavior for personalization and analytics
   */
  static async trackUserBehavior(
    userId: string,
    eventId: string,
    action: string,
    metadata?: any
  ) {
    // Store in database for historical analysis
    await query(`
      INSERT INTO interactions (user_id, event_id, action, metadata, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [userId, eventId, action, JSON.stringify(metadata || {})]);

    // Update user preferences based on behavior
    if (action === 'purchase' || action === 'save') {
      await this.updateUserPreferences(userId, eventId);
    }

    // Track in Redis for real-time metrics
    await this.trackEventMetric(eventId, action);

    // Update trending scores
    await TrendingService.trackInteraction(eventId, action);

    // Update recommendation features
    if (action === 'purchase') {
      await query(`
        UPDATE recommendation_features
        SET relevance_label = 2, last_interaction = NOW()
        WHERE user_id = $1 AND event_id = $2 AND query_day = CURRENT_DATE
      `, [userId, eventId]);
    } else if (action === 'save' || action === 'click') {
      await query(`
        UPDATE recommendation_features
        SET relevance_label = GREATEST(relevance_label, 1), last_interaction = NOW()
        WHERE user_id = $1 AND event_id = $2 AND query_day = CURRENT_DATE
      `, [userId, eventId]);
    }

    // Track user session
    await this.updateUserSession(userId, action);
  }

  /**
   * Get comprehensive event analytics
   */
  static async getEventAnalytics(eventId: string, timeRange: '1h' | '24h' | '7d' | '30d' = '24h') {
    // Get real-time metrics from Redis
    const realtimeMetrics = await this.getRealtimeMetrics(eventId, timeRange);

    // Get historical data from database
    const historicalData = await this.getHistoricalAnalytics(eventId, timeRange);

    // Get conversion funnel
    const funnel = await this.getConversionFunnel(eventId);

    // Get audience insights
    const audienceInsights = await this.getAudienceInsights(eventId);

    // Get performance comparison
    const comparison = await this.getPerformanceComparison(eventId);

    return {
      realtime: realtimeMetrics,
      historical: historicalData,
      funnel,
      audience: audienceInsights,
      comparison,
      timeRange
    };
  }

  /**
   * Get organizer dashboard analytics
   */
  static async getOrganizerDashboard(organizerId: string) {
    // Overall statistics
    const stats = await query(`
      SELECT 
        COUNT(DISTINCT e.id) as total_events,
        COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'PUBLISHED') as active_events,
        COUNT(DISTINCT t.id) as total_tickets_sold,
        SUM(t.price_cents) as total_revenue,
        COUNT(DISTINCT t.user_id) as unique_attendees,
        AVG(CASE WHEN e.capacity > 0 
          THEN (SELECT COUNT(*) FROM tickets WHERE event_id = e.id AND status = 'CONFIRMED')::float / e.capacity * 100 
          ELSE 0 END) as avg_capacity_filled
      FROM events e
      LEFT JOIN tickets t ON t.event_id = e.id AND t.status = 'CONFIRMED'
      WHERE e.organizer_id = $1
    `, [organizerId]);

    // Event performance
    const eventPerformance = await query(`
      SELECT 
        e.id,
        e.title,
        e.category,
        e.starts_at,
        COUNT(DISTINCT t.id) as tickets_sold,
        SUM(t.quantity) as total_attendees,
        SUM(t.price_cents) as revenue,
        e.capacity,
        CASE WHEN e.capacity > 0 
          THEN ROUND((COUNT(DISTINCT t.id)::numeric / e.capacity) * 100, 2) 
          ELSE 0 END as capacity_filled,
        COUNT(DISTINCT i.user_id) as unique_viewers,
        COUNT(i.id) FILTER (WHERE i.action = 'save') as saves_count
      FROM events e
      LEFT JOIN tickets t ON t.event_id = e.id AND t.status = 'CONFIRMED'
      LEFT JOIN interactions i ON i.event_id = e.id
      WHERE e.organizer_id = $1
      GROUP BY e.id
      ORDER BY e.starts_at DESC
      LIMIT 10
    `, [organizerId]);

    // Revenue trends
    const revenueTrend = await query(`
      SELECT 
        DATE_TRUNC('day', t.purchased_at) as date,
        SUM(t.price_cents) as revenue,
        COUNT(*) as tickets_sold,
        COUNT(DISTINCT t.event_id) as events_with_sales
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE e.organizer_id = $1
        AND t.status = 'CONFIRMED'
        AND t.purchased_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', t.purchased_at)
      ORDER BY date DESC
    `, [organizerId]);

    // Category performance
    const categoryPerformance = await query(`
      SELECT 
        e.category,
        COUNT(DISTINCT e.id) as event_count,
        COUNT(DISTINCT t.id) as tickets_sold,
        SUM(t.price_cents) as revenue,
        AVG(t.price_cents) as avg_ticket_price
      FROM events e
      LEFT JOIN tickets t ON t.event_id = e.id AND t.status = 'CONFIRMED'
      WHERE e.organizer_id = $1
      GROUP BY e.category
      ORDER BY revenue DESC NULLS LAST
    `, [organizerId]);

    // Top sponsors across all events
    const topSponsors = await query(`
      SELECT 
        u.name as sponsor_name,
        SUM(d.amount_cents) as total_sponsored,
        COUNT(DISTINCT d.event_id) as events_sponsored,
        MAX(d.amount_cents) as highest_donation
      FROM donations d
      JOIN users u ON d.user_id = u.id
      JOIN events e ON d.event_id = e.id
      WHERE e.organizer_id = $1 AND d.status = 'CONFIRMED'
      GROUP BY u.id, u.name
      ORDER BY total_sponsored DESC
      LIMIT 10
    `, [organizerId]);

    // Engagement metrics
    const engagement = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE i.action = 'view') as total_views,
        COUNT(*) FILTER (WHERE i.action = 'click') as total_clicks,
        COUNT(*) FILTER (WHERE i.action = 'save') as total_saves,
        COUNT(*) FILTER (WHERE i.action = 'share') as total_shares,
        COUNT(DISTINCT i.user_id) as unique_users,
        AVG(CASE WHEN i.action = 'view' THEN 1 ELSE 0 END * 100) as view_rate
      FROM interactions i
      JOIN events e ON i.event_id = e.id
      WHERE e.organizer_id = $1
        AND i.created_at > NOW() - INTERVAL '30 days'
    `, [organizerId]);

    return {
      overview: stats.rows[0],
      events: eventPerformance.rows,
      revenueTrend: revenueTrend.rows,
      categoryPerformance: categoryPerformance.rows,
      topSponsors: topSponsors.rows,
      engagement: engagement.rows[0]
    };
  }

  /**
   * Get user activity analytics
   */
  static async getUserAnalytics(userId: string) {
    const activity = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as interactions,
        COUNT(*) FILTER (WHERE action = 'view') as views,
        COUNT(*) FILTER (WHERE action = 'purchase') as purchases,
        COUNT(DISTINCT event_id) as unique_events
      FROM interactions
      WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [userId]);

    const preferences = await query(`
      SELECT 
        e.category,
        COUNT(*) as interaction_count,
        COUNT(*) FILTER (WHERE i.action = 'purchase') as purchase_count
      FROM interactions i
      JOIN events e ON i.event_id = e.id
      WHERE i.user_id = $1
      GROUP BY e.category
      ORDER BY interaction_count DESC
    `, [userId]);

    const spending = await query(`
      SELECT 
        SUM(price_cents) as total_spent,
        COUNT(*) as tickets_purchased,
        AVG(price_cents) as avg_ticket_price,
        COUNT(DISTINCT event_id) as events_attended
      FROM tickets
      WHERE user_id = $1 AND status = 'CONFIRMED'
    `, [userId]);

    return {
      activity: activity.rows,
      preferences: preferences.rows,
      spending: spending.rows[0]
    };
  }

  /**
   * Get platform-wide analytics (admin)
   */
  static async getPlatformAnalytics() {
    // Key metrics
    const metrics = await query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours') as new_users_24h,
        (SELECT COUNT(*) FROM events WHERE created_at > NOW() - INTERVAL '24 hours') as new_events_24h,
        (SELECT COUNT(*) FROM tickets WHERE purchased_at > NOW() - INTERVAL '24 hours') as tickets_24h,
        (SELECT SUM(price_cents) FROM tickets WHERE purchased_at > NOW() - INTERVAL '24 hours' AND status = 'CONFIRMED') as revenue_24h,
        (SELECT COUNT(*) FROM interactions WHERE created_at > NOW() - INTERVAL '1 hour') as interactions_1h,
        (SELECT COUNT(DISTINCT user_id) FROM interactions WHERE created_at > NOW() - INTERVAL '1 hour') as active_users_1h
    `);

    // Growth trends
    const growth = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE type = 'user') as new_users,
        COUNT(*) FILTER (WHERE type = 'event') as new_events,
        COUNT(*) FILTER (WHERE type = 'ticket') as new_tickets
      FROM (
        SELECT created_at, 'user' as type FROM users
        UNION ALL
        SELECT created_at, 'event' as type FROM events
        UNION ALL
        SELECT purchased_at as created_at, 'ticket' as type FROM tickets WHERE status = 'CONFIRMED'
      ) combined
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // Popular categories
    const categories = await query(`
      SELECT 
        category,
        COUNT(*) as event_count,
        SUM(ticket_count) as total_tickets,
        SUM(revenue) as total_revenue
      FROM (
        SELECT 
          e.category,
          e.id,
          COUNT(t.id) as ticket_count,
          SUM(t.price_cents) as revenue
        FROM events e
        LEFT JOIN tickets t ON t.event_id = e.id AND t.status = 'CONFIRMED'
        WHERE e.status = 'PUBLISHED'
        GROUP BY e.category, e.id
      ) event_stats
      GROUP BY category
      ORDER BY total_revenue DESC NULLS LAST
    `);

    // Geographic distribution
    const geographic = await query(`
      SELECT 
        ROUND(location_lat::numeric, 0) as lat_group,
        ROUND(location_lng::numeric, 0) as lng_group,
        COUNT(*) as event_count,
        COUNT(DISTINCT organizer_id) as organizer_count
      FROM events
      WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL
      GROUP BY lat_group, lng_group
      ORDER BY event_count DESC
      LIMIT 20
    `);

    return {
      metrics: metrics.rows[0],
      growth: growth.rows,
      categories: categories.rows,
      geographic: geographic.rows
    };
  }

  // Helper methods
  private static async updateGlobalMetrics(metric: string, value: number) {
    const today = new Date().toISOString().split('T')[0];
    await redis.hincrby(`global:metrics:${today}`, metric, value);
    await redis.expire(`global:metrics:${today}`, 86400 * 7); // Keep for 7 days
  }

  private static async updateUserPreferences(userId: string, eventId: string) {
    const event = await query('SELECT category, price_cents FROM events WHERE id = $1', [eventId]);
    if (event.rows.length > 0) {
      const { category, price_cents } = event.rows[0];
      
      await query(`
        INSERT INTO user_preferences (user_id, category_preferences)
        VALUES ($1, jsonb_build_object($2::text, 1))
        ON CONFLICT (user_id) DO UPDATE
        SET category_preferences = 
          jsonb_set(
            COALESCE(user_preferences.category_preferences, '{}'::jsonb),
            ARRAY[$2::text],
            to_jsonb(COALESCE((user_preferences.category_preferences->$2::text)::int, 0) + 1)
          ),
          updated_at = NOW()
      `, [userId, category]);
    }
  }

  private static async updateUserSession(userId: string, action: string) {
    const sessionKey = `session:${userId}`;
    const session = await redis.get(sessionKey);
    
    if (session) {
      const sessionData = JSON.parse(session);
      sessionData.actions = sessionData.actions || {};
      sessionData.actions[action] = (sessionData.actions[action] || 0) + 1;
      sessionData.lastAction = action;
      sessionData.lastActivity = Date.now();
      await redis.set(sessionKey, JSON.stringify(sessionData), 'EX', 3600);
    } else {
      await redis.set(sessionKey, JSON.stringify({
        userId,
        startTime: Date.now(),
        lastActivity: Date.now(),
        lastAction: action,
        actions: { [action]: 1 }
      }), 'EX', 3600);
    }
  }

  private static async getRealtimeMetrics(eventId: string, timeRange: string) {
    const now = Date.now();
    const ranges = {
      '1h': { bucket: 'minute', count: 60, duration: 60000 },
      '24h': { bucket: 'hour', count: 24, duration: 3600000 },
      '7d': { bucket: 'day', count: 7, duration: 86400000 },
      '30d': { bucket: 'day', count: 30, duration: 86400000 }
    };

    const { bucket, count, duration } = ranges[timeRange as keyof typeof ranges];
    const timeSeries = [];

    for (let i = 0; i < count; i++) {
      const bucketTime = Math.floor((now - (i * duration)) / duration);
      const metrics = await redis.hgetall(`metrics:${eventId}:${bucket}:${bucketTime}`);
      if (Object.keys(metrics).length > 0) {
        timeSeries.push({
          timestamp: bucketTime * duration,
          ...metrics
        });
      }
    }

    const totalMetrics = await redis.hgetall(`metrics:${eventId}:total`);

    return {
      total: totalMetrics,
      timeSeries: timeSeries.reverse()
    };
  }

  private static async getHistoricalAnalytics(eventId: string, timeRange: string) {
    const timeFilters = {
      '1h': "created_at > NOW() - INTERVAL '1 hour'",
      '24h': "created_at > NOW() - INTERVAL '24 hours'",
      '7d': "created_at > NOW() - INTERVAL '7 days'",
      '30d': "created_at > NOW() - INTERVAL '30 days'"
    };

    const result = await query(`
      SELECT 
        action,
        COUNT(*) as count,
        COUNT(DISTINCT user_id) as unique_users,
        DATE_TRUNC('hour', created_at) as hour
      FROM interactions
      WHERE event_id = $1 AND ${timeFilters[timeRange as keyof typeof timeFilters]}
      GROUP BY action, DATE_TRUNC('hour', created_at)
      ORDER BY hour DESC
    `, [eventId]);

    return result.rows;
  }

  private static async getConversionFunnel(eventId: string) {
    const result = await query(`
      SELECT 
        COUNT(DISTINCT user_id) FILTER (WHERE action = 'view') as viewed,
        COUNT(DISTINCT user_id) FILTER (WHERE action = 'click') as clicked,
        COUNT(DISTINCT user_id) FILTER (WHERE action = 'save') as saved,
        COUNT(DISTINCT user_id) FILTER (WHERE action = 'share') as shared,
        COUNT(DISTINCT user_id) FILTER (WHERE action = 'purchase') as purchased
      FROM interactions
      WHERE event_id = $1
    `, [eventId]);

    const funnel = result.rows[0];
    
    return {
      steps: [
        { name: 'Viewed', count: parseInt(funnel.viewed || 0), percentage: 100 },
        { name: 'Clicked', count: parseInt(funnel.clicked || 0), percentage: funnel.viewed > 0 ? (funnel.clicked / funnel.viewed * 100) : 0 },
        { name: 'Saved', count: parseInt(funnel.saved || 0), percentage: funnel.viewed > 0 ? (funnel.saved / funnel.viewed * 100) : 0 },
        { name: 'Shared', count: parseInt(funnel.shared || 0), percentage: funnel.viewed > 0 ? (funnel.shared / funnel.viewed * 100) : 0 },
        { name: 'Purchased', count: parseInt(funnel.purchased || 0), percentage: funnel.viewed > 0 ? (funnel.purchased / funnel.viewed * 100) : 0 }
      ]
    };
  }

  private static async getAudienceInsights(eventId: string) {
    const demographics = await query(`
      SELECT 
        u.role,
        COUNT(DISTINCT i.user_id) as user_count,
        COUNT(*) as interaction_count,
        COUNT(*) FILTER (WHERE i.action = 'purchase') as purchase_count
      FROM interactions i
      JOIN users u ON i.user_id = u.id
      WHERE i.event_id = $1
      GROUP BY u.role
    `, [eventId]);

    const behavior = await query(`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as interactions,
        COUNT(DISTINCT user_id) as unique_users
      FROM interactions
      WHERE event_id = $1 AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `, [eventId]);

    const topUsers = await query(`
      SELECT 
        u.name,
        u.email,
        COUNT(*) as interaction_count,
        MAX(CASE WHEN i.action = 'purchase' THEN 1 ELSE 0 END) as has_purchased
      FROM interactions i
      JOIN users u ON i.user_id = u.id
      WHERE i.event_id = $1
      GROUP BY u.id, u.name, u.email
      ORDER BY interaction_count DESC
      LIMIT 10
    `, [eventId]);

    return {
      demographics: demographics.rows,
      peakHours: behavior.rows,
      topUsers: topUsers.rows
    };
  }

  private static async getPerformanceComparison(eventId: string) {
    // Get event category for comparison
    const eventInfo = await query('SELECT category FROM events WHERE id = $1', [eventId]);
    if (eventInfo.rows.length === 0) return null;

    const category = eventInfo.rows[0].category;

    // Compare with similar events
    const comparison = await query(`
      SELECT 
        AVG(ticket_count) as avg_tickets,
        AVG(revenue) as avg_revenue,
        AVG(interaction_count) as avg_interactions,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ticket_count) as median_tickets,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY revenue) as median_revenue
      FROM (
        SELECT 
          e.id,
          COUNT(DISTINCT t.id) as ticket_count,
          SUM(t.price_cents) as revenue,
          COUNT(DISTINCT i.id) as interaction_count
        FROM events e
        LEFT JOIN tickets t ON t.event_id = e.id AND t.status = 'CONFIRMED'
        LEFT JOIN interactions i ON i.event_id = e.id
        WHERE e.category = $1 AND e.id != $2
        GROUP BY e.id
      ) similar_events
    `, [category, eventId]);

    // Get this event's performance
    const thisEvent = await query(`
      SELECT 
        COUNT(DISTINCT t.id) as ticket_count,
        SUM(t.price_cents) as revenue,
        COUNT(DISTINCT i.id) as interaction_count
      FROM events e
      LEFT JOIN tickets t ON t.event_id = e.id AND t.status = 'CONFIRMED'
      LEFT JOIN interactions i ON i.event_id = e.id
      WHERE e.id = $1
      GROUP BY e.id
    `, [eventId]);

    return {
      category,
      thisEvent: thisEvent.rows[0],
      categoryAverage: comparison.rows[0]
    };
  }
}