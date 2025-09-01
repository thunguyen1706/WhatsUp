import { Router } from 'express';
import { verifyToken, requireEventRole } from '../middleware/auth.middleware.js';
import { EventRolesService } from '../services/eventRoles.service.js';
const router = Router();

// Assign role to user (organizers only)
router.post('/:eventId/assign', 
  verifyToken, 
  requireEventRole(['ORGANIZER']),
  async (req, res) => {
    try {
      const { eventId } = req.params as { eventId: string };
      if (!eventId) {
        res.status(400).json({ error: 'eventId is required' });
        return;
      }
      const { user_id, role } = req.body;
      const result = await EventRolesService.assignEventRole(
        eventId, 
        user_id, 
        role, 
        req.user!.id
      );
      res.status(201).json({ 
        message: 'Role assigned successfully',
        eventRole: result 
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to assign role' 
      });
    }
  }
);

// Remove user's role (organizers only)
router.delete('/:eventId/remove/:userId', 
  verifyToken, 
  requireEventRole(['ORGANIZER']),
  async (req, res) => {
    try {
      const { eventId, userId } = req.params as { eventId: string; userId: string };
      if (!eventId || !userId) {
        res.status(400).json({ error: 'eventId and userId are required' });
        return;
      }
      await EventRolesService.removeEventRole(
        eventId, 
        userId, 
        req.user!.id
      );
      res.json({ message: 'Role removed successfully' });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to remove role' 
      });
    }
  }
);

// Get user's role for an event
router.get('/:eventId/my-role', verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params as { eventId: string };
    if (!eventId) {
      res.status(400).json({ error: 'eventId is required' });
      return;
    }
    const role = await EventRolesService.getUserEventRole(req.user!.id, eventId);
    res.json({ role });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ 
      error: error.message || 'Failed to fetch role' 
    });
  }
});

export default router;