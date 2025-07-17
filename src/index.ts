import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// Model imports to ensure they are registered
import './models/User';
import './models/VisaRequest';
import './models/Proposal';
import './models/Message';
import './models/Document';
import './models/Escrow';
import './models/Review';
import './models/Notification';
import './models/Case';
import './models/Payment';

import { connectDB } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

// Route imports
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import visaRequestRoutes from './routes/visaRequests';
import proposalRoutes from './routes/proposals';
import messageRoutes from './routes/messages';
import documentRoutes from './routes/documents';
import escrowRoutes from './routes/escrow';
import reviewRoutes from './routes/reviews';
import paymentsRoutes from './routes/payments';
import adminRoutes from './routes/admin';
import dashboardRoutes from './routes/dashboard';
import caseRoutes from './routes/cases';
import calendarRoutes from './routes/calendar';

// Socket handlers
import { initializeSocket } from './sockets/socketHandler';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || "http://localhost:5173",
      "http://localhost:8080",
      "https://vm-visa-test.vercel.app",
      "https://vm-visa-frontend.vercel.app"
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// Use environment PORT or default to 5000
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(limiter);
app.use(morgan('combined'));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:5173",
    "http://localhost:8080",
    "https://vm-visa-test.vercel.app",
    "https://vm-visa-frontend.vercel.app"
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Make io accessible in routes
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/visa-requests', visaRequestRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/escrow', escrowRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/calendar', calendarRoutes);

// Root endpoint - API information
app.get('/', (req: any, res: any) => {
  res.json({
    success: true,
    message: 'VM Visa Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      visaRequests: '/api/visa-requests',
      proposals: '/api/proposals',
      messages: '/api/messages',
      documents: '/api/documents',
      escrow: '/api/escrow',
      reviews: '/api/reviews',
      payments: '/api/payments',
      admin: '/api/admin',
      dashboard: '/api/dashboard',
      cases: '/api/cases',
      calendar: '/api/calendar'
    },
    documentation: 'See README.md for API documentation'
  });
});

// API info endpoint
app.get('/api', (req: any, res: any) => {
  res.json({
    success: true,
    message: 'VM Visa API v1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /api/health - Health check',
      'POST /api/auth/login - User login',
      'POST /api/auth/register - User registration',
      'GET /api/users - Get users',
      'GET /api/visa-requests - Get visa requests',
      'GET /api/proposals - Get proposals',
      'GET /api/messages - Get messages',
      'GET /api/documents - Get documents',
      'GET /api/escrow - Get escrow transactions',
      'GET /api/reviews - Get reviews',
      'GET /api/payments - Get payments',
      'GET /api/dashboard - Dashboard data',
      'GET /api/cases - Get cases',
      'GET /api/calendar - Calendar events'
    ]
  });
});

// Health check endpoint
app.get('/api/health', (req: any, res: any) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Initialize socket handlers
initializeSocket(io);

// Global error handlers to prevent server crashes
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Don't exit the process, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Promise Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
});

export default app;
