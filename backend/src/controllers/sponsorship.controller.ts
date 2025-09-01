import type { Request, Response } from 'express';
import { z } from 'zod';
import { SponsorshipService } from '../services/sponsorship.service.js';

// Validation schemas
export const createDonationSchema = z.object({
  body: z.object({
    event_id: z.string().uuid(),
    amount_cents: z.number().int().min(100),
    message: z.string().max(500).optional(),
    is_anonymous: z.boolean().optional(),
    company_name: z.string().optional(),
    company_logo: z.string().url().optional()
  })
});

export class SponsorshipController {
  static async createDonation(req: Request, res: Response): Promise<void> {
    try {
      const result = await SponsorshipService.createDonation({
        ...req.body,
        user_id: req.user!.id
      });
      res.status(201).json({
        message: 'Sponsorship initiated successfully',
        ...result
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to create sponsorship' 
      });
    }
  }

  static async getEventSponsors(req: Request, res: Response): Promise<void> {
    try {
      if (!req.params.eventId) {
        res.status(400).json({ error: 'Event ID is required' });
        return;
      }
      const { tier, limit } = req.query;
      const result = await SponsorshipService.getEventSponsors(
        req.params.eventId,
        tier as string,
        limit ? parseInt(limit as string) : undefined
      );
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to fetch sponsors' 
      });
    }
  }

  static async getMySponsorships(req: Request, res: Response): Promise<void> {
    try {
      const { status, page, limit } = req.query;
      const result = await SponsorshipService.getMySponsorships(
        req.user!.id,
        status as string,
        page ? parseInt(page as string) : undefined,
        limit ? parseInt(limit as string) : undefined
      );
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to fetch sponsorships' 
      });
    }
  }

  static async getEventSponsorshipDetails(req: Request, res: Response): Promise<void> {
    try {
      if (!req.params.eventId) {
        res.status(400).json({ error: 'Event ID is required' });
        return;
      }
      const result = await SponsorshipService.getEventSponsorshipDetails(
        req.params.eventId,
        req.user!.id,
        req.user!.role,
        {
          start_date: req.query.start_date,
          end_date: req.query.end_date
        }
      );
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to fetch sponsorship details' 
      });
    }
  }

  static async cancelSponsorship(req: Request, res: Response): Promise<void> {
    try {
      if (!req.params.sponsorshipId) {
        res.status(400).json({ error: 'Sponsorship ID is required' });
        return;
      }
      const result = await SponsorshipService.cancelSponsorship(
        req.params.sponsorshipId,
        req.user!.id
      );
      res.json({
        message: 'Sponsorship cancelled successfully',
        ...result
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to cancel sponsorship' 
      });
    }
  }

  static async sendThankYouMessage(req: Request, res: Response): Promise<void> {
    try {
      if (!req.params.eventId) {
        res.status(400).json({ error: 'Event ID is required' });
        return;
      }
      const { message, subject } = req.body;
      const result = await SponsorshipService.sendThankYouMessages(
        req.params.eventId,
        req.user!.id,
        req.user!.role,
        message,
        subject
      );
      res.json({
        message: 'Thank you messages sent successfully',
        ...result
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to send thank you messages' 
      });
    }
  }
}

export const createDonation = SponsorshipController.createDonation;
export const getEventSponsors = SponsorshipController.getEventSponsors;
export const getMySponsorships = SponsorshipController.getMySponsorships;
export const getEventSponsorshipDetails = SponsorshipController.getEventSponsorshipDetails;
export const cancelSponsorship = SponsorshipController.cancelSponsorship;
export const sendThankYouMessage = SponsorshipController.sendThankYouMessage;