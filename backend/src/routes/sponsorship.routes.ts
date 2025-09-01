import { Router } from 'express';
import { validateBody } from '../middleware/validation.middleware.js';
import { verifyToken, requireEventRole } from '../middleware/auth.middleware.js';
import * as sponsorshipController from '../controllers/sponsorship.controller.js';

const router = Router();

// Public: View sponsorships for an event
router.get('/event/:eventId', sponsorshipController.getEventSponsors);

// Sponsors can create donations
router.post(
  '/donate',
  verifyToken,
  sponsorshipController.createDonation
);

// Users can view their sponsorships
router.get('/my-sponsorships', verifyToken, sponsorshipController.getMySponsorships);

// Organizers can view sponsorships for their events
router.get(
  '/organizer/events/:eventId',
  verifyToken,
  requireEventRole(['ORGANIZER', 'CO_ORGANIZER']),
  sponsorshipController.getEventSponsorshipDetails
);

export default router;