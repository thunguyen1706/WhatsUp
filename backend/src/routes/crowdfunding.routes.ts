import { Router } from 'express';
import { verifyToken, optionalAuth } from '../middleware/auth.middleware.js';
import { CrowdfundingService } from '../services/crowdfunding.service.js';

const router = Router();

// Create contribution
router.post('/contribute', verifyToken, async (req, res) => {
  try {
    const { event_id, amount_cents, message, is_anonymous = false } = req.body;
    const result = await CrowdfundingService.createContribution(
      req.user!.id, 
      event_id, 
      amount_cents, 
      message, 
      is_anonymous
    );
    res.status(201).json({ 
      message: 'Contribution created successfully',
      ...result 
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ 
      error: error.message || 'Failed to create contribution' 
    });
  }
});

// Get crowdfunding progress for an event
router.get('/progress/:eventId', optionalAuth, async (req, res) => {
  try {
    const { eventId } = req.params as { eventId: string };
    if (!eventId) {
      res.status(400).json({ error: 'eventId is required' });
      return;
    }
    const progress = await CrowdfundingService.getCrowdfundingProgress(eventId);
    res.json(progress);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ 
      error: error.message || 'Failed to fetch crowdfunding progress' 
    });
  }
});

// Get leaderboard
router.get('/leaderboard/:eventId', optionalAuth, async (req, res) => {
  try {
    const { eventId } = req.params as { eventId: string };
    if (!eventId) {
      res.status(400).json({ error: 'eventId is required' });
      return;
    }
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const leaderboard = await CrowdfundingService.getCrowdfundingLeaderboard(eventId, limit);
    res.json({ leaderboard });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ 
      error: error.message || 'Failed to fetch leaderboard' 
    });
  }
});

// Get user's contributions
router.get('/my', verifyToken, async (req, res) => {
  try {
    const eventId = req.query.event_id as string;
    const contributions = await CrowdfundingService.getUserContributions(req.user!.id, eventId);
    res.json({ contributions });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ 
      error: error.message || 'Failed to fetch contributions' 
    });
  }
});

export default router;