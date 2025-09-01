import { Redis } from 'ioredis';
import { query } from '../db.js';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export class TrendingService {
  /**
   * Track event interactions in Redis for real-time trending
   */
  static async trackInteraction(eventId: string, action: string, weight: number = 1) {
    const now = Date.now();
    const windowKey = `trending:${Math.floor(now / (15 * 60 * 1000))}`; // 15-min windows
    
    // Different weights for different actions
    const actionWeights = {
      view: 1,
      click: 2,
      save: 3,
      share: 4,
      purchase: 10
    };
    
    const finalWeight = (actionWeights[action as keyof typeof actionWeights] || 1) * weight;
    
    // Add to sorted sets with different time windows
    await Promise.all([
      redis.zincrby(`trending:15m`, finalWeight, eventId),
      redis.zincrby(`trending:1h`, finalWeight, eventId),
      redis.zincrby(`trending:24h`, finalWeight, eventId),
      redis.zincrby(windowKey, finalWeight, eventId)
    ]);
    
    // Set expiration
    await redis.expire(`trending:15m`, 900); // 15 minutes
    await redis.expire(`trending:1h`, 3600); // 1 hour
    await redis.expire(`trending:24h`, 86400); // 24 hours
    await redis.expire(windowKey, 1800); // 30 minutes
  }

  /**
   * Get trending events based on recent interactions
   */
  static async getTrendingEvents(
    location?: { lat: number; lng: number; radius_km: number },
    limit: number = 10
  ) {
    // Get trending event IDs from Redis
    const trendingIds = await redis.zrevrange('trending:1h', 0, limit * 2, 'WITHSCORES');
    
    if (trendingIds.length === 0) {
      // Fallback to database if no trending data
      return this.getFallbackTrending(location, limit);
    }

    // Parse Redis results
    const eventScores = new Map<string, number>();
    for (let i = 0; i < trendingIds.length; i += 2) {
      const eventId = trendingIds[i];
      const score = trendingIds[i + 1];
      if (eventId && score) {
        eventScores.set(eventId, parseFloat(score));
      }
    }

    // Get event details with location filtering
    let query_text = `
      SELECT 
        e.*,
        u.name as organizer_name,
        COUNT(DISTINCT t.id) as tickets_sold,
        ${location ? `ST_Distance(
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
          ST_SetSRID(ST_MakePoint(e.location_lng, e.location_lat), 4326)::geography
        ) / 1000 as distance_km` : '0 as distance_km'}
      FROM events e
      JOIN users u ON e.organizer_id = u.id
      LEFT JOIN tickets t ON t.event_id = e.id AND t.status = 'CONFIRMED'
      WHERE e.id = ANY($1::uuid[])
        AND e.status = 'PUBLISHED'
        AND e.starts_at > NOW()
        ${location ? `AND ST_DWithin(
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
          ST_SetSRID(ST_MakePoint(e.location_lng, e.location_lat), 4326)::geography,
          $4 * 1000
        )` : ''}
      GROUP BY e.id, u.name
    `;

    const params = location 
      ? [Array.from(eventScores.keys()), location.lng, location.lat, location.radius_km]
      : [Array.from(eventScores.keys())];

    const events = await query(query_text, params);

    // Combine with trending scores and sort
    const rankedEvents = events.rows.map(event => ({
      ...event,
      trending_score: eventScores.get(event.id) || 0,
      trending_rank: Array.from(eventScores.keys()).indexOf(event.id) + 1
    }));

    rankedEvents.sort((a, b) => b.trending_score - a.trending_score);

    return rankedEvents.slice(0, limit);
  }

  /**
   * Fallback trending based on database interactions
   */
  private static async getFallbackTrending(
    location?: { lat: number; lng: number; radius_km: number },
    limit: number = 10
  ) {
    const query_text = `
      SELECT 
        e.*,
        u.name as organizer_name,
        COUNT(DISTINCT i.id) as interaction_count,
        COUNT(DISTINCT t.id) as tickets_sold,
        ${location ? `ST_Distance(
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          ST_SetSRID(ST_MakePoint(e.location_lng, e.location_lat), 4326)::geography
        ) / 1000 as distance_km` : '0 as distance_km'}
      FROM events e
      JOIN users u ON e.organizer_id = u.id
      LEFT JOIN interactions i ON i.event_id = e.id 
        AND i.created_at > NOW() - INTERVAL '24 hours'
      LEFT JOIN tickets t ON t.event_id = e.id AND t.status = 'CONFIRMED'
      WHERE e.status = 'PUBLISHED'
        AND e.starts_at > NOW()
        ${location ? `AND ST_DWithin(
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          ST_SetSRID(ST_MakePoint(e.location_lng, e.location_lat), 4326)::geography,
          $3 * 1000
        )` : ''}
      GROUP BY e.id, u.name
      ORDER BY interaction_count DESC, tickets_sold DESC
      LIMIT $${location ? 4 : 1}
    `;

    const params = location 
      ? [location.lng, location.lat, location.radius_km, limit]
      : [limit];

    const result = await query(query_text, params);
    return result.rows;
  }
}