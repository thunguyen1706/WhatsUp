import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { EventRolesService } from '../services/eventRoles.service.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  // NO GLOBAL ROLE
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      eventRole?: string; // Role for current event context
    }
  }
}

/**
 * Verify JWT token - no role checking
 */
export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Verify user still exists
    const result = await query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      res.status(500).json({ error: 'Token verification failed' });
    }
  }
};

/**
 * Check if user has specific role for an event
 */
export const requireEventRole = (roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get event ID from params or body
    const eventId = req.params.eventId || req.body.event_id;
    
    if (!eventId) {
      res.status(400).json({ error: 'Event ID required' });
      return;
    }

    // Check if user has required role for this event
    const hasRole = await EventRolesService.hasEventRole(req.user.id, eventId, roles);
    
    if (!hasRole) {
      res.status(403).json({ 
        error: 'Insufficient permissions for this event',
        required: roles
      });
      return;
    }

    // Get user's role for this event
    const userRole = await EventRolesService.getUserEventRole(req.user.id, eventId);
    req.eventRole = userRole?.role;

    next();
  };
};

/**
 * Require global ADMIN role (checked from users table)
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await query('SELECT role FROM users WHERE id = $1', [req.user.id]);

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    if (result.rows[0].role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    next();
  } catch (err) {
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Optional auth - doesn't fail if no token
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      next();
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    const result = await query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length > 0) {
      req.user = result.rows[0];
    }

    next();
  } catch (error) {
    // Token is invalid but we continue anyway since it's optional
    next();
  }
};