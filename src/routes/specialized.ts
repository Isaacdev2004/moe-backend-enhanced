import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticateToken } from './auth.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { VectorDBService } from '../services/VectorDBService.js';
import { DocumentVector } from '../types/vector-db.js';
import { RAGPipelineService } from '../services/RAGPipelineService.js';

const router = Router();
const vectorDB = new VectorDBService();
const ragPipeline = new RAGPipelineService();

console.log('Specialized routes module loaded successfully');

// Configure multer for specialized file uploads
const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    const uploadDir = 'uploads/specialized';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req: any, file: any, cb: any) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedTypes = ['.moz', '.dat', '.des', '.xml'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${fileExtension} not supported. Allowed types: ${allowedTypes.join(', ')}`));
    }
  },
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
  }
});

// Upload and parse specialized files - enhanced with vector storage
router.post('/upload', authenticateToken, upload.single('file'), async (req: any, res: Response) => {
  let uploadedFilePath: string | null = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file provided',
        message: 'Please select a file to upload (.moz, .dat, .des, or .xml)'
      });
    }

    uploadedFilePath = req.file.path;
    const userId = req.user?.userId;
    const startTime = Date.now();
    
    console.log(`Processing specialized file: ${req.file.originalname}`);

    const fileBuffer = fs.readFileSync(req.file.path);
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const fileType = fileExtension.substring(1);

    // Parse the specialized file
    const parts = extractParts(fileBuffer.toString('utf8'), fileType);
    const parameters = extractParameters(fileBuffer.toString('utf8'), fileType);
    const constraints = extractConstraints(fileBuffer.toString('utf8'), fileType);
    const brokenLogic = detectBrokenLogic(parts, parameters, constraints);

    const parseResult = {
      file_type: fileType,
      parts: parts,
      parameters: parameters,
      constraints: constraints,
      broken_logic: brokenLogic,
      version_metadata: {
        version: '1.0.0',
        parser_version: '1.0.0',
        compatibility: [fileType]
      },
      statistics: {
        total_parts: parts.length,
        total_parameters: parameters.length,
        total_constraints: constraints.length,
        broken_logic_count: brokenLogic.length,
        processing_time: Date.now() - startTime,
        file_size: req.file.size
      },
      errors: [],
      warnings: brokenLogic.length > 0 ? [`Found ${brokenLogic.length} potential issues`] : []
    };

    // Create document for vector database with specialized data
    const document: DocumentVector = {
      id: uuidv4(),
      title: `${req.file.originalname} - Specialized Components`,
      content: JSON.stringify(parseResult, null, 2), // Store structured data as content
      content_chunks: [],
      vectors: [],
      metadata: {
        filename: req.file.originalname,
        file_type: fileType,
        file_size: req.file.size,
        upload_date: new Date().toISOString(),
        uploaded_by: userId,
        tags: ['specialized', 'components', fileType],
        category: 'specialized',
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

    const response = {
      id: document.id,
      filename: req.file.originalname,
      file_type: fileType,
      upload_date: new Date().toISOString(),
      uploaded_by: userId,
      parse_result: parseResult,
      file_path: req.file.path,
      vector_db_id: document.id
    };

    console.log(`Successfully processed specialized file: ${req.file.originalname}`);

    res.status(201).json({
      message: 'Specialized file uploaded and parsed successfully',
      data: response
    });

  } catch (error) {
    // Clean up file if processing fails
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }
    
    console.error('Specialized upload error:', error);
    res.status(500).json({
      error: 'Failed to process specialized file',
      message: 'An error occurred while processing the specialized file',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    });
  }
});

// Get supported file types
router.get('/supported-types', (req: Request, res: Response) => {
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

// Test endpoint
router.get('/test', (req: Request, res: Response) => {
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

// Helper functions for parsing specialized files
function extractParts(content: string, fileType: string): any[] {
  const parts: any[] = [];
  
  try {
    // Extract parts based on file type
    if (fileType === 'xml') {
      const partMatches = content.match(/<part[^>]*>[\s\S]*?<\/part>/gi);
      if (partMatches) {
        partMatches.forEach((match, index) => {
          const nameMatch = match.match(/name=["']([^"']+)["']/i);
          const typeMatch = match.match(/type=["']([^"']+)["']/i);
          
          parts.push({
            id: `part_${index}`,
            name: nameMatch ? nameMatch[1] : `Part ${index + 1}`,
            type: typeMatch ? typeMatch[1] : 'unknown',
            content: match.trim()
          });
        });
      }
    } else if (fileType === 'moz') {
      const partMatches = content.match(/component[^}]*{[\s\S]*?}/gi);
      if (partMatches) {
        partMatches.forEach((match, index) => {
          const nameMatch = match.match(/name\s*:\s*["']([^"']+)["']/i);
          
          parts.push({
            id: `component_${index}`,
            name: nameMatch ? nameMatch[1] : `Component ${index + 1}`,
            type: 'component',
            content: match.trim()
          });
        });
      }
    }
  } catch (error) {
    console.error('Error extracting parts:', error);
  }
  
  return parts;
}

function extractParameters(content: string, fileType: string): any[] {
  const parameters: any[] = [];
  
  try {
    // Extract parameters based on file type
    if (fileType === 'xml') {
      const paramMatches = content.match(/<parameter[^>]*>[\s\S]*?<\/parameter>/gi);
      if (paramMatches) {
        paramMatches.forEach((match, index) => {
          const nameMatch = match.match(/name=["']([^"']+)["']/i);
          const valueMatch = match.match(/value=["']([^"']+)["']/i);
          const typeMatch = match.match(/type=["']([^"']+)["']/i);
          
          parameters.push({
            id: `param_${index}`,
            name: nameMatch ? nameMatch[1] : `Parameter ${index + 1}`,
            value: valueMatch ? valueMatch[1] : '',
            type: typeMatch ? typeMatch[1] : 'string',
            content: match.trim()
          });
        });
      }
    } else if (fileType === 'dat') {
      const paramMatches = content.match(/param[^}]*{[\s\S]*?}/gi);
      if (paramMatches) {
        paramMatches.forEach((match, index) => {
          const nameMatch = match.match(/name\s*:\s*["']([^"']+)["']/i);
          const valueMatch = match.match(/value\s*:\s*["']([^"']+)["']/i);
          
          parameters.push({
            id: `param_${index}`,
            name: nameMatch ? nameMatch[1] : `Parameter ${index + 1}`,
            value: valueMatch ? valueMatch[1] : '',
            type: 'data',
            content: match.trim()
          });
        });
      }
    }
  } catch (error) {
    console.error('Error extracting parameters:', error);
  }
  
  return parameters;
}

function extractConstraints(content: string, fileType: string): any[] {
  const constraints: any[] = [];
  
  try {
    // Extract constraints based on file type
    if (fileType === 'xml') {
      const constraintMatches = content.match(/<constraint[^>]*>[\s\S]*?<\/constraint>/gi);
      if (constraintMatches) {
        constraintMatches.forEach((match, index) => {
          const typeMatch = match.match(/type=["']([^"']+)["']/i);
          const valueMatch = match.match(/value=["']([^"']+)["']/i);
          
          constraints.push({
            id: `constraint_${index}`,
            type: typeMatch ? typeMatch[1] : 'unknown',
            value: valueMatch ? valueMatch[1] : '',
            content: match.trim()
          });
        });
      }
    } else if (fileType === 'des') {
      const constraintMatches = content.match(/constraint[^}]*{[\s\S]*?}/gi);
      if (constraintMatches) {
        constraintMatches.forEach((match, index) => {
          const typeMatch = match.match(/type\s*:\s*["']([^"']+)["']/i);
          
          constraints.push({
            id: `constraint_${index}`,
            type: typeMatch ? typeMatch[1] : 'unknown',
            value: '',
            content: match.trim()
          });
        });
      }
    }
  } catch (error) {
    console.error('Error extracting constraints:', error);
  }
  
  return constraints;
}

function detectBrokenLogic(parts: any[], parameters: any[], constraints: any[]): any[] {
  const issues: any[] = [];
  
  try {
    // Check for missing required parameters
    const requiredParams = parameters.filter(p => p.type === 'required');
    if (requiredParams.length === 0 && parts.length > 0) {
      issues.push({
        type: 'missing_required_params',
        severity: 'warning',
        message: 'No required parameters found for components'
      });
    }
    
    // Check for constraint violations
    constraints.forEach(constraint => {
      if (constraint.type === 'range') {
        const value = parseFloat(constraint.value);
        if (isNaN(value)) {
          issues.push({
            type: 'invalid_constraint_value',
            severity: 'error',
            message: `Invalid range constraint value: ${constraint.value}`,
            constraint_id: constraint.id
          });
        }
      }
    });
    
    // Check for orphaned parts
    if (parts.length > 0 && parameters.length === 0) {
      issues.push({
        type: 'orphaned_parts',
        severity: 'warning',
        message: 'Parts found without associated parameters'
      });
    }
    
  } catch (error) {
    console.error('Error detecting broken logic:', error);
  }
  
  return issues;
}

export { router as specializedRoutes }; 