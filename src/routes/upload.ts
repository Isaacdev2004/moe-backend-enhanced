import { Router, Request, Response } from 'express';
import multer from 'multer';
<<<<<<< HEAD
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
=======
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from './auth.js';

const router = Router();
>>>>>>> d346b9dd437090be178afc69cb9687aaaaf0b11c

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
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/x-zip-compressed'
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

<<<<<<< HEAD
// Upload single file endpoint - enhanced with vector storage
router.post('/single', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
=======
// Single file upload
router.post('/single', authenticateToken, upload.single('file'), (req: any, res: Response) => {
>>>>>>> d346b9dd437090be178afc69cb9687aaaaf0b11c
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

<<<<<<< HEAD
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
        const parser = parserFactory.createParser(fileType);
        const fileBuffer = fs.readFileSync(file.path);
        const parseResult = await parser.parse(fileBuffer, {
          filename: file.originalname,
          file_type: fileType,
          file_size: file.size,
          mime_type: file.mimetype,
          created_date: new Date().toISOString(),
          modified_date: new Date().toISOString()
        });

        // Create document for vector database
        const document: DocumentVector = {
          id: fileInfo.id,
          title: parseResult.metadata.title || file.originalname,
          content: parseResult.content,
          content_chunks: [], // Will be populated by VectorDBService
          vectors: [], // Will be populated by VectorDBService
          metadata: {
            filename: file.originalname,
            file_type: fileType,
            file_size: file.size,
            upload_date: new Date().toISOString(),
            uploaded_by: userId,
            tags: req.body.tags ? req.body.tags.split(',').map((tag: string) => tag.trim()) : [],
            category: req.body.category || 'general',
            language: parseResult.metadata.language || 'en',
            page_count: parseResult.metadata.page_count
          },
          embeddings_model: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'processing'
        };

        // Store in vector database
        const documentId = await vectorDB.addDocument(document);
        
        console.log(`✅ Document processed and stored with ID: ${documentId}`);

        // Trigger automatic RAG analysis for the uploaded file
        try {
          const autoAnalysis = await ragPipeline.processFileUpload(
            documentId,
            userId,
            `Please analyze this ${fileType} file and provide an overview of its contents, structure, and any potential issues.`
          );

          res.status(200).json({
            message: 'File uploaded and processed successfully',
            file: fileInfo,
            document: {
              id: documentId,
              title: document.title,
              status: 'ready',
              chunks_count: document.content_chunks.length,
              embedding_model: document.embeddings_model
            },
            parsing: {
              content_length: parseResult.content.length,
              sections_count: parseResult.sections.length,
              tables_count: parseResult.tables.length,
              links_count: parseResult.links.length,
              errors_count: parseResult.errors.length
            },
            ai_analysis: {
              session_id: autoAnalysis.initial_response.session_id,
              summary: autoAnalysis.initial_response.response.message.content,
              recommendations: autoAnalysis.recommendations,
              diagnostic_status: autoAnalysis.diagnostic.summary,
              confidence_score: autoAnalysis.initial_response.response.metadata.confidence_score
            }
          });
        } catch (analysisError) {
          console.error('Auto-analysis failed:', analysisError);
          
          // Still return success for upload, but without AI analysis
          res.status(200).json({
            message: 'File uploaded and processed successfully',
            file: fileInfo,
            document: {
              id: documentId,
              title: document.title,
              status: 'ready',
              chunks_count: document.content_chunks.length,
              embedding_model: document.embeddings_model
            },
            parsing: {
              content_length: parseResult.content.length,
              sections_count: parseResult.sections.length,
              tables_count: parseResult.tables.length,
              links_count: parseResult.links.length,
              errors_count: parseResult.errors.length
            },
            warning: 'File processed successfully but AI analysis failed'
          });
        }
      } catch (parseError) {
        console.error('Error parsing file:', parseError);
        
        // Still store file info but without processing
        res.status(200).json({
          message: 'File uploaded but could not be processed',
          file: fileInfo,
          warning: 'File parsing failed',
          error: String(parseError)
        });
      }
    } else {
      res.status(200).json({
        message: 'File uploaded successfully',
        file: fileInfo,
        warning: 'File type not supported for text extraction'
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up file if upload failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: 'Upload failed',
      message: 'An error occurred during file upload'
    });
=======
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
>>>>>>> d346b9dd437090be178afc69cb9687aaaaf0b11c
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