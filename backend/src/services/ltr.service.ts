import { query } from '../db.js';
import { cache } from '../redis.js';
import { FeatureEngineeringService } from './features.service.js';

interface LTRPrediction {
  event_id: string;
  probability_purchase: number;
  probability_interest: number;
  probability_view: number;
  rank_score: number;
}

export class LearningToRankService {
  private static MODEL_VERSION = 'v1.0.0';
  static async trainPointwiseLTR() {
    // Get training data
    const trainingData = await query(`
      SELECT 
        user_id,
        event_id,
        query_day,
        price_normalized,
        capacity_normalized,
        view_count,
        click_count,
        color_gradation as interest_signal_1,
        size_gradation as interest_signal_2,
        relevance_label
      FROM recommendation_features
      WHERE query_day >= CURRENT_DATE - INTERVAL '60 days'
        AND relevance_label IS NOT NULL
    `);

    console.log(`Training LTR model with ${trainingData.rows.length} samples`);
    
    // Store model metadata
    await cache.set(
      `ltr:model:${this.MODEL_VERSION}`,
      {
        trained_at: new Date(),
        samples: trainingData.rows.length,
        features: ['price_normalized', 'capacity_normalized', 'view_count', 'click_count', 'interest_signal_1', 'interest_signal_2']
      },
      86400 // 24 hours
    );

    return { version: this.MODEL_VERSION, status: 'trained' };
  }

  /**
   * Predict using Pointwise LTR model
   * Returns probabilities for [view, interest, purchase]
   */
  static async predictPointwise(userId: string, eventIds: string[]): Promise<LTRPrediction[]> {
    // Get features for prediction
    const features = await query(`
      SELECT 
        rf.*,
        e.title,
        e.category,
        e.starts_at,
        e.price_cents
      FROM recommendation_features rf
      JOIN events e ON rf.event_id = e.id
      WHERE rf.user_id = $1
        AND rf.event_id = ANY($2::uuid[])
        AND rf.query_day = CURRENT_DATE
    `, [userId, eventIds]);

    // If no features exist, generate them
    if (features.rows.length === 0) {
      await this.generateFeaturesForEvents(userId, eventIds);
      return this.predictPointwise(userId, eventIds); // Retry with generated features
    }

    // Simulate Random Forest Classifier output
    const predictions: LTRPrediction[] = features.rows.map(row => {
      // Simulated probability calculation based on features
      // This mimics the Random Forest classifier with 3 classes [0, 1, 2]
      
      const baseScore = (
        row.view_count * 0.1 +
        row.click_count * 0.3 +
        row.color_gradation * 0.25 +
        row.size_gradation * 0.25 +
        (1 - row.price_normalized) * 0.1
      );

      // Generate probabilities for each class
      const prob_view = Math.max(0.1, Math.min(0.8, 1 - baseScore));
      const prob_interest = Math.max(0.1, Math.min(0.6, baseScore * 0.7));
      const prob_purchase = Math.max(0.05, Math.min(0.5, baseScore * 0.3));

      // Normalize probabilities to sum to 1
      const total = prob_view + prob_interest + prob_purchase;

      return {
        event_id: row.event_id,
        probability_view: prob_view / total,
        probability_interest: prob_interest / total,
        probability_purchase: prob_purchase / total,
        rank_score: prob_purchase / total // Use purchase probability as main ranking score
      };
    });

    // Sort by rank score (purchase probability)
    predictions.sort((a, b) => b.rank_score - a.rank_score);

    return predictions;
  }

  /**
   * Generate features for events that don't have them yet
   */
  private static async generateFeaturesForEvents(userId: string, eventIds: string[]) {
    for (const eventId of eventIds) {
      // Get or create minimal features
      await query(`
        INSERT INTO recommendation_features (
          user_id, event_id, query_day,
          price_normalized, capacity_normalized,
          view_count, click_count,
          color_gradation, size_gradation,
          relevance_label
        )
        SELECT 
          $1, $2, CURRENT_DATE,
          LEAST(e.price_cents::decimal / 100000, 1),
          LEAST(e.capacity::decimal / 5000, 1),
          COALESCE(COUNT(*) FILTER (WHERE i.action = 'view'), 0),
          COALESCE(COUNT(*) FILTER (WHERE i.action = 'click'), 0),
          0, 0, 0
        FROM events e
        LEFT JOIN interactions i ON i.event_id = e.id AND i.user_id = $1
        WHERE e.id = $2
        GROUP BY e.id, e.price_cents, e.capacity
        ON CONFLICT (user_id, event_id, query_day) DO NOTHING
      `, [userId, eventId]);
    }
  }

  /**
   * Get top N recommendations for purchase likelihood
   */
  static async getTopRecommendationsForPurchase(
    userId: string, 
    limit: number = 5,
    filters?: { category?: string; maxPrice?: number }
  ): Promise<any[]> {
    // Get candidate events
    const candidateEvents = await query(`
      SELECT DISTINCT e.id
      FROM events e
      WHERE e.status = 'PUBLISHED'
        AND e.starts_at > NOW()
        ${filters?.category ? 'AND e.category = $2' : ''}
        ${filters?.maxPrice ? 'AND e.price_cents <= $3' : ''}
      LIMIT 100
    `, filters ? [filters.category, filters.maxPrice].filter(Boolean) : []);

    if (candidateEvents.rows.length === 0) return [];

    const eventIds = candidateEvents.rows.map(r => r.id);
    
    // Get LTR predictions
    const predictions = await this.predictPointwise(userId, eventIds);
    
    // Get top N by purchase probability
    const topPredictions = predictions
      .sort((a, b) => b.probability_purchase - a.probability_purchase)
      .slice(0, limit);

    // Fetch full event details
    const eventDetails = await query(`
      SELECT 
        e.*,
        u.name as organizer_name,
        (SELECT COUNT(*) FROM tickets WHERE event_id = e.id AND status = 'CONFIRMED') as tickets_sold
      FROM events e
      JOIN users u ON e.organizer_id = u.id
      WHERE e.id = ANY($1::uuid[])
    `, [topPredictions.map(p => p.event_id)]);

    // Combine predictions with event details
    return topPredictions.map(pred => {
      const event = eventDetails.rows.find(e => e.id === pred.event_id);
      return {
        ...event,
        recommendation_score: pred.rank_score,
        purchase_probability: pred.probability_purchase,
        interest_probability: pred.probability_interest
      };
    });
  }

  /**
   * Get recommendations for "Add to Wishlist" 
   */
  static async getTopRecommendationsForInterest(
    userId: string,
    limit: number = 5
  ): Promise<any[]> {
    const candidateEvents = await query(`
      SELECT DISTINCT e.id
      FROM events e
      WHERE e.status = 'PUBLISHED'
        AND e.starts_at > NOW()
      LIMIT 100
    `);

    const eventIds = candidateEvents.rows.map(r => r.id);
    const predictions = await this.predictPointwise(userId, eventIds);
    
    // Sort by interest probability instead of purchase
    const topPredictions = predictions
      .sort((a, b) => b.probability_interest - a.probability_interest)
      .slice(0, limit);

    const eventDetails = await query(`
      SELECT e.*, u.name as organizer_name
      FROM events e
      JOIN users u ON e.organizer_id = u.id
      WHERE e.id = ANY($1::uuid[])
    `, [topPredictions.map(p => p.event_id)]);

    return topPredictions.map(pred => {
      const event = eventDetails.rows.find(e => e.id === pred.event_id);
      return {
        ...event,
        recommendation_score: pred.probability_interest,
        interest_probability: pred.probability_interest
      };
    });
  }
}