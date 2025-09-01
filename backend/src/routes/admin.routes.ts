import { Router } from 'express';
import { verifyToken, requireAdmin } from '../middleware/auth.middleware.js';
import { 
  getAllUsers, 
  updateUserRole, 
  deleteUser, 
  getOverview, 
  getEventAnalytics, 
  getAuditLogs, 
  clearCache, 
  getSystemHealth 
} from '../controllers/admin.controller.js';

const router = Router();

// All routes require admin role
router.use(verifyToken, requireAdmin);

// User management
router.get('/users', getAllUsers);
router.put('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);

// Analytics
router.get('/analytics/overview', getOverview);
router.get('/analytics/events/:id', getEventAnalytics);

// Audit logs
router.get('/audit-logs', getAuditLogs);

// System management
router.post('/cache/clear', clearCache);
router.get('/system/health', getSystemHealth);

export default router;