import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { LearningToRankService } from '../services/ltr.service.js';
import { TrendingService } from '../services/trending.service.js';
import { cache } from '../redis.js';

// Validation schemas
export const getRecommendationsSchema = z.object({
  query: z.object({
    type: z.enum(['purchase', 'interest', 'trending', 'personalized']).default('personalized'),
    limit: z.coerce.number().min(1).max(50).default(10),
    category: z.string().optional(),
    lat: z.coerce.number().optional(),
    lng: z.coerce.number().optional(),
    radius_km: z.coerce.number().default(50)
  })
});

export class RecommendationsController {
  /**
   * Get personalized recommendations using LTR
   */
  static async getPersonalizedRecommendations(req: Request, res: Response) {
    try {
      const { type, limit, category, lat, lng, radius_km } = req.query as any;
      const userId = req.user!.id;

      // Check cache first
      const cacheKey = `recommendations:${userId}:${type}:${limit}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      let recommendations;

      switch (type) {
        case 'purchase':
          // Events most likely to result in ticket purchase
          recommendations = await LearningToRankService.getTopRecommendationsForPurchase(
            userId, 
            limit,
            { category }
          );
          break;

        case 'interest':
          // Events likely to be saved/wishlisted
          recommendations = await LearningToRankService.getTopRecommendationsForInterest(
            userId,
            limit
          );
          break;

        case 'trending':
          // Trending events in the area
          recommendations = await TrendingService.getTrendingEvents(
            { lat, lng, radius_km },
            limit
          );
          break;

        case 'personalized':
        default:
          // Blend of different signals
          const [purchase, trending, interest] = await Promise.all([
            LearningToRankService.getTopRecommendationsForPurchase(userId, Math.floor(limit * 0.5)),
            TrendingService.getTrendingEvents({ lat, lng, radius_km }, Math.floor(limit * 0.3)),
            LearningToRankService.getTopRecommendationsForInterest(userId, Math.floor(limit * 0.2))
          ]);

          // Deduplicate and combine
          const seen = new Set();
          recommendations = [];
          
          for (const events of [purchase, trending, interest]) {
            for (const event of events) {
              if (!seen.has(event.id)) {
                seen.add(event.id);
                recommendations.push(event);
              }
            }
          }

          recommendations = recommendations.slice(0, limit);
          break;
      }

      // Cache for 5 minutes
      await cache.set(cacheKey, { recommendations }, 300);

      res.json({ 
        recommendations,
        type,
        count: recommendations.length
      });
    } catch (error) {
      console.error('Get recommendations error:', error);
      res.status(500).json({ error: 'Failed to get recommendations' });
    }
  }

  /**
   * Train/retrain the LTR model (Admin only)
   */
  static async trainModel(req: Request, res: Response) {
    try {
      const result = await LearningToRankService.trainPointwiseLTR();
      
      res.json({
        message: 'Model training initiated',
        ...result
      });
    } catch (error) {
      console.error('Train model error:', error);
      res.status(500).json({ error: 'Failed to train model' });
    }
  }

  /**
   * Get recommendation metrics and performance
   */
  static async getMetrics(req: Request, res: Response) {
    try {
      const metrics = await query(`
        SELECT 
          COUNT(DISTINCT user_id) as users_with_features,
          COUNT(*) as total_features,
          AVG(relevance_label) as avg_relevance,
          COUNT(*) FILTER (WHERE relevance_label = 2) as purchases,
          COUNT(*) FILTER (WHERE relevance_label = 1) as interests,
          COUNT(*) FILTER (WHERE relevance_label = 0) as views
        FROM recommendation_features
        WHERE query_day >= CURRENT_DATE - INTERVAL '7 days'
      `);

      res.json({
        metrics: metrics.rows[0],
        model_version: 'v1.0.0',
        last_training: await cache.get('ltr:model:v1.0.0')
      });
    } catch (error) {
      console.error('Get metrics error:', error);
      res.status(500).json({ error: 'Failed to get metrics' });
    }
  }
}