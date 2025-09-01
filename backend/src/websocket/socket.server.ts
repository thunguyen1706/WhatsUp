// src/websocket/socket.server.ts
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  sender_name: string;
  event_id?: string | undefined;
  receiver_id?: string | undefined;
  type: 'event' | 'private';
  created_at: string;
}

interface TypingData {
  userId: string;
  userName: string;
  eventId?: string | undefined;
  receiverId?: string | undefined;
}

export class WebSocketServer {
  private io: SocketIOServer;
  private connectedUsers: Map<string, AuthenticatedSocket> = new Map();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        
        // Get user details from database
        const userResult = await query('SELECT id, name, email FROM users WHERE id = $1', [decoded.userId]);
        
        if (userResult.rows.length === 0) {
          return next(new Error('Authentication error: User not found'));
        }

        socket.userId = decoded.userId;
        socket.user = userResult.rows[0];
        
        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication error'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User ${socket.user?.name} connected:`, socket.id);
      
      // Store connected user
      if (socket.userId) {
        this.connectedUsers.set(socket.userId, socket);
      }

      // Join user to their personal room for private messages
      socket.join(`user:${socket.userId}`);

      // Handle joining event chat rooms
      socket.on('join_event', async (eventId: string) => {
        try {
          // Verify user has access to this event (is attending or organizing)
          const hasAccess = await this.verifyEventAccess(socket.userId!, eventId);
          
          if (hasAccess) {
            socket.join(`event:${eventId}`);
            socket.emit('joined_event', { eventId, success: true });
            
            // Notify others in the event chat
            socket.to(`event:${eventId}`).emit('user_joined_event', {
              userId: socket.userId,
              userName: socket.user?.name,
              eventId
            });

            console.log(`User ${socket.user?.name} joined event ${eventId}`);
          } else {
            socket.emit('error', { message: 'Access denied to this event' });
          }
        } catch (error) {
          console.error('Error joining event:', error);
          socket.emit('error', { message: 'Failed to join event chat' });
        }
      });

      // Handle leaving event chat rooms
      socket.on('leave_event', (eventId: string) => {
        socket.leave(`event:${eventId}`);
        socket.to(`event:${eventId}`).emit('user_left_event', {
          userId: socket.userId,
          userName: socket.user?.name,
          eventId
        });
        console.log(`User ${socket.user?.name} left event ${eventId}`);
      });

      // Handle sending messages
      socket.on('send_message', async (data: {
        content: string;
        type: 'event' | 'private';
        eventId?: string;
        receiverId?: string;
      }) => {
        try {
          const message = await this.saveMessage({
            content: data.content,
            sender_id: socket.userId!,
            sender_name: socket.user!.name,
            type: data.type,
            event_id: data.eventId,
            receiver_id: data.receiverId
          });

          if (data.type === 'event' && data.eventId) {
            // Send to all users in the event room
            this.io.to(`event:${data.eventId}`).emit('new_message', message);
          } else if (data.type === 'private' && data.receiverId) {
            // Send to specific user
            this.io.to(`user:${data.receiverId}`).emit('new_message', message);
            // Also send to sender for confirmation
            socket.emit('new_message', message);
          }

          console.log(`Message sent by ${socket.user?.name}:`, data.content);
        } catch (error) {
          console.error('Error sending message:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle typing indicators
      socket.on('typing_start', (data: { eventId?: string; receiverId?: string }) => {
        const typingData: TypingData = {
          userId: socket.userId!,
          userName: socket.user!.name,
          eventId: data.eventId,
          receiverId: data.receiverId
        };

        if (data.eventId) {
          socket.to(`event:${data.eventId}`).emit('user_typing', typingData);
        } else if (data.receiverId) {
          socket.to(`user:${data.receiverId}`).emit('user_typing', typingData);
        }
      });

      socket.on('typing_stop', (data: { eventId?: string; receiverId?: string }) => {
        const typingData: TypingData = {
          userId: socket.userId!,
          userName: socket.user!.name,
          eventId: data.eventId,
          receiverId: data.receiverId
        };

        if (data.eventId) {
          socket.to(`event:${data.eventId}`).emit('user_stopped_typing', typingData);
        } else if (data.receiverId) {
          socket.to(`user:${data.receiverId}`).emit('user_stopped_typing', typingData);
        }
      });

      // Handle getting chat history
      socket.on('get_chat_history', async (data: {
        type: 'event' | 'private';
        eventId?: string;
        receiverId?: string;
        limit?: number;
        offset?: number;
      }) => {
        try {
          const messages = await this.getChatHistory(
            socket.userId!,
            data.type,
            data.eventId,
            data.receiverId,
            data.limit || 50,
            data.offset || 0
          );

          socket.emit('chat_history', {
            messages,
            type: data.type,
            eventId: data.eventId,
            receiverId: data.receiverId
          });
        } catch (error) {
          console.error('Error getting chat history:', error);
          socket.emit('error', { message: 'Failed to load chat history' });
        }
      });

      // Handle getting online users for an event
      socket.on('get_online_users', (eventId: string) => {
        const room = this.io.sockets.adapter.rooms.get(`event:${eventId}`);
        const onlineUsers: Array<{ id: string; name: string }> = [];

        if (room) {
          room.forEach(socketId => {
            const userSocket = this.io.sockets.sockets.get(socketId) as AuthenticatedSocket;
            if (userSocket?.user) {
              onlineUsers.push({
                id: userSocket.userId!,
                name: userSocket.user.name
              });
            }
          });
        }

        socket.emit('online_users', { eventId, users: onlineUsers });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${socket.user?.name} disconnected:`, socket.id);
        
        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);
        }

        // Notify all rooms that user has disconnected
        socket.broadcast.emit('user_disconnected', {
          userId: socket.userId,
          userName: socket.user?.name
        });
      });
    });
  }

  private async verifyEventAccess(userId: string, eventId: string): Promise<boolean> {
    try {
      // Check if user is organizer, attendee, or has ticket
      const accessCheck = await query(`
        SELECT 1 FROM (
          SELECT event_id FROM event_roles WHERE user_id = $1 AND event_id = $2
          UNION
          SELECT event_id FROM tickets WHERE user_id = $1 AND event_id = $2 AND status = 'CONFIRMED'
        ) AS access_check
        LIMIT 1
      `, [userId, eventId]);

      return accessCheck.rows.length > 0;
    } catch (error) {
      console.error('Error verifying event access:', error);
      return false;
    }
  }

  private async saveMessage(messageData: Omit<ChatMessage, 'id' | 'created_at'>): Promise<ChatMessage> {
    try {
      const result = await query(`
        INSERT INTO messages (content, sender_id, sender_name, type, event_id, receiver_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        messageData.content,
        messageData.sender_id,
        messageData.sender_name,
        messageData.type,
        messageData.event_id || null,
        messageData.receiver_id || null
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  }

  private async getChatHistory(
    userId: string,
    type: 'event' | 'private',
    eventId?: string,
    receiverId?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ChatMessage[]> {
    try {
      let query_text = '';
      let params: any[] = [];

      if (type === 'event' && eventId) {
        // Get event chat history
        query_text = `
          SELECT * FROM messages 
          WHERE type = 'event' AND event_id = $1
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3
        `;
        params = [eventId, limit, offset];
      } else if (type === 'private' && receiverId) {
        // Get private chat history between two users
        query_text = `
          SELECT * FROM messages 
          WHERE type = 'private' 
          AND ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
          ORDER BY created_at DESC
          LIMIT $3 OFFSET $4
        `;
        params = [userId, receiverId, limit, offset];
      } else {
        throw new Error('Invalid chat history request');
      }

      const result = await query(query_text, params);
      return result.rows.reverse(); // Return in chronological order
    } catch (error) {
      console.error('Error getting chat history:', error);
      throw error;
    }
  }

  // Method to send notifications or broadcasts
  public sendNotification(userId: string, notification: any) {
    const userSocket = this.connectedUsers.get(userId);
    if (userSocket) {
      userSocket.emit('notification', notification);
    }
  }

  public broadcastToEvent(eventId: string, event: string, data: any) {
    this.io.to(`event:${eventId}`).emit(event, data);
  }
}