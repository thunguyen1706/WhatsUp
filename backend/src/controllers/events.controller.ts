import type { Request, Response } from 'express';
import { z } from 'zod';
import { EventsService } from '../services/events.service.js';
import type{ EventFilters } from '../services/events.service.js';
import { EventRolesService } from '../services/eventRoles.service.js';

// Validation schemas
export const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    category: z.string().max(100).optional(),
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime().optional(),
    location_name: z.string().max(255).optional(),
    location_address: z.string().optional(),
    location_lat: z.number().min(-90).max(90).optional(),
    location_lng: z.number().min(-180).max(180).optional(),
    price_cents: z.number().min(0).optional(),
    capacity: z.number().min(1).optional(),
    image_url: z.string().url().optional(),
    funding_goal_cents: z.number().min(0).optional(),
    funding_deadline: z.string().datetime().optional(),
    min_funding_cents: z.number().min(0).optional(),
    allow_donations: z.boolean().optional(),
    allow_sponsorships: z.boolean().optional()
  })
});

export const updateEventSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    category: z.string().max(100).optional(),
    starts_at: z.string().datetime().optional(),
    ends_at: z.string().datetime().optional(),
    location_name: z.string().max(255).optional(),
    location_address: z.string().optional(),
    location_lat: z.number().min(-90).max(90).optional(),
    location_lng: z.number().min(-180).max(180).optional(),
    price_cents: z.number().min(0).optional(),
    capacity: z.number().min(1).optional(),
    image_url: z.string().url().optional(),
    funding_goal_cents: z.number().min(0).optional(),
    funding_deadline: z.string().datetime().optional(),
    min_funding_cents: z.number().min(0).optional(),
    allow_donations: z.boolean().optional(),
    allow_sponsorships: z.boolean().optional()
  })
});

export class EventsController {
  /**
   * Get all events with filters and pagination
   */
  static async getEvents(req: Request, res: Response): Promise<void> {
    try {
      const filters: EventFilters = {
        ...(req.query.category ? { category: String(req.query.category) } : {}),
        ...(req.query.location ? { location: String(req.query.location) } : {}),
        ...(req.query.date_from ? { date_from: String(req.query.date_from) } : {}),
        ...(req.query.date_to ? { date_to: String(req.query.date_to) } : {}),
        ...(req.query.price_min ? { price_min: Number(req.query.price_min) } : {}),
        ...(req.query.price_max ? { price_max: Number(req.query.price_max) } : {}),
        ...(req.query.search ? { search: String(req.query.search) } : {}),
        ...(req.query.status ? { status: String(req.query.status) } : {}),
        ...(req.query.page ? { page: Number(req.query.page) } : {}),
        ...(req.query.limit ? { limit: Number(req.query.limit) } : {}),
      };

      const result = await EventsService.getEvents(filters, req.user?.id);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to fetch events' 
      });
    }
  }

  /**
   * Get single event
   */
  static async getEvent(req: Request, res: Response): Promise<void> {
    try {
      const { id, eventId } = req.params as { id?: string; eventId?: string };
      const targetId = id || eventId;
      if (!targetId) {
        res.status(400).json({ error: 'id is required' });
        return;
      }
      const event = await EventsService.getEvent(targetId, req.user?.id);
      
      // Record view interaction
      if (req.user) {
        await EventsService.recordInteraction(targetId, req.user.id, 'view');
      }

      res.json({ event });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to fetch event' 
      });
    }
  }

  /**
   * Create new event
   */
  static async createEvent(req: Request, res: Response): Promise<void> {
    try {
      const event = await EventsService.createEvent(req.user!.id, req.body);
      res.status(201).json({ 
        message: 'Event created successfully',
        event 
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to create event' 
      });
    }
  }

  /**
   * Update event
   */
  static async updateEvent(req: Request, res: Response): Promise<void> {
    try {
      const { eventId } = req.params as { eventId: string };
      if (!eventId) {
        res.status(400).json({ error: 'eventId is required' });
        return;
      }
      const event = await EventsService.updateEvent(
        eventId, 
        req.user!.id, 
        req.body
      );
      res.json({ 
        message: 'Event updated successfully',
        event 
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to update event' 
      });
    }
  }

  /**
   * Delete event
   */
  static async deleteEvent(req: Request, res: Response): Promise<void> {
    try {
      const { eventId } = req.params as { eventId: string };
      if (!eventId) {
        res.status(400).json({ error: 'eventId is required' });
        return;
      }
      await EventsService.deleteEvent(eventId, req.user!.id);
      res.json({ message: 'Event deleted successfully' });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to delete event' 
      });
    }
  }

  /**
   * Publish event
   */
  static async publishEvent(req: Request, res: Response): Promise<void> {
    try {
      const { eventId } = req.params as { eventId: string };
      if (!eventId) {
        res.status(400).json({ error: 'eventId is required' });
        return;
      }
      await EventsService.publishEvent(eventId, req.user!.id);
      res.json({ message: 'Event published successfully' });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to publish event' 
      });
    }
  }

  /**
   * Get event dashboard
   */
  static async getEventDashboard(req: Request, res: Response): Promise<void> {
    try {
      const { eventId } = req.params as { eventId: string };
      if (!eventId) {
        res.status(400).json({ error: 'eventId is required' });
        return;
      }
      const dashboard = await EventsService.getEventDashboard(
        eventId, 
        req.user!.id
      );
      res.json(dashboard);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to fetch dashboard' 
      });
    }
  }

  /**
   * Get event participants/team
   */
  static async getParticipants(req: Request, res: Response): Promise<void> {
    try {
      const { eventId } = req.params as { eventId: string };
      if (!eventId) {
        res.status(400).json({ error: 'eventId is required' });
        return;
      }
      const participants = await EventRolesService.getEventParticipants(
        eventId,
        req.user!.id
      );
      res.json({ participants });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to fetch participants' 
      });
    }
  }

  /**
   * Get user's organizing events
   */
  static async getMyOrganizerEvents(req: Request, res: Response): Promise<void> {
    try {
      const events = await EventsService.getOrganizerEvents(req.user!.id);
      res.json({ events });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to fetch organizing events' 
      });
    }
  }

  /**
   * Get user's attending events
   */
  static async getMyAttendingEvents(req: Request, res: Response): Promise<void> {
    try {
      const events = await EventsService.getAttendingEvents(req.user!.id);
      res.json({ events });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to fetch attending events' 
      });
    }
  }

  /**
   * Get popular events
   */
  static async getPopularEvents(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 6;
      const events = await EventsService.getPopularEvents(limit);
      res.json({ events });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to fetch popular events' 
      });
    }
  }

  /**
   * Get events by category
   */
  static async getEventsByCategory(req: Request, res: Response): Promise<void> {
    try {
      const { category } = req.params as { category: string };
      if (!category) {
        res.status(400).json({ error: 'category is required' });
        return;
      }
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const events = await EventsService.getEventsByCategory(category, limit);
      res.json({ events });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to fetch events by category' 
      });
    }
  }

  /**
   * Get event analytics
   */
  static async getEventAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const dateRange = req.query.from && req.query.to 
        ? { from: req.query.from as string, to: req.query.to as string }
        : undefined;

      const { eventId } = req.params as { eventId: string };
      if (!eventId) {
        res.status(400).json({ error: 'eventId is required' });
        return;
      }

      const analytics = await EventsService.getEventAnalytics(
        eventId,
        req.user!.id,
        dateRange
      );
      res.json(analytics);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to fetch analytics' 
      });
    }
  }

  /**
 * Get nearby events based on location
 */
  static async getNearbyEvents(req: Request, res: Response): Promise<void> {
    try {
      const { query } = req;
      const userId = req.user?.id;
    
      // Extract and validate location parameters
      const lat = query.lat ? parseFloat(query.lat as string) : null;
      const lng = query.lng ? parseFloat(query.lng as string) : null;
      const radius = query.radius ? parseFloat(query.radius as string) : 50; // Default 50km
      const limit = query.limit ? parseInt(query.limit as string) : 20;
      const page = query.page ? parseInt(query.page as string) : 1;

    // Validate coordinates if provided
    if ((lat !== null && lng === null) || (lat === null && lng !== null)) {
      res.status(400).json({ error: 'Both lat and lng must be provided together' });
      return;
    }

    if (lat !== null && (lat < -90 || lat > 90)) {
      res.status(400).json({ error: 'Latitude must be between -90 and 90' });
      return;
    }

    if (lng !== null && (lng < -180 || lng > 180)) {
      res.status(400).json({ error: 'Longitude must be between -180 and 180' });
      return;
    }

    const filters = {
      status: 'PUBLISHED' as const,
      limit,
      page,
      // Add location filters if provided
      ...(lat !== null && lng !== null && { lat, lng, radius }),
      // Add other optional filters
      ...(query.category && { category: String(query.category) }),
      ...(query.search && { search: String(query.search) }),
      ...(query.price_min && { price_min: Number(query.price_min) }),
      ...(query.price_max && { price_max: Number(query.price_max) })
    };

    const result = await EventsService.getNearbyEvents(filters, userId);
    
    res.json(result);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ 
      error: error.message || 'Failed to fetch nearby events' 
    });
  }
}
}

// Export individual functions for route compatibility
export const getEvents = EventsController.getEvents;
export const getEvent = EventsController.getEvent;
export const createEvent = EventsController.createEvent;
export const updateEvent = EventsController.updateEvent;
export const deleteEvent = EventsController.deleteEvent;
export const publishEvent = EventsController.publishEvent;
export const getEventDashboard = EventsController.getEventDashboard;
export const getParticipants = EventsController.getParticipants;
export const getMyOrganizerEvents = EventsController.getMyOrganizerEvents;
export const getMyAttendingEvents = EventsController.getMyAttendingEvents;
export const getPopularEvents = EventsController.getPopularEvents;
export const getEventsByCategory = EventsController.getEventsByCategory;
export const getEventAnalytics = EventsController.getEventAnalytics;
export const getNearbyEvents = EventsController.getNearbyEvents;