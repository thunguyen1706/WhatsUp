import { Router } from 'express';
import { verifyToken, requireEventRole } from '../middleware/auth.middleware.js';
import { TicketsService } from '../services/tickets.service.js';
const router = Router();

// User ticket routes
router.post('/purchase', verifyToken, async (req, res) => {
  try {
    const { event_id, quantity = 1 } = req.body;
    const result = await TicketsService.purchaseTicket(req.user!.id, event_id, quantity);
    res.status(201).json({ 
      message: 'Ticket purchase initiated',
      ...result 
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ 
      error: error.message || 'Failed to purchase ticket' 
    });
  }
});

router.get('/my', verifyToken, async (req, res) => {
  try {
    const tickets = await TicketsService.getUserTickets(req.user!.id);
    res.json({ tickets });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ 
      error: error.message || 'Failed to fetch tickets' 
    });
  }
});

router.put('/:ticketId/cancel', verifyToken, async (req, res) => {
  try {
    const { ticketId } = req.params as { ticketId: string };
    if (!ticketId) {
      res.status(400).json({ error: 'ticketId is required' });
      return;
    }
    await TicketsService.cancelTicket(ticketId, req.user!.id);
    res.json({ message: 'Ticket cancelled successfully' });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ 
      error: error.message || 'Failed to cancel ticket' 
    });
  }
});

// Organizer routes
router.get('/event/:eventId', 
  verifyToken, 
  requireEventRole(['ORGANIZER', 'CO_ORGANIZER']), 
  async (req, res) => {
    try {
      const { eventId } = req.params as { eventId: string };
      if (!eventId) {
        res.status(400).json({ error: 'eventId is required' });
        return;
      }
      const result = await TicketsService.getEventTicketSales(eventId, req.user!.id);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to fetch ticket sales' 
      });
    }
  }
);

export default router;