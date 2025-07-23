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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});

// Direct specialized routes (fallback)
app.get('/api/specialized/test', (req, res) => {
  console.log('Direct specialized test endpoint called');
  res.json({
    message: 'Specialized parser is working!',
    status: 'ready',
    timestamp: new Date().toISOString(),
    supported_types: [
      'CAB (.cab)',
      'CABX (.cabx)', 
      'MZB (.mzb)',
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
      type: 'cab',
      extensions: ['.cab'],
      description: 'CAB component files with parameters and constraints'
    },
    {
      type: 'cabx',
      extensions: ['.cabx'],
      description: 'Extended CAB files with advanced features'
    },
    {
      type: 'mzb',
      extensions: ['.mzb'],
      description: 'Mathematical model files with variables and equations'
    }
  ];

  res.json({
    message: 'Supported file types retrieved successfully',
    supported_types: supportedTypes
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/specialized', specializedRoutes);
app.use('/api', apiRoutes);

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('Specialized routes loaded directly in index.ts');
});

export default app; 