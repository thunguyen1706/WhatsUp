import { Router } from 'express';
import { verifyToken, optionalAuth, requireAdmin } from '../middleware/auth.middleware.js';
import { RecommendationsController } from '../controllers/recommendations.controller.js';
import { validate } from '../middleware/validation.middleware.js';
import { getRecommendationsSchema } from '../controllers/recommendations.controller.js';

const router = Router();

// Get personalized recommendations (requires auth for personalization)
router.get(
  '/',
  verifyToken,
  validate(getRecommendationsSchema),
  RecommendationsController.getPersonalizedRecommendations
);

// Train model (admin only)
router.post(
  '/train',
  verifyToken,
  requireAdmin,
  RecommendationsController.trainModel
);

// Get recommendation metrics
router.get(
  '/metrics',
  verifyToken,
  requireAdmin,
  RecommendationsController.getMetrics
);

export default router;