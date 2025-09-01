import type { Request, Response } from 'express';
import { z } from 'zod';
import { TicketsService } from '../services/tickets.service.js';

export const createTicketSchema = z.object({
  body: z.object({
    event_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(10).default(1),
    tier_type: z.enum(['standard', 'vip', 'premium']).optional()
  })
});

export class TicketsController {
  static async createTicket(req: Request, res: Response): Promise<void> {
    try {
      const result = await TicketsService.createTicket({
        ...req.body,
        user_id: req.user!.id
      });
      res.status(201).json({
        message: 'Ticket purchase initiated',
        ...result
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to create ticket' 
      });
    }
  }

  static async getUserTickets(req: Request, res: Response): Promise<void> {
    try {
      const tickets = await TicketsService.getUserTickets(req.user!.id);
      res.json({ tickets });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to fetch tickets' 
      });
    }
  }

  static async getTicket(req: Request, res: Response): Promise<void> {
    try {
      if (!req.params.id) {
        res.status(400).json({ error: 'Ticket ID is required' });
        return;
      }
      const ticket = await TicketsService.getTicket(
        req.params.id,
        req.user!.id
      );
      res.json({ ticket });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to fetch ticket' 
      });
    }
  }

  static async cancelTicket(req: Request, res: Response): Promise<void> {
    try {
      if (!req.params.id) {
        res.status(400).json({ error: 'Ticket ID is required' });
        return;
      }
      const ticket = await TicketsService.cancelTicket(
        req.params.id,
        req.user!.id
      );
      res.json({
        message: 'Ticket cancelled successfully',
        ticket
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to cancel ticket' 
      });
    }
  }
}

// Export for route compatibility
export const createTicket = TicketsController.createTicket;
export const getUserTickets = TicketsController.getUserTickets;
export const getTicket = TicketsController.getTicket;
export const cancelTicket = TicketsController.cancelTicket;