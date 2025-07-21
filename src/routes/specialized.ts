import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticateToken } from './auth.js';
import { SpecializedParser } from '../services/parsers/SpecializedParser.js';
import { TestFileGenerator } from '../services/parsers/TestFileGenerator.js';
import { SpecializedFileType } from '../types/specialized-parser.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const router = Router();
const specializedParser = new SpecializedParser();
const testGenerator = new TestFileGenerator();

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
  const allowedTypes = [
    'application/xml',
    'text/xml',
    'text/plain',
    'application/octet-stream'
  ];

  const allowedExtensions = ['.cab', '.cabx', '.mzb', '.xml'];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for specialized files
    files: 1
  }
});

// Upload and parse specialized file
router.post('/upload', authenticateToken, upload.single('file'), async (req: any, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const metadata = {
      filename: req.file.originalname,
      file_type: 'xml' as any,
      file_size: req.file.size,
      mime_type: req.file.mimetype
    };

    // Parse the specialized file
    const parseResult = await specializedParser.parseSpecialized(fileBuffer, metadata);

    // Create response with parsing results
    const response = {
      id: uuidv4(),
      filename: req.file.originalname,
      file_type: parseResult.file_type,
      upload_date: new Date().toISOString(),
      uploaded_by: req.user?.userId,
      parse_result: parseResult,
      file_path: req.file.path
    };

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

// Get parsing statistics
router.get('/statistics', authenticateToken, async (req: any, res: Response) => {
  try {
    // In a real application, you would query the database
    // For now, return mock statistics
    const stats = {
      total_files_parsed: 0,
      files_by_type: {
        [SpecializedFileType.XML]: 0,
        [SpecializedFileType.CAB]: 0,
        [SpecializedFileType.CABX]: 0,
        [SpecializedFileType.MZB]: 0
      },
      total_parts_extracted: 0,
      total_parameters_extracted: 0,
      total_constraints_extracted: 0,
      broken_logic_detected: 0,
      average_processing_time: 0
    };

    res.json({
      message: 'Statistics retrieved successfully',
      statistics: stats
    });
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

// Get supported file types
router.get('/supported-types', (req: Request, res: Response) => {
  try {
    const supportedTypes = [
      {
        type: SpecializedFileType.XML,
        extensions: ['.xml'],
        mime_types: ['application/xml', 'text/xml'],
        description: 'XML files with parts, parameters, and constraints'
      },
      {
        type: SpecializedFileType.CAB,
        extensions: ['.cab'],
        mime_types: ['text/plain', 'application/octet-stream'],
        description: 'CAB component files with parameters and constraints'
      },
      {
        type: SpecializedFileType.CABX,
        extensions: ['.cabx'],
        mime_types: ['text/plain', 'application/octet-stream'],
        description: 'Extended CAB files with advanced features'
      },
      {
        type: SpecializedFileType.MZB,
        extensions: ['.mzb'],
        mime_types: ['text/plain', 'application/octet-stream'],
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

// Generate test files
router.post('/generate-tests', authenticateToken, async (req: any, res: Response) => {
  try {
    const testCases = testGenerator.generateAllTestFiles();
    
    res.json({
      message: 'Test files generated successfully',
      test_cases: testCases,
      files_created: testCases.length
    });
  } catch (error) {
    console.error('Test generation error:', error);
    res.status(500).json({ error: 'Failed to generate test files' });
  }
});

// Run test cases
router.post('/run-tests', authenticateToken, async (req: any, res: Response) => {
  try {
    const testCases = testGenerator.generateAllTestFiles();
    const results = [];

    for (const testCase of testCases) {
      try {
        const fileBuffer = fs.readFileSync(testCase.sample_file_path);
        const metadata = {
          filename: path.basename(testCase.sample_file_path),
          file_type: 'xml' as any,
          file_size: fileBuffer.length,
          mime_type: 'text/plain'
        };

        const parseResult = await specializedParser.parseSpecialized(fileBuffer, metadata);
        
        const actualResults = {
          parts_count: parseResult.parts.length,
          parameters_count: parseResult.parameters.length,
          constraints_count: parseResult.constraints.length,
          broken_logic_count: parseResult.broken_logic.length,
          errors_count: parseResult.errors.length
        };

        const passed = this.compareResults(testCase.expected_results, actualResults);

        results.push({
          test_case: testCase,
          actual_results: actualResults,
          passed,
          parse_result: parseResult
        });
      } catch (error) {
        results.push({
          test_case: testCase,
          error: error instanceof Error ? error.message : 'Unknown error',
          passed: false
        });
      }
    }

    const passedTests = results.filter(r => r.passed).length;
    const totalTests = results.length;

    res.json({
      message: 'Test cases executed successfully',
      results,
      summary: {
        total_tests: totalTests,
        passed_tests: passedTests,
        failed_tests: totalTests - passedTests,
        success_rate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0
      }
    });
  } catch (error) {
    console.error('Test execution error:', error);
    res.status(500).json({ error: 'Failed to execute test cases' });
  }
});

// Clean up test files
router.delete('/cleanup-tests', authenticateToken, async (req: any, res: Response) => {
  try {
    testGenerator.cleanupTestFiles();
    
    res.json({
      message: 'Test files cleaned up successfully'
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup test files' });
  }
});

// Get parsing configuration
router.get('/config', (req: Request, res: Response) => {
  try {
    const config = {
      enable_version_detection: true,
      enable_broken_logic_detection: true,
      enable_dependency_analysis: true,
      strict_mode: false,
      max_file_size: 50 * 1024 * 1024, // 50MB
      allowed_file_types: [
        SpecializedFileType.CAB,
        SpecializedFileType.CABX,
        SpecializedFileType.MZB,
        SpecializedFileType.XML
      ],
      validation_rules: []
    };

    res.json({
      message: 'Configuration retrieved successfully',
      config
    });
  } catch (error) {
    console.error('Config error:', error);
    res.status(500).json({ error: 'Failed to retrieve configuration' });
  }
});

// Update parsing configuration
router.put('/config', authenticateToken, async (req: any, res: Response) => {
  try {
    const { config } = req.body;
    
    // In a real application, you would validate and save the configuration
    // For now, just return success
    
    res.json({
      message: 'Configuration updated successfully',
      config
    });
  } catch (error) {
    console.error('Config update error:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// Helper method to compare test results
private compareResults(expected: any, actual: any): boolean {
  for (const key in expected) {
    if (expected[key] !== actual[key]) {
      return false;
    }
  }
  return true;
}

export { router as specializedRoutes }; 