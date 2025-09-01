import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware.js';
import { AnalyticsController } from '../controllers/analytics.controller.js';

const router = Router();

// Get event analytics
router.get(
  '/events/:eventId',
  verifyToken,
  AnalyticsController.getEventAnalytics
);

// Get organizer dashboard
router.get(
  '/dashboard',
  verifyToken,
  AnalyticsController.getOrganizerDashboard
);

// Track user behavior
router.post(
  '/track',
  verifyToken,
  AnalyticsController.trackBehavior
);

export default router;