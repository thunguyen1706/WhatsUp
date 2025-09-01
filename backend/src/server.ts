import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { query } from './db.js';
import { WebSocketServer } from './websocket/socket.server.js';
import chatRoutes from './routes/chat.routes.js';


// Import middleware
import { errorHandler } from './middleware/error.middleware.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import eventsRoutes from './routes/events.routes.js';
import ticketsRoutes from './routes/tickets.routes.js';
import sponsorshipRoutes from './routes/sponsorship.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import adminRoutes from './routes/admin.routes.js';
import messageRoutes from './routes/message.routes.js';
import recommendationsRoutes from './routes/recommendations.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';

dotenv.config();

const app = express();
const server = createServer(app);

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await query('SELECT NOW()');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/sponsorship', sponsorshipRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/chat', chatRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Error handling middleware
app.use(errorHandler);

// Initialize WebSocket server
const wsServer = new WebSocketServer(server);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 WebSocket server initialized`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
