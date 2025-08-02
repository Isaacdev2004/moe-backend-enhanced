import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticateToken } from './auth.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
<<<<<<< HEAD
import { VectorDBService } from '../services/VectorDBService.js';
import { DocumentVector } from '../types/vector-db.js';
import { RAGPipelineService } from '../services/RAGPipelineService.js';

const router = Router();
const vectorDB = new VectorDBService();
const ragPipeline = new RAGPipelineService();
=======

const router = Router();
>>>>>>> d346b9dd437090be178afc69cb9687aaaaf0b11c

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

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedExtensions = ['.moz', '.dat', '.des', '.xml'];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${fileExtension}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  }
});

// Test endpoint to verify parser is working
router.get('/test', (req: Request, res: Response) => {
  console.log('Test endpoint called');
  try {
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
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({ error: 'Test endpoint failed' });
  }
});

<<<<<<< HEAD
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
    const startTime = Date.now(); // Add this line
    
    console.log(`Processing specialized file: ${req.file.originalname}`);

    // Parse the file using existing specialized parser
    const fileBuffer = fs.readFileSync(req.file.path);
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    // Simple parsing logic
    const fileType = path.extname(req.file.originalname).toLowerCase().substring(1);
    const parts = extractParts(fileBuffer.toString('utf8'), fileType);
    const parameters = extractParameters(fileBuffer.toString('utf8'), fileType);
    const constraints = extractConstraints(fileBuffer.toString('utf8'), fileType);
=======
// Upload and parse specialized file (simplified version)
router.post('/upload', authenticateToken, upload.single('file'), async (req: any, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`Processing file: ${req.file.originalname}, size: ${req.file.size} bytes`);

    const fileBuffer = fs.readFileSync(req.file.path);
    const content = fileBuffer.toString('utf8');
    
    // Simple parsing logic
    const fileType = path.extname(req.file.originalname).toLowerCase().substring(1);
    const parts = extractParts(content, fileType);
    const parameters = extractParameters(content, fileType);
    const constraints = extractConstraints(content, fileType);
>>>>>>> d346b9dd437090be178afc69cb9687aaaaf0b11c
    const brokenLogic = detectBrokenLogic(parts, parameters, constraints);

    const parseResult = {
      file_type: fileType,
      parts: parts,
      parameters: parameters,
      constraints: constraints,
      broken_logic: brokenLogic,
<<<<<<< HEAD
      version_metadata: {
        version: '1.0.0',
        major: 1,
        minor: 0,
        patch: 0,
        compatibility: [fileType]
      },
=======
>>>>>>> d346b9dd437090be178afc69cb9687aaaaf0b11c
      statistics: {
        total_parts: parts.length,
        total_parameters: parameters.length,
        total_constraints: constraints.length,
        broken_logic_count: brokenLogic.length,
<<<<<<< HEAD
        processing_time: Date.now() - startTime,
        file_size: req.file.size
      },
      errors: [] // Add errors array
    };

    if (parseResult.errors.length > 0 && parseResult.parts.length === 0) {
      return res.status(400).json({
        error: 'Parsing failed',
        message: 'Could not parse the specialized file',
        errors: parseResult.errors,
        file_info: {
          name: req.file.originalname,
          size: req.file.size,
          type: fileExtension
        }
      });
    }

    // Create document for vector database with specialized data
    const document: DocumentVector = {
      id: uuidv4(),
      title: `${req.file.originalname} - Specialized Components`,
      content: JSON.stringify(parseResult, null, 2), // Store structured data as content
      content_chunks: [],
      vectors: [],
      metadata: {
        filename: req.file.originalname,
        file_type: fileExtension.replace('.', ''),
        file_size: req.file.size,
        upload_date: new Date().toISOString(),
        uploaded_by: userId,
        tags: ['specialized', 'components', parseResult.file_type],
        category: 'specialized',
        language: 'en'
      },
      embeddings_model: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'processing'
    };

    // Add specialized data to document
    (document as any).specialized_data = {
      file_type: parseResult.file_type,
      parts: parseResult.parts,
      parameters: parseResult.parameters,
      constraints: parseResult.constraints,
      version_metadata: parseResult.version_metadata,
      broken_logic: parseResult.broken_logic,
      statistics: parseResult.statistics
    };

    // Store in vector database
    const documentId = await vectorDB.addDocument(document);
    
    console.log(`✅ Specialized document stored with ID: ${documentId}`);

    // Trigger automatic diagnostic analysis
    try {
      const diagnosticAnalysis = await ragPipeline.processFileUpload(
        documentId,
        userId,
        `Please analyze this ${parseResult.file_type} file and provide detailed diagnostics about its components, parameters, constraints, and any issues found.`
      );

      // Clean up uploaded file
      if (fs.existsSync(uploadedFilePath)) {
        fs.unlinkSync(uploadedFilePath);
      }

      res.status(200).json({
        message: 'Specialized file parsed, stored, and analyzed successfully',
        document_id: documentId,
        parse_result: parseResult,
        storage_info: {
          total_chunks: document.content_chunks.length,
          embedding_model: document.embeddings_model,
          status: 'ready'
        },
        ai_diagnostics: {
          session_id: diagnosticAnalysis.initial_response.session_id,
          analysis: diagnosticAnalysis.initial_response.response.message.content,
          diagnostic_summary: diagnosticAnalysis.diagnostic,
          recommendations: diagnosticAnalysis.recommendations,
          confidence_score: diagnosticAnalysis.initial_response.response.metadata.confidence_score,
          issues_found: parseResult.broken_logic.length,
          components_analyzed: parseResult.parts.length
        }
      });

    } catch (analysisError) {
      console.error('Diagnostic analysis failed:', analysisError);
      
      // Clean up uploaded file
      if (fs.existsSync(uploadedFilePath)) {
        fs.unlinkSync(uploadedFilePath);
      }

      res.status(200).json({
        message: 'Specialized file parsed and stored successfully',
        document_id: documentId,
        parse_result: parseResult,
        storage_info: {
          total_chunks: document.content_chunks.length,
          embedding_model: document.embeddings_model,
          status: 'ready'
        },
        warning: 'File processed successfully but AI diagnostics failed'
      });
    }

  } catch (error) {
    console.error('Specialized upload error:', error);
    
    // Clean up file on error
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }
    
    res.status(500).json({
      error: 'Upload and parsing failed',
      message: 'An error occurred while processing the specialized file',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
=======
        processing_time: Date.now(),
        file_size: req.file.size
      }
    };

    const response = {
      id: uuidv4(),
      filename: req.file.originalname,
      file_type: fileType,
      upload_date: new Date().toISOString(),
      uploaded_by: req.user?.userId,
      parse_result: parseResult,
      file_path: req.file.path
    };

    console.log(`Successfully parsed file: ${req.file.originalname}`);

    res.status(201).json({
      message: 'Specialized file uploaded and parsed successfully',
      data: response
    });
  } catch (error) {
    // Clean up file if parsing fails
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Specialized upload error:', error);
    res.status(500).json({ 
      error: 'Failed to parse specialized file',
      details: error instanceof Error ? error.message : 'Unknown error'
>>>>>>> d346b9dd437090be178afc69cb9687aaaaf0b11c
    });
  }
});

// Get supported file types
router.get('/supported-types', (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    console.error('Supported types error:', error);
    res.status(500).json({ error: 'Failed to retrieve supported types' });
  }
});

// Simple parsing functions
function extractParts(content: string, fileType: string): any[] {
  const parts: any[] = [];
  
  if (fileType === 'xml') {
    // Simple XML parsing
    const partMatches = content.match(/<part[^>]*>.*?<\/part>/gs);
    if (partMatches) {
      partMatches.forEach((match, index) => {
        const idMatch = match.match(/id="([^"]*)"/);
        const nameMatch = match.match(/<name>([^<]*)<\/name>/);
        parts.push({
          id: idMatch ? idMatch[1] : `part_${index}`,
          name: nameMatch ? nameMatch[1] : `Part ${index}`,
          type: 'component',
          parameters: [],
          constraints: [],
          status: 'valid'
        });
      });
    }
  } else if (fileType === 'moz') {
    // Simple MOZ parsing
    const mozMatches = content.match(/MOZ_[A-Z_]+/g);
    if (mozMatches) {
      mozMatches.forEach((match, index) => {
        parts.push({
          id: `moz_${index}`,
          name: match,
          type: 'moz_component',
          parameters: [],
          constraints: [],
          status: 'valid'
        });
      });
    }
  } else if (fileType === 'dat') {
    // Simple DAT parsing
    const datMatches = content.match(/DAT_[A-Z_]+/g);
    if (datMatches) {
      datMatches.forEach((match, index) => {
        parts.push({
          id: `dat_${index}`,
          name: match,
          type: 'dat_component',
          parameters: [],
          constraints: [],
          status: 'valid'
        });
      });
    }
  } else if (fileType === 'des') {
    // Simple DES parsing
    const desMatches = content.match(/DES_[A-Z_]+/g);
    if (desMatches) {
      desMatches.forEach((match, index) => {
        parts.push({
          id: `des_${index}`,
          name: match,
          type: 'des_component',
          parameters: [],
          constraints: [],
          status: 'valid'
        });
      });
    }
  }
  
  return parts;
}

function extractParameters(content: string, fileType: string): any[] {
  const parameters: any[] = [];
  
  if (fileType === 'xml') {
    // Simple XML parameter extraction
    const paramMatches = content.match(/<parameter[^>]*>.*?<\/parameter>/gs);
    if (paramMatches) {
      paramMatches.forEach((match, index) => {
        const nameMatch = match.match(/name="([^"]*)"/);
        const valueMatch = match.match(/value="([^"]*)"/);
        parameters.push({
          id: `param_${index}`,
          name: nameMatch ? nameMatch[1] : `Parameter ${index}`,
          value: valueMatch ? valueMatch[1] : '',
          type: 'string',
          required: false
        });
      });
    }
  } else {
    // Simple key-value extraction for MOZ/DAT/DES
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (line.includes('=')) {
        const [key, value] = line.split('=').map(s => s.trim());
        if (key && value) {
          parameters.push({
            id: `param_${index}`,
            name: key,
            value: value,
            type: 'string',
            required: false
          });
        }
      }
    });
  }
  
  return parameters;
}

function extractConstraints(content: string, fileType: string): any[] {
  const constraints: any[] = [];
  
  if (fileType === 'xml') {
    // Simple XML constraint extraction
    const constraintMatches = content.match(/<constraint[^>]*>.*?<\/constraint>/gs);
    if (constraintMatches) {
      constraintMatches.forEach((match, index) => {
        const nameMatch = match.match(/name="([^"]*)"/);
        constraints.push({
          id: `constraint_${index}`,
          name: nameMatch ? nameMatch[1] : `Constraint ${index}`,
          type: 'custom',
          value: match,
          severity: 'error'
        });
      });
    }
  } else {
    // Simple constraint extraction for MOZ/DAT/DES
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (line.toUpperCase().includes('CONSTRAINT')) {
        constraints.push({
          id: `constraint_${index}`,
          name: `Constraint ${index}`,
          type: 'custom',
          value: line,
          severity: 'error'
        });
      }
    });
  }
  
  return constraints;
}

function detectBrokenLogic(parts: any[], parameters: any[], constraints: any[]): any[] {
  const brokenLogic: any[] = [];
  
  // Check for missing required parameters
  parameters.forEach(param => {
    if (param.required && (!param.value || param.value === '')) {
      brokenLogic.push({
        part_id: 'unknown',
        issue_type: 'missing_parameter',
        severity: 'high',
        description: `Required parameter '${param.name}' is missing`,
        suggested_fix: `Add a value for parameter '${param.name}'`
      });
    }
  });
  
  // Check for invalid constraints
  constraints.forEach(constraint => {
    if (!constraint.value || constraint.value === '') {
      brokenLogic.push({
        part_id: 'unknown',
        issue_type: 'invalid_constraint',
        severity: 'medium',
        description: `Constraint '${constraint.name}' has no value`,
        suggested_fix: 'Add a valid value for the constraint'
      });
    }
  });
  
  return brokenLogic;
}

export { router as specializedRoutes }; 