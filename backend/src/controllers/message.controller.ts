import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { AppError } from '../middleware/error.middleware.js';

export class MessageController {
  /**
   * Get user's conversations
   */
  static async getConversations(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { type } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      let queryText = `
        SELECT 
          c.*,
          cp.unread_count,
          cp.last_read_at,
          cp.is_muted,
          cp.role as user_role,
          (
            SELECT json_build_object(
              'id', m.id,
              'content', m.content,
              'type', m.type,
              'created_at', m.created_at,
              'sender_name', u.name
            )
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC
            LIMIT 1
          ) as last_message,
          (
            SELECT COUNT(*)
            FROM conversation_participants
            WHERE conversation_id = c.id
          ) as participant_count
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE cp.user_id = $1 AND cp.is_blocked = false
      `;

      const params: any[] = [userId];

      if (type) {
        params.push(type);
        queryText += ` AND c.type = $${params.length}`;
      }

      queryText += ` ORDER BY c.last_message_at DESC NULLS LAST`;
      
      params.push(limit, (page - 1) * limit);
      queryText += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

      const result = await query(queryText, params);

      res.json({
        conversations: result.rows,
        page,
        limit
      });
    } catch (error) {
      console.error('Get conversations error:', error);
      res.status(500).json({ error: 'Failed to get conversations' });
    }
  }

  /**
   * Get conversation messages
   */
  static async getMessages(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { conversationId } = req.params;
      const { before, limit = 50 } = req.query;

      // Verify user is participant
      const participant = await query(`
        SELECT * FROM conversation_participants
        WHERE conversation_id = $1 AND user_id = $2
      `, [conversationId, userId]);

      if (participant.rows.length === 0) {
        throw new AppError('Not a participant of this conversation', 403);
      }

      let queryText = `
        SELECT 
          m.*,
          u.name as sender_name,
          u.email as sender_email,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'userId', r.user_id,
                'emoji', r.emoji,
                'userName', ru.name
              )
            ) FILTER (WHERE r.id IS NOT NULL), '[]'
        ) as reactions,
        COALESCE(
          json_agg(
            DISTINCT rr.user_id
          ) FILTER (WHERE rr.id IS NOT NULL), '[]'
        ) as read_by
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        LEFT JOIN message_reactions r ON m.id = r.message_id
        LEFT JOIN users ru ON r.user_id = ru.id
        LEFT JOIN message_read_receipts rr ON m.id = rr.message_id
        WHERE m.conversation_id = $1
      `;

      const params: any[] = [conversationId];

      if (before) {
        params.push(before);
        queryText += ` AND m.created_at < $${params.length}`;
      }

      queryText += ` GROUP BY m.id, u.name, u.email`;
      queryText += ` ORDER BY m.created_at DESC`;
      params.push(limit);
      queryText += ` LIMIT $${params.length}`;

      const result = await query(queryText, params);

      res.json({
        messages: result.rows.reverse(),
        hasMore: result.rows.length === Number(limit)
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
      }
    }
  }

  /**
   * Search messages
   */
  static async searchMessages(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { q, conversationId } = req.query;

      if (!q) {
        return res.json({ messages: [] });
      }

      let queryText = `
        SELECT DISTINCT
          m.*,
          c.name as conversation_name,
          u.name as sender_name
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE cp.user_id = $1
          AND m.content ILIKE $2
          AND m.is_deleted = false
      `;

      const params: any[] = [userId, `%${q}%`];

      if (conversationId) {
        params.push(conversationId);
        queryText += ` AND m.conversation_id = $${params.length}`;
      }

      queryText += ` ORDER BY m.created_at DESC LIMIT 50`;

      const result = await query(queryText, params);

      res.json({ messages: result.rows });
    } catch (error) {
      console.error('Search messages error:', error);
      res.status(500).json({ error: 'Failed to search messages' });
    }
  }

  /**
   * Get or create direct conversation
   */
  static async getOrCreateDirectConversation(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { targetUserId } = req.body;

      // Check if direct conversation exists
      const existing = await query(`
        SELECT c.*
        FROM conversations c
        WHERE c.type = 'direct'
          AND EXISTS (
            SELECT 1 FROM conversation_participants
            WHERE conversation_id = c.id AND user_id = $1
          )
          AND EXISTS (
            SELECT 1 FROM conversation_participants
            WHERE conversation_id = c.id AND user_id = $2
          )
      `, [userId, targetUserId]);

      if (existing.rows.length > 0) {
        return res.json({ conversation: existing.rows[0] });
      }

      // Create new direct conversation
      const newConv = await query(`
        INSERT INTO conversations (type, created_by)
        VALUES ('direct', $1)
        RETURNING *
      `, [userId]);

      const conversationId = newConv.rows[0].id;

      // Add both participants
      await query(`
        INSERT INTO conversation_participants (conversation_id, user_id)
        VALUES ($1, $2), ($1, $3)
      `, [conversationId, userId, targetUserId]);

      res.json({ conversation: newConv.rows[0] });
    } catch (error) {
      console.error('Get or create direct conversation error:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  }

  /**
   * Create group conversation
   */
  static async createGroupConversation(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const schema = z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        participantIds: z.array(z.string().uuid()).min(1).max(50),
        eventId: z.string().uuid().optional()
      });

      const { name, description, participantIds, eventId } = schema.parse(req.body);

      // Create conversation
      const conv = await query(`
        INSERT INTO conversations (type, name, description, event_id, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, ['group', name, description, eventId, userId]);

      const conversationId = conv.rows[0].id;

      // Add creator as admin
      await query(`
        INSERT INTO conversation_participants (conversation_id, user_id, role)
        VALUES ($1, $2, 'admin')
      `, [conversationId, userId]);

      // Add other participants
      for (const participantId of participantIds) {
        if (participantId !== userId) {
          await query(`
            INSERT INTO conversation_participants (conversation_id, user_id, role)
            VALUES ($1, $2, 'member')
            ON CONFLICT (conversation_id, user_id) DO NOTHING
          `, [conversationId, participantId]);
        }
      }

             // Get user name for system message
       const user = await query('SELECT name FROM users WHERE id = $1', [userId]);
       
       // Add system message
       await query(`
         INSERT INTO messages (conversation_id, type, content, metadata)
         VALUES ($1, 'system', $2, $3)
       `, [
         conversationId,
         `${user.rows[0].name} created the group`,
         JSON.stringify({ action: 'group_created' })
       ]);

      res.status(201).json({ conversation: conv.rows[0] });
    } catch (error) {
      console.error('Create group conversation error:', error);
      res.status(500).json({ error: 'Failed to create group conversation' });
    }
  }

  /**
   * Update conversation settings
   */
  static async updateConversation(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { conversationId } = req.params;
      const { name, description, muted } = req.body;

      // Check if user is admin
      const participant = await query(`
        SELECT role FROM conversation_participants
        WHERE conversation_id = $1 AND user_id = $2
      `, [conversationId, userId]);

      if (participant.rows.length === 0) {
        throw new AppError('Not a participant', 403);
      }

      // Update conversation details (admin only)
      if ((name || description) && participant.rows[0].role === 'admin') {
        await query(`
          UPDATE conversations
          SET name = COALESCE($1, name),
              description = COALESCE($2, description)
          WHERE id = $3
        `, [name, description, conversationId]);
      }

      // Update participant settings
      if (typeof muted === 'boolean') {
        await query(`
          UPDATE conversation_participants
          SET is_muted = $1
          WHERE conversation_id = $2 AND user_id = $3
        `, [muted, conversationId, userId]);
      }

      res.json({ success: true });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        console.error('Update conversation error:', error);
        res.status(500).json({ error: 'Failed to update conversation' });
      }
    }
  }

  /**
   * Leave conversation
   */
  static async leaveConversation(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { conversationId } = req.params;

      // Remove participant
      await query(`
        DELETE FROM conversation_participants
        WHERE conversation_id = $1 AND user_id = $2
      `, [conversationId, userId]);

             // Get user name for system message
       const user = await query('SELECT name FROM users WHERE id = $1', [userId]);
       
       // Add system message
       await query(`
         INSERT INTO messages (conversation_id, type, content, metadata)
         VALUES ($1, 'system', $2, $3)
       `, [
         conversationId,
         `${user.rows[0].name} left the conversation`,
         JSON.stringify({ action: 'user_left', userId })
       ]);

      res.json({ success: true });
    } catch (error) {
      console.error('Leave conversation error:', error);
      res.status(500).json({ error: 'Failed to leave conversation' });
    }
  }

  /**
   * Add participants to group
   */
  static async addParticipants(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { conversationId } = req.params;
      const { participantIds } = req.body;

      // Check if user is admin
      const participant = await query(`
        SELECT role FROM conversation_participants
        WHERE conversation_id = $1 AND user_id = $2
      `, [conversationId, userId]);

      if (participant.rows.length === 0 || participant.rows[0].role !== 'admin') {
        throw new AppError('Only admins can add participants', 403);
      }

      // Add new participants
      for (const participantId of participantIds) {
        await query(`
          INSERT INTO conversation_participants (conversation_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT (conversation_id, user_id) DO NOTHING
        `, [conversationId, participantId]);
      }

             // Get user name for system message
       const user = await query('SELECT name FROM users WHERE id = $1', [userId]);
       
       // Add system message
       await query(`
         INSERT INTO messages (conversation_id, type, content, metadata)
         VALUES ($1, 'system', $2, $3)
       `, [
         conversationId,
         `${user.rows[0].name} added ${participantIds.length} participant(s)`,
         JSON.stringify({ action: 'participants_added', participantIds })
       ]);

      res.json({ success: true });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        console.error('Add participants error:', error);
        res.status(500).json({ error: 'Failed to add participants' });
      }
    }
  }
}