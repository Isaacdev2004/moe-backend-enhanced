import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateToken, AuthenticatedRequest } from './auth.js';
import { VectorDBService } from '../services/VectorDBService.js';
import { SearchQueryModel } from '../models/Document.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const vectorDB = new VectorDBService();

// Validation middleware
const validateSearch = [
  body('query')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Query must be between 1 and 500 characters'),
  body('filters').optional().isObject().withMessage('Filters must be an object'),
  body('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
];

const validateDocumentFilters = [
  query('file_types').optional().custom((value) => {
    if (typeof value === 'string') return true;
    if (Array.isArray(value)) return value.every(item => typeof item === 'string');
    return false;
  }).withMessage('File types must be string or array of strings'),
  query('categories').optional().custom((value) => {
    if (typeof value === 'string') return true;
    if (Array.isArray(value)) return value.every(item => typeof item === 'string');
    return false;
  }).withMessage('Categories must be string or array of strings'),
  query('tags').optional().custom((value) => {
    if (typeof value === 'string') return true;
    if (Array.isArray(value)) return value.every(item => typeof item === 'string');
    return false;
  }).withMessage('Tags must be string or array of strings'),
  query('start_date').optional().isISO8601().withMessage('Start date must be valid ISO 8601 date'),
  query('end_date').optional().isISO8601().withMessage('End date must be valid ISO 8601 date')
];

// Semantic search endpoint
router.post('/semantic', authenticateToken, validateSearch, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: errors.array()
      });
    }

    const { query, filters = {}, limit = 10 } = req.body;
    const userId = req.user!.userId;

    console.log(`Semantic search request from user ${userId}: "${query}"`);

    // Perform search
    const results = await vectorDB.search(query, filters, limit);

    // Save search query to history
    const searchQueryId = uuidv4();
    const searchQuery = new SearchQueryModel({
      id: searchQueryId,
      user_id: userId,
      query,
      filters,
      results,
      created_at: new Date().toISOString()
    });
    await searchQuery.save();

    res.status(200).json({
      message: 'Search completed successfully',
      query: {
        id: searchQueryId,
        text: query,
        filters,
        limit
      },
      results,
      metadata: {
        total_results: results.length,
        processing_time: Date.now() - req.startTime || 0,
        search_id: searchQueryId
      }
    });
  } catch (error) {
    console.error('Semantic search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: 'An error occurred while performing the search'
    });
  }
});

// Specialized component search endpoint
router.post('/specialized', authenticateToken, validateSearch, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: errors.array()
      });
    }

    const { query, component_types, limit = 10 } = req.body;

    console.log(`Specialized search request: "${query}" for components: ${component_types}`);

    // Perform specialized search
    const results = await vectorDB.searchSpecializedComponents(query, component_types, limit);

    res.status(200).json({
      message: 'Specialized search completed successfully',
      query: {
        text: query,
        component_types: component_types || ['parts', 'parameters', 'constraints'],
        limit
      },
      results,
      metadata: {
        total_results: results.length,
        processing_time: Date.now() - req.startTime || 0
      }
    });
  } catch (error) {
    console.error('Specialized search error:', error);
    res.status(500).json({
      error: 'Specialized search failed',
      message: 'An error occurred while performing the specialized search'
    });
  }
});

// Get user documents with filtering
router.get('/documents', authenticateToken, validateDocumentFilters, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user!.userId;
    const { file_types, categories, tags, start_date, end_date } = req.query;

    // Build filters
    const filters: any = {};
    if (file_types) {
      filters.file_types = Array.isArray(file_types) ? file_types : [file_types];
    }
    if (categories) {
      filters.categories = Array.isArray(categories) ? categories : [categories];
    }
    if (tags) {
      filters.tags = Array.isArray(tags) ? tags : [tags];
    }
    if (start_date || end_date) {
      filters.date_range = {};
      if (start_date) filters.date_range.start = start_date as string;
      if (end_date) filters.date_range.end = end_date as string;
    }

    const documents = await vectorDB.listDocuments(userId, filters);

    res.status(200).json({
      message: 'Documents retrieved successfully',
      documents,
      metadata: {
        total_documents: documents.length,
        filters_applied: Object.keys(filters).length > 0 ? filters : 'none'
      }
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      error: 'Failed to retrieve documents',
      message: 'An error occurred while retrieving documents'
    });
  }
});

// Get specific document by ID
router.get('/documents/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const document = await vectorDB.getDocument(id);

    if (!document) {
      return res.status(404).json({
        error: 'Document not found',
        message: `Document with ID ${id} does not exist`
      });
    }

    // Check if user owns the document
    if (document.metadata.uploaded_by !== req.user!.userId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to access this document'
      });
    }

    res.status(200).json({
      message: 'Document retrieved successfully',
      document
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({
      error: 'Failed to retrieve document',
      message: 'An error occurred while retrieving the document'
    });
  }
});

// Delete document
router.delete('/documents/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const document = await vectorDB.getDocument(id);

    if (!document) {
      return res.status(404).json({
        error: 'Document not found',
        message: `Document with ID ${id} does not exist`
      });
    }

    // Check if user owns the document
    if (document.metadata.uploaded_by !== req.user!.userId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to delete this document'
      });
    }

    await vectorDB.deleteDocument(id);

    res.status(200).json({
      message: 'Document deleted successfully',
      document_id: id
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      error: 'Failed to delete document',
      message: 'An error occurred while deleting the document'
    });
  }
});

// Get search history
router.get('/history', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 20;

    const searchHistory = await SearchQueryModel
      .find({ user_id: userId })
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();

    res.status(200).json({
      message: 'Search history retrieved successfully',
      history: searchHistory,
      metadata: {
        total_queries: searchHistory.length,
        limit
      }
    });
  } catch (error) {
    console.error('Get search history error:', error);
    res.status(500).json({
      error: 'Failed to retrieve search history',
      message: 'An error occurred while retrieving search history'
    });
  }
});

// Get search analytics
router.get('/analytics', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get overall statistics
    const stats = await vectorDB.getStats();

    // Get user-specific search statistics
    const userSearches = await SearchQueryModel.countDocuments({ user_id: userId });
    const recentSearches = await SearchQueryModel
      .find({ user_id: userId })
      .sort({ created_at: -1 })
      .limit(10)
      .lean();

    // Get user documents count
    const userDocuments = await vectorDB.listDocuments(userId);

    res.status(200).json({
      message: 'Analytics retrieved successfully',
      analytics: {
        global_stats: stats,
        user_stats: {
          total_searches: userSearches,
          total_documents: userDocuments.length,
          recent_searches: recentSearches.map(search => ({
            query: search.query,
            results_count: search.results.length,
            created_at: search.created_at
          }))
        }
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve analytics',
      message: 'An error occurred while retrieving analytics'
    });
  }
});

// System health check for vector database
router.get('/health', authenticateToken, async (req: Request, res: Response) => {
  try {
    const stats = await vectorDB.getStats();
    
    res.status(200).json({
      message: 'Vector database is healthy',
      status: 'healthy',
      statistics: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Vector DB health check error:', error);
    res.status(500).json({
      error: 'Vector database health check failed',
      status: 'unhealthy',
      timestamp: new Date().toISOString()
    });
  }
});

export { router as searchRoutes }; 