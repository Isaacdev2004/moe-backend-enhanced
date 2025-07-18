import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from './auth.js';

const router = Router();

// Validation middleware
const validateProfileUpdate = [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Invalid email format')
];

// Protected route example
router.get('/protected', authenticateToken, (req: any, res: Response) => {
  res.json({
    message: 'This is a protected route',
    user: req.user
  });
});

// Get user profile
router.get('/profile', authenticateToken, (req: any, res: Response) => {
  res.json({
    message: 'User profile retrieved successfully',
    user: req.user
  });
});

// Update user profile
router.put('/profile', authenticateToken, validateProfileUpdate, (req: any, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email } = req.body;
  
  // In a real application, you would update the database
  res.json({
    message: 'Profile updated successfully',
    updatedFields: { name, email }
  });
});

// Get application status
router.get('/status', (req: Request, res: Response) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Sample data endpoint
router.get('/data', authenticateToken, (req: any, res: Response) => {
  const sampleData = [
    { id: 1, name: 'Item 1', description: 'Description for item 1' },
    { id: 2, name: 'Item 2', description: 'Description for item 2' },
    { id: 3, name: 'Item 3', description: 'Description for item 3' }
  ];
  
  res.json({
    data: sampleData,
    count: sampleData.length
  });
});

export { router as apiRoutes }; 