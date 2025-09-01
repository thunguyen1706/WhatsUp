import type { Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service.js';

export class AnalyticsController {
  static async getEventAnalytics(req: Request, res: Response) {
    try {
      const { eventId } = req.params;
      const { timeRange = '24h' } = req.query;

      if (!eventId) {
        res.status(400).json({ error: 'Event ID is required' });
        return;
      }

      const analytics = await AnalyticsService.getEventAnalytics(
        eventId,
        timeRange as any
      );

      res.json(analytics);
    } catch (error) {
      console.error('Get event analytics error:', error);
      res.status(500).json({ error: 'Failed to get analytics' });
    }
  }

  static async getOrganizerDashboard(req: Request, res: Response) {
    try {
      const organizerId = typeof req.query.organizer_id === 'string' ? req.query.organizer_id : req.user!.id;

      const dashboard = await AnalyticsService.getOrganizerDashboard(
        organizerId as string
      );

      res.json(dashboard);
    } catch (error) {
      console.error('Get dashboard error:', error);
      res.status(500).json({ error: 'Failed to get dashboard' });
    }
  }

  static async trackBehavior(req: Request, res: Response) {
    try {
      const { event_id, action, metadata } = req.body;

      await AnalyticsService.trackUserBehavior(
        req.user!.id,
        event_id,
        action,
        metadata
      );

      res.json({ success: true });
    } catch (error) {
      console.error('Track behavior error:', error);
      res.status(500).json({ error: 'Failed to track behavior' });
    }
  }
}