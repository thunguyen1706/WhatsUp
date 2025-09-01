import { Router } from 'express';
import { verifyToken, optionalAuth, requireEventRole } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import * as eventsController from '../controllers/events.controller.js';

const router = Router();

// Public routes
router.get('/', optionalAuth, eventsController.getEvents);
router.get('/nearby', optionalAuth, eventsController.getNearbyEvents);
router.get('/popular', eventsController.getPopularEvents);
router.get('/category/:category', eventsController.getEventsByCategory);

router.post('/', 
  verifyToken, 
  validateBody(eventsController.createEventSchema.shape.body), 
  eventsController.createEvent
);

// Event-specific role routes
router.put('/:eventId', 
  verifyToken, 
  requireEventRole(['ORGANIZER', 'CO_ORGANIZER']),
  validateBody(eventsController.updateEventSchema.shape.body),
  eventsController.updateEvent
);

router.delete('/:eventId', 
  verifyToken, 
  requireEventRole(['ORGANIZER']), 
  eventsController.deleteEvent
);

router.post('/:eventId/publish', 
  verifyToken, 
  requireEventRole(['ORGANIZER']), 
  eventsController.publishEvent
);

// Dashboard routes 
router.get('/:eventId/dashboard', 
  verifyToken, 
  requireEventRole(['ORGANIZER', 'CO_ORGANIZER']), 
  eventsController.getEventDashboard
);

router.get('/:eventId/participants', 
  verifyToken, 
  requireEventRole(['ORGANIZER', 'CO_ORGANIZER']), 
  eventsController.getParticipants
);

router.get('/:eventId/analytics', 
  verifyToken, 
  requireEventRole(['ORGANIZER', 'CO_ORGANIZER']), 
  eventsController.getEventAnalytics
);

// User's events
router.get('/my/organizing', verifyToken, eventsController.getMyOrganizerEvents);
router.get('/my/attending', verifyToken, eventsController.getMyAttendingEvents);

// Single event routes 
router.get('/by-id/:eventId', optionalAuth, eventsController.getEvent);
router.get('/:id', optionalAuth, eventsController.getEvent);

export default router;