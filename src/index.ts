import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { authRoutes } from './routes/auth.js';
import { uploadRoutes } from './routes/upload.js';
import { apiRoutes } from './routes/api.js';
import { specializedRoutes } from './routes/specialized.js';
import { searchRoutes } from './routes/search.js';
import { analyticsRoutes } from './routes/analytics.js';
import { chatRoutes } from './routes/chat.js';
import { knowledgeRoutes } from './routes/knowledge.js';
import { DatabaseService } from './services/DatabaseService.js';
import { ContentIngestionService } from './services/ContentIngestionService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database connection
const dbService = DatabaseService.getInstance();

// Security middleware
app.use(helmet());

// Compression middleware for production
if (process.env.NODE_ENV === 'production') {
  app.use(compression());
}

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || '*', // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Moe Command Console Backend API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      upload: '/api/upload',
      specialized: '/api/specialized',
      api: '/api'
    }
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', apiRoutes);
app.use('/api/specialized', specializedRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/knowledge', knowledgeRoutes);

// Health check endpoint with database status
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await dbService.healthCheck();
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      database: dbHealth
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      database: { status: 'error', details: String(error) }
    });
  }
});

// Direct specialized routes (fallback)
app.get('/api/specialized/test', (req, res) => {
  console.log('Direct specialized test endpoint called');
  res.json({
    message: 'Specialized parser is working!',
    status: 'ready',
    timestamp: new Date().toISOString(),
    supported_types: [
      'MOZ (.moz)',
      'DAT (.dat)', 
      'DES (.des)',
      'XML (.xml)'
    ]
  });
});

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

// 404 handler
app.use('*', (req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Route not found',
    method: req.method,
    url: req.originalUrl,
    availableEndpoints: ['/', '/health', '/api/auth', '/api/upload', '/api/specialized', '/api']
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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

// Start server with database and knowledge base initialization
async function startServer() {
  try {
    // Connect to database
    await dbService.connect();
    console.log('✅ Database connected successfully');

    // Initialize knowledge base system (manual mode only)
    console.log('🧠 Knowledge base system ready (manual seeding mode)');
    const contentIngestion = new ContentIngestionService();
    
    // Check knowledge base status
    const stats = await contentIngestion.getIngestionStats();
    if (stats.total_documents === 0) {
      console.log('📚 Knowledge base is empty. Use manual seeding endpoints:');
      console.log('💡 POST /api/knowledge/populate-test-data (basic)');
      console.log('💡 POST /api/knowledge/seed-manual-knowledge (comprehensive)');
    } else {
      console.log(`✅ Knowledge base ready with ${stats.total_documents} documents`);
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🧠 Knowledge base: http://localhost:${PORT}/api/knowledge/status`);
      console.log(`💬 Enhanced chat: http://localhost:${PORT}/api/chat/enhanced-message`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

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

startServer();

export default app; 