import type { Request, Response } from 'express';
import { AdminService } from '../services/admin.service.js';
import { CacheService } from '../services/cache.service.js';
import { query } from '../db.js';

export class AdminController {
  static async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const result = await AdminService.getAllUsers({
        ...(req.query.role && { role: req.query.role as string }),
        ...(req.query.email && { email: req.query.email as string }),
        ...(req.query.search && { search: req.query.search as string }),
        ...(req.query.page && { page: parseInt(req.query.page as string) }),
        ...(req.query.limit && { limit: parseInt(req.query.limit as string) })
      });
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to fetch users' 
      });
    }
  }

  static async updateUserRole(req: Request, res: Response): Promise<void> {
    try {
      if (!req.params.id) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }
      const result = await AdminService.updateUserRole(
        req.user!.id,
        req.params.id,
        req.body.role
      );
      res.json({
        message: 'User role updated successfully',
        ...result
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to update user role' 
      });
    }
  }

  static async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      if (!req.params.id) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }
      const result = await AdminService.deleteUser(
        req.user!.id,
        req.params.id
      );
      res.json({
        message: 'User deleted successfully',
        ...result
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to delete user' 
      });
    }
  }

  static async getOverview(req: Request, res: Response): Promise<void> {
    try {
      const overview = await AdminService.getSystemOverview();
      res.json(overview);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to fetch overview' 
      });
    }
  }

  static async getEventAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      if (!req.params.id) {
        res.status(400).json({ error: 'Event ID is required' });
        return;
      }
      const analytics = await AdminService.getEventAnalytics(req.params.id, days);
      res.json(analytics);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to fetch event analytics' 
      });
    }
  }

  static async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const result = await AdminService.getAuditLogs({
        ...(req.query.user_id && { user_id: req.query.user_id as string }),
        ...(req.query.action && { action: req.query.action as string }),
        ...(req.query.resource_type && { resource_type: req.query.resource_type as string }),
        ...(req.query.start_date && { start_date: req.query.start_date as string }),
        ...(req.query.end_date && { end_date: req.query.end_date as string }),
        ...(req.query.page && { page: parseInt(req.query.page as string) }),
        ...(req.query.limit && { limit: parseInt(req.query.limit as string) })
      });
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to fetch audit logs' 
      });
    }
  }

  static async clearCache(req: Request, res: Response): Promise<void> {
    try {
      const { pattern } = req.body;
      
      if (pattern) {
        await CacheService.invalidatePattern(pattern);
        res.json({ 
          message: `Cache cleared for pattern: ${pattern}`
        });
      } else {
        await CacheService.flush();
        res.json({ 
          message: 'All cache cleared successfully' 
        });
      }

      // Log audit
      await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, changes)
         VALUES ($1, 'CLEAR_CACHE', 'system', $2::jsonb)`,
        [req.user!.id, JSON.stringify({ pattern: pattern || 'all' })]
      );
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to clear cache' 
      });
    }
  }

  static async getSystemHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = await AdminService.getSystemHealth();
      res.json(health);
    } catch (error: any) {
      res.status(503).json({
        status: 'unhealthy',
        error: error.message || 'System health check failed'
      });
    }
  }
}

export const getAllUsers = AdminController.getAllUsers;
export const updateUserRole = AdminController.updateUserRole;
export const deleteUser = AdminController.deleteUser;
export const getOverview = AdminController.getOverview;
export const getEventAnalytics = AdminController.getEventAnalytics;
export const getAuditLogs = AdminController.getAuditLogs;
export const clearCache = AdminController.clearCache;
export const getSystemHealth = AdminController.getSystemHealth;