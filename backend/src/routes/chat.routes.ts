import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware.js';
import { query } from '../db.js';
import type { Request, Response } from 'express';

const router = Router();

// Get chat conversations for a user
router.get('/conversations', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get recent conversations (both event and private chats)
    const conversations = await query(`
      WITH recent_messages AS (
        SELECT DISTINCT ON (
          CASE 
            WHEN type = 'event' THEN CONCAT('event:', event_id)
            ELSE CONCAT('private:', LEAST(sender_id, receiver_id), ':', GREATEST(sender_id, receiver_id))
          END
        )
        CASE 
          WHEN type = 'event' THEN CONCAT('event:', event_id)
          ELSE CONCAT('private:', LEAST(sender_id, receiver_id), ':', GREATEST(sender_id, receiver_id))
        END as conversation_id,
        content,
        sender_name,
        type,
        event_id,
        CASE 
          WHEN sender_id = $1 THEN receiver_id 
          ELSE sender_id 
        END as other_user_id,
        created_at,
        (SELECT COUNT(*) FROM messages m2 
         WHERE m2.receiver_id = $1 
         AND m2.is_read = false 
         AND (
           (messages.type = 'event' AND m2.event_id = messages.event_id) OR
           (messages.type = 'private' AND m2.sender_id = CASE WHEN messages.sender_id = $1 THEN messages.receiver_id ELSE messages.sender_id END)
         )
        ) as unread_count
        FROM messages
        WHERE (sender_id = $1 OR receiver_id = $1)
        ORDER BY conversation_id, created_at DESC
      )
      SELECT 
        rm.*,
        CASE 
          WHEN rm.type = 'event' THEN e.title
          ELSE u.name
        END as conversation_name,
        CASE 
          WHEN rm.type = 'event' THEN e.image_url
          ELSE null
        END as conversation_image
      FROM recent_messages rm
      LEFT JOIN events e ON rm.event_id = e.id
      LEFT JOIN users u ON rm.other_user_id = u.id
      ORDER BY rm.created_at DESC
    `, [userId]);

    res.json({ conversations: conversations.rows });
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// Get messages for a specific conversation
router.get('/messages', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { type, eventId, receiverId, limit = 50, offset = 0 } = req.query;

    let query_text = '';
    let params: any[] = [];

    if (type === 'event' && eventId) {
      // Verify user has access to event
      const hasAccess = await query(`
        SELECT 1 FROM (
          SELECT event_id FROM event_roles WHERE user_id = $1 AND event_id = $2
          UNION
          SELECT event_id FROM tickets WHERE user_id = $1 AND event_id = $2 AND status = 'CONFIRMED'
        ) AS access_check
        LIMIT 1
      `, [userId, eventId]);

      if (hasAccess.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied to this event chat' });
      }

      query_text = `
        SELECT * FROM messages 
        WHERE type = 'event' AND event_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [eventId, limit, offset];
    } else if (type === 'private' && receiverId) {
      query_text = `
        SELECT * FROM messages 
        WHERE type = 'private' 
        AND ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
      `;
      params = [userId, receiverId, limit, offset];
    } else {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const result = await query(query_text, params);
    const messages = result.rows.reverse(); // Return in chronological order

    res.json({ messages });
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Mark messages as read
router.post('/mark-read', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { type, eventId, senderId } = req.body;

    if (type === 'event' && eventId) {
      await query(`
        UPDATE messages 
        SET is_read = true 
        WHERE receiver_id = $1 AND event_id = $2 AND is_read = false
      `, [userId, eventId]);
    } else if (type === 'private' && senderId) {
      await query(`
        UPDATE messages 
        SET is_read = true 
        WHERE receiver_id = $1 AND sender_id = $2 AND is_read = false
      `, [userId, senderId]);
    } else {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// Get users available for private chat (event attendees/organizers)
router.get('/event/:eventId/users', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { eventId } = req.params;

    // Get all users associated with the event (organizers and attendees)
    const users = await query(`
      SELECT DISTINCT u.id, u.name, u.email
      FROM users u
      WHERE u.id IN (
        SELECT er.user_id FROM event_roles er WHERE er.event_id = $1
        UNION
        SELECT t.user_id FROM tickets t WHERE t.event_id = $1 AND t.status = 'CONFIRMED'
      )
      AND u.id != $2
      ORDER BY u.name
    `, [eventId, userId]);

    res.json({ users: users.rows });
  } catch (error) {
    console.error('Error getting event users:', error);
    res.status(500).json({ error: 'Failed to get event users' });
  }
});

export default router;