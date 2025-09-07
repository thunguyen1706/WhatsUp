// lib/useSocket.ts
import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { getToken } from './auth';

export interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  sender_name: string;
  type: 'event' | 'private';
  event_id?: string;
  receiver_id?: string;
  created_at: string;
  is_read?: boolean;
}

export interface TypingUser {
  userId: string;
  userName: string;
  eventId?: string;
  receiverId?: string;
}

export interface OnlineUser {
  id: string;
  name: string;
}

interface UseSocketReturn {
  socket: typeof Socket | null;
  connected: boolean;
  joinEvent: (eventId: string) => void;
  leaveEvent: (eventId: string) => void;
  sendMessage: (data: {
    content: string;
    type: 'event' | 'private';
    eventId?: string;
    receiverId?: string;
  }) => void;
  startTyping: (data: { eventId?: string; receiverId?: string }) => void;
  stopTyping: (data: { eventId?: string; receiverId?: string }) => void;
  getChatHistory: (data: {
    type: 'event' | 'private';
    eventId?: string;
    receiverId?: string;
    limit?: number;
    offset?: number;
  }) => void;
  getOnlineUsers: (eventId: string) => void;
  messages: ChatMessage[];
  typingUsers: TypingUser[];
  onlineUsers: OnlineUser[];
  error: string | null;
}

export const useSocket = (): UseSocketReturn => {
  const socketRef = useRef<typeof Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initSocket = async () => {
      try {
        const token = await getToken();
        if (!token) {
          setError('No authentication token found');
          return;
        }

        const socketUrl = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';
        
        socketRef.current = io(socketUrl, {
          auth: { token },
          transports: ['websocket', 'polling'],
          autoConnect: true,
        });

        const socket = socketRef.current;

        // Connection events
        socket.on('connect', () => {
          console.log('Connected to WebSocket server');
          setConnected(true);
          setError(null);
        });

        socket.on('disconnect', () => {
          console.log('Disconnected from WebSocket server');
          setConnected(false);
        });

        socket.on('connect_error', (error: any) => {
          console.error('WebSocket connection error:', error);
          setError(error.message);
          setConnected(false);
        });

        // Message events
        socket.on('new_message', (message: ChatMessage) => {
          console.log('New message received:', message);
          setMessages(prev => [...prev, message]);
        });

        socket.on('chat_history', (data: {
          messages: ChatMessage[];
          type: 'event' | 'private';
          eventId?: string;
          receiverId?: string;
        }) => {
          console.log('Chat history received:', data.messages.length, 'messages');
          setMessages(data.messages);
        });

        // Typing events
        socket.on('user_typing', (data: TypingUser) => {
          setTypingUsers(prev => {
            const filtered = prev.filter(user => user.userId !== data.userId);
            return [...filtered, data];
          });
        });

        socket.on('user_stopped_typing', (data: TypingUser) => {
          setTypingUsers(prev => prev.filter(user => user.userId !== data.userId));
        });

        // Online users events
        socket.on('online_users', (data: { eventId: string; users: OnlineUser[] }) => {
          setOnlineUsers(data.users);
        });

        socket.on('user_joined_event', (data: { userId: string; userName: string; eventId: string }) => {
          console.log(`${data.userName} joined event ${data.eventId}`);
        });

        socket.on('user_left_event', (data: { userId: string; userName: string; eventId: string }) => {
          console.log(`${data.userName} left event ${data.eventId}`);
        });

        // Error events
        socket.on('error', (error: { message: string }) => {
          console.error('Socket error:', error);
          setError(error.message);
        });

        // Event join confirmation
        socket.on('joined_event', (data: { eventId: string; success: boolean }) => {
          if (data.success) {
            console.log(`Successfully joined event ${data.eventId}`);
          }
        });

      } catch (error) {
        console.error('Error initializing socket:', error);
        setError('Failed to initialize WebSocket connection');
      }
    };

    initSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const joinEvent = (eventId: string) => {
    if (socketRef.current && connected) {
      socketRef.current.emit('join_event', eventId);
    }
  };

  const leaveEvent = (eventId: string) => {
    if (socketRef.current && connected) {
      socketRef.current.emit('leave_event', eventId);
    }
  };

  const sendMessage = (data: {
    content: string;
    type: 'event' | 'private';
    eventId?: string;
    receiverId?: string;
  }) => {
    if (socketRef.current && connected) {
      socketRef.current.emit('send_message', data);
    }
  };

  const startTyping = (data: { eventId?: string; receiverId?: string }) => {
    if (socketRef.current && connected) {
      socketRef.current.emit('typing_start', data);
    }
  };

  const stopTyping = (data: { eventId?: string; receiverId?: string }) => {
    if (socketRef.current && connected) {
      socketRef.current.emit('typing_stop', data);
    }
  };

  const getChatHistory = (data: {
    type: 'event' | 'private';
    eventId?: string;
    receiverId?: string;
    limit?: number;
    offset?: number;
  }) => {
    if (socketRef.current && connected) {
      socketRef.current.emit('get_chat_history', data);
    }
  };

  const getOnlineUsers = (eventId: string) => {
    if (socketRef.current && connected) {
      socketRef.current.emit('get_online_users', eventId);
    }
  };

  return {
    socket: socketRef.current,
    connected,
    joinEvent,
    leaveEvent,
    sendMessage,
    startTyping,
    stopTyping,
    getChatHistory,
    getOnlineUsers,
    messages,
    typingUsers,
    onlineUsers,
    error,
  };
};