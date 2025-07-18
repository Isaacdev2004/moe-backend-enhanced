import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from './auth.js';

const router = Router();

// Ensure uploads directory exists
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    cb(null, uploadsDir);
  },
  filename: (req: any, file: any, cb: any) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB limit
    files: 5 // Max 5 files per request
  }
});

// Helper function to clean up uploaded files
const cleanupFile = (filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error cleaning up file:', error);
  }
};

// Single file upload
router.post('/single', authenticateToken, upload.single('file'), (req: any, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileInfo = {
      id: uuidv4(),
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      uploadedBy: req.user?.userId,
      uploadedAt: new Date().toISOString()
    };

    res.status(201).json({
      message: 'File uploaded successfully',
      file: fileInfo
    });
  } catch (error) {
    // Clean up file if upload fails
    if (req.file) {
      cleanupFile(req.file.path);
    }
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Multiple files upload
router.post('/multiple', authenticateToken, upload.array('files', 5), (req: any, res: Response) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const files = (req.files as any[]).map(file => ({
      id: uuidv4(),
      originalName: file.originalname,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
      uploadedBy: req.user?.userId,
      uploadedAt: new Date().toISOString()
    }));

    res.status(201).json({
      message: 'Files uploaded successfully',
      files,
      count: files.length
    });
  } catch (error) {
    // Clean up files if upload fails
    if (req.files) {
      (req.files as any[]).forEach(file => cleanupFile(file.path));
    }
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get uploaded files for user
router.get('/files', authenticateToken, (req: any, res: Response) => {
  try {
    // In a real application, you would query a database
    // For now, we'll return a mock response
    res.json({
      files: [],
      message: 'No files found for this user'
    });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ error: 'Failed to retrieve files' });
  }
});

// Delete file
router.delete('/files/:fileId', authenticateToken, (req: any, res: Response) => {
  try {
    const { fileId } = req.params;
    
    // In a real application, you would delete from database and file system
    // For now, we'll just return success
    res.json({
      message: 'File deleted successfully',
      fileId
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export { router as uploadRoutes }; 