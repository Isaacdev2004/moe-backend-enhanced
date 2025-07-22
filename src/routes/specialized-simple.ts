import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticateToken } from './auth.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const router = Router();

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
  const allowedExtensions = ['.cab', '.cabx', '.mzb', '.xml'];
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
  try {
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
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({ error: 'Test endpoint failed' });
  }
});

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
    const brokenLogic = detectBrokenLogic(parts, parameters, constraints);

    const parseResult = {
      file_type: fileType,
      parts: parts,
      parameters: parameters,
      constraints: constraints,
      broken_logic: brokenLogic,
      statistics: {
        total_parts: parts.length,
        total_parameters: parameters.length,
        total_constraints: constraints.length,
        broken_logic_count: brokenLogic.length,
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
  } else if (fileType === 'cab' || fileType === 'cabx') {
    // Simple CAB parsing
    const cabMatches = content.match(/CAB_[A-Z_]+/g);
    if (cabMatches) {
      cabMatches.forEach((match, index) => {
        parts.push({
          id: `cab_${index}`,
          name: match,
          type: 'cab_component',
          parameters: [],
          constraints: [],
          status: 'valid'
        });
      });
    }
  } else if (fileType === 'mzb') {
    // Simple MZB parsing
    const mzbMatches = content.match(/MZB_[A-Z_]+/g);
    if (mzbMatches) {
      mzbMatches.forEach((match, index) => {
        parts.push({
          id: `mzb_${index}`,
          name: match,
          type: 'mzb_component',
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
    // Simple key-value extraction for CAB/CABX/MZB
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
    // Simple constraint extraction for CAB/CABX/MZB
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