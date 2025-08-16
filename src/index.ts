// Moe Backend - Enhanced AI Assistant for Mozaik Software
// Last updated: 2025-08-16 - Simplified working version

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';

// Load environment variables
config();

// Import routes
import authRoutes from './routes/auth.js';
import uploadRoutes from './routes/upload.js';
import apiRoutes from './routes/api.js';
import specializedRoutes from './routes/specialized.js';
import searchRoutes from './routes/search.js';
import analyticsRoutes from './routes/analytics.js';
import chatRoutes from './routes/chat.js';
import knowledgeRoutes from './routes/knowledge.js';

// Import services
import { DatabaseService } from './services/DatabaseService.js';
import { ContentIngestionService } from './services/ContentIngestionService.js';

// Import plans configuration
import { PLANS, PLAN_TIERS } from './config/plans.js';

const app = express();
const PORT = process.env.PORT || 10000;

// Database service
const dbService = new DatabaseService();
const contentIngestion = new ContentIngestionService();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const startTime = Date.now();
  req.startTime = startTime;
  
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl} - ${req.ip}`);
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbStatus = await dbService.getConnectionStatus();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      environment: process.env.NODE_ENV || 'development',
      version: '2.0.0'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Moe Backend API',
    version: '2.0.0',
    status: 'running',
    features: [
      'GPT-4 Chat Assistant',
      'RAG Integration',
      'File Upload & Analysis',
      'Knowledge Base',
      'Answer Caching',
      'Quality Gates',
      'Tiered Plans',
      'Usage Tracking'
    ],
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      chat: '/api/chat',
      upload: '/api/upload',
      search: '/api/search',
      knowledge: '/api/knowledge',
      analytics: '/api/analytics'
    }
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', apiRoutes);
app.use('/api/specialized', specializedRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/knowledge', knowledgeRoutes);

// Plans endpoint - WORKING VERSION
app.get('/api/plans', (req, res) => {
  res.json({
    message: 'Available plans retrieved successfully',
    plans: PLAN_TIERS,
    features: {
      free: {
        model: 'gpt-4o-mini',
        daily_limit: 5,
        file_upload: false,
        features: ['Basic chat', 'Limited queries']
      },
      paid: {
        model: 'gpt-4o',
        file_upload: true,
        features: ['Advanced chat', 'File parsing', 'Enhanced RAG', 'Priority support']
      }
    }
  });
});

// Usage endpoint - WORKING VERSION
app.get('/api/usage', (req, res) => {
  res.json({
    message: 'Usage endpoint ready',
    note: 'Authentication required for actual usage data'
  });
});

// Supported file types endpoint
app.get('/api/specialized/supported-types', (req, res) => {
  const supportedTypes = [
    {
      type: 'xml',
      extensions: ['.xml'],
      description: 'XML files with parts, parameters, and constraints'
    },
    {
      type: 'moz',
      extensions: ['.moz'],
      description: 'Mozaik project files with components and settings'
    },
    {
      type: 'dat',
      extensions: ['.dat'],
      description: 'Mozaik data files with parameters and values'
    },
    {
      type: 'des',
      extensions: ['.des'],
      description: 'Mozaik design files with layout and configuration'
    }
  ];

  res.json({
    message: 'Supported file types retrieved successfully',
    supported_types: supportedTypes
  });
});

// Start server with database and knowledge base initialization
async function startServer() {
  try {
    // Connect to database
    await dbService.connect();
    console.log('✅ Database connected successfully');

    // Initialize knowledge base
    console.log('🧠 Initializing knowledge base system...');
    const stats = await contentIngestion.getStats();
    
    if (stats.total_documents === 0) {
      console.log('📚 No existing knowledge found. Starting automatic knowledge base initialization...');
      try {
        // Auto-initialize the knowledge base with curated sources
        await contentIngestion.initialize();
        console.log('✅ Knowledge base initialized successfully with curated sources');
      } catch (error) {
        console.error('⚠️ Knowledge base auto-initialization failed:', error);
        console.log('💡 Use POST /api/knowledge/initialize to manually populate the knowledge base.');
      }
    } else {
      console.log(`✅ Knowledge base ready with ${stats.total_documents} documents`);
      // Start the ingestion service for scheduled updates
      await contentIngestion.initialize();
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🧠 Knowledge base: http://localhost:${PORT}/api/knowledge/status`);
      console.log(`💬 Enhanced chat: http://localhost:${PORT}/api/chat/message`);
      console.log(`📈 Usage tracking: http://localhost:${PORT}/api/usage`);
      console.log(`📋 Plans: http://localhost:${PORT}/api/plans`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// 404 handler - MOVED TO END
app.use('*', (req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Route not found',
    method: req.method,
    url: req.originalUrl,
    availableEndpoints: ['/', '/health', '/api/auth', '/api/upload', '/api/specialized', '/api/search', '/api/chat', '/api/knowledge', '/api/analytics', '/api/usage', '/api/plans']
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Unexpected file field' });
  }
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️ Received SIGINT, shutting down gracefully...');
  try {
    await dbService.disconnect();
    console.log('✅ Database disconnected');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️ Received SIGTERM, shutting down gracefully...');
  try {
    await dbService.disconnect();
    console.log('✅ Database disconnected');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

export default app; 