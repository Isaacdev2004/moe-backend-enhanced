import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from './auth.js';
import { VectorDBService } from '../services/VectorDBService.js';
import { DocumentVector } from '../types/vector-db.js';
import { DocumentParserFactory } from '../services/ParserFactory.js';
import { UploadedFile } from '../types/uploaded-file.js';
import { AuthenticatedRequest } from './auth.js';
import { RAGPipelineService } from '../services/RAGPipelineService.js';

const router = Router();
const vectorDB = new VectorDBService();
const ragPipeline = new RAGPipelineService();

// Ensure uploads directory exists
const uploadsDir = process.env.UPLOAD_PATH || 'uploads';
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
    'text/plain',
    'text/csv',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/markdown',
    'application/json',
    'text/xml',
    'text/html',
    'application/xml'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not supported`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
  }
});

// Cleanup function for uploaded files
const cleanupFile = (filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error cleaning up file:', error);
  }
};

// Upload single file endpoint - enhanced with vector storage
router.post('/single', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user!.userId;
    const file = req.file;
    
    console.log(`Processing uploaded file: ${file.originalname} for user: ${userId}`);

    // Store file info
    const fileInfo: UploadedFile = {
      id: uuidv4(),
      originalName: file.originalname,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
      uploadedBy: userId,
      uploadedAt: new Date().toISOString()
    };

    // Process file with existing parser
    const parserFactory = new DocumentParserFactory();
    const fileType = parserFactory.getFileTypeFromFilename(file.originalname);
    
    if (fileType) {
      try {
        // Parse the file content
        const parseResult = await parserFactory.parseFile(file.path, fileType);
        
        // Create document for vector database
        const document: DocumentVector = {
          id: uuidv4(),
          title: file.originalname,
          content: parseResult.content,
          content_chunks: parseResult.chunks || [],
          vectors: [],
          metadata: {
            filename: file.originalname,
            file_type: fileType,
            file_size: file.size,
            upload_date: new Date().toISOString(),
            uploaded_by: userId,
            tags: ['uploaded', fileType],
            category: 'user_upload',
            language: 'en'
          },
          embeddings_model: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'processing'
        };

        // Store in vector database
        await vectorDB.addDocument(document);

        // Trigger RAG pipeline for automatic analysis
        await ragPipeline.processFileUpload(document, userId);

        res.status(201).json({
          message: 'File uploaded and processed successfully',
          file: fileInfo,
          parse_result: parseResult,
          vector_db_id: document.id
        });

      } catch (parseError) {
        console.error('File parsing error:', parseError);
        
        // Still store basic file info even if parsing fails
        res.status(201).json({
          message: 'File uploaded successfully (parsing failed)',
          file: fileInfo,
          warning: 'File content could not be parsed'
        });
      }
    } else {
      // Store file info for unsupported types
      res.status(201).json({
        message: 'File uploaded successfully',
        file: fileInfo,
        warning: 'File type not supported for parsing'
      });
    }

  } catch (error) {
    // Clean up file if upload fails
    if (req.file) {
      cleanupFile(req.file.path);
    }
    
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: 'An error occurred during file upload'
    });
  }
});

// Upload multiple files
router.post('/multiple', authenticateToken, upload.array('files', 10), (req: any, res: Response) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = req.files.map((file: any) => ({
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
      files: uploadedFiles
    });

  } catch (error) {
    // Clean up files if upload fails
    if (req.files) {
      req.files.forEach((file: any) => {
        cleanupFile(file.path);
      });
    }
    
    console.error('Multiple upload error:', error);
    res.status(500).json({ error: 'Multiple upload failed' });
  }
});

// Get user's uploaded files
router.get('/files', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    // In a real application, you would query the database for user's files
    // For now, return a mock response
    res.status(200).json({
      message: 'User files retrieved successfully',
      files: [],
      user_id: userId
    });

  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ error: 'Failed to retrieve files' });
  }
});

// Delete uploaded file
router.delete('/files/:fileId', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileId = req.params.fileId;
    const userId = req.user!.userId;
    
    // In a real application, you would delete the file from storage and database
    // For now, return a mock response
    res.status(200).json({
      message: 'File deleted successfully',
      file_id: fileId,
      user_id: userId
    });

  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export { router as uploadRoutes }; 