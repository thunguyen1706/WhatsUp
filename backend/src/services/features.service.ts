import { query } from '../db.js';
import { cache } from '../redis.js';

export class FeatureEngineeringService {
  /**
   * Generate features for Learning-to-Rank based on user sessions
   */
  static async generateUserEventFeatures(userId: string, startDate: Date, endDate: Date) {
    // Get user session data with event interactions
    const sessionData = await query(`
      WITH EventBrowsingSessions AS (
        SELECT 
          i.user_id,
          i.event_id,
          e.price_cents,
          e.capacity,
          e.category,
          e.starts_at,
          i.action,
          i.created_at as interaction_time,
          -- Session window (4 hours like e-commerce example)
          LAG(i.created_at) OVER (
            PARTITION BY i.user_id 
            ORDER BY i.created_at
          ) as prev_interaction,
          CASE 
            WHEN LAG(i.created_at) OVER (PARTITION BY i.user_id ORDER BY i.created_at) IS NULL 
              OR i.created_at - LAG(i.created_at) OVER (PARTITION BY i.user_id ORDER BY i.created_at) > INTERVAL '4 hours'
            THEN 1 
            ELSE 0 
          END as new_session
        FROM interactions i
        JOIN events e ON i.event_id = e.id
        WHERE i.user_id = $1
          AND i.created_at BETWEEN $2 AND $3
      ),
      SessionAggregates AS (
        SELECT 
          user_id,
          event_id,
          DATE(interaction_time) as query_day,
          
          -- Relevance label (like e-commerce)
          MAX(CASE 
            WHEN action = 'purchase' THEN 2
            WHEN action IN ('save', 'click') THEN 1
            ELSE 0
          END) as relevance_label,
          
          -- Event features
          AVG(price_cents) as avg_price,
          AVG(capacity) as avg_capacity,
          
          -- Behavior counts
          COUNT(*) FILTER (WHERE action = 'view') as view_count,
          COUNT(*) FILTER (WHERE action = 'click') as click_count,
          COUNT(*) FILTER (WHERE action = 'save') as save_count,
          
          -- Interest gradations (similar to color/size in e-commerce)
          COUNT(*) FILTER (WHERE action IN ('save', 'share')) as interest_signal_1,
          COUNT(*) FILTER (WHERE action = 'click') as interest_signal_2,
          
          MAX(interaction_time) as last_interaction
        FROM EventBrowsingSessions
        GROUP BY user_id, event_id, DATE(interaction_time)
      )
      SELECT * FROM SessionAggregates
    `, [userId, startDate, endDate]);

    return sessionData.rows;
  }

  /**
   * Normalize features for ML model
   */
  static normalizeFeatures(features: any) {
    return {
      price_normalized: features.avg_price / 100000, // Normalize to 0-1 range
      capacity_normalized: Math.min(features.avg_capacity / 5000, 1),
      view_count: features.view_count,
      click_count: features.click_count,
      interest_signal_1: features.interest_signal_1,
      interest_signal_2: features.interest_signal_2,
      relevance_label: features.relevance_label
    };
  }

  /**
   * Store features for training
   */
  static async storeFeatures(userId: string, eventId: string, features: any) {
    const normalized = this.normalizeFeatures(features);
    
    await query(`
      INSERT INTO recommendation_features (
        user_id, event_id, query_day,
        price_normalized, capacity_normalized,
        view_count, click_count,
        color_gradation, size_gradation,
        relevance_label, last_interaction
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (user_id, event_id, query_day) 
      DO UPDATE SET
        price_normalized = EXCLUDED.price_normalized,
        capacity_normalized = EXCLUDED.capacity_normalized,
        view_count = EXCLUDED.view_count,
        click_count = EXCLUDED.click_count,
        color_gradation = EXCLUDED.color_gradation,
        size_gradation = EXCLUDED.size_gradation,
        relevance_label = EXCLUDED.relevance_label,
        last_interaction = EXCLUDED.last_interaction
    `, [
      userId, eventId, features.query_day,
      normalized.price_normalized, normalized.capacity_normalized,
      normalized.view_count, normalized.click_count,
      normalized.interest_signal_1, normalized.interest_signal_2,
      normalized.relevance_label, new Date()
    ]);
  }
}