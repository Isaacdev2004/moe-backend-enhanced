import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { authenticateToken } from './auth.js';
import { VectorDBService } from '../services/VectorDBService.js';
import { DocumentModel, SearchQueryModel } from '../models/Document.js';
import { AuthenticatedRequest } from '../types/authenticated-request.js';

const router = Router();
const vectorDB = new VectorDBService();

// Validation middleware
const validateDateRange = [
  query('start_date').optional().isISO8601().withMessage('Start date must be valid ISO 8601 date'),
  query('end_date').optional().isISO8601().withMessage('End date must be valid ISO 8601 date'),
  query('granularity').optional().isIn(['day', 'week', 'month']).withMessage('Granularity must be day, week, or month')
];

// Get comprehensive analytics dashboard
router.get('/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get overall system statistics
    const systemStats = await vectorDB.getStats();

    // User-specific document statistics
    const userDocuments = await DocumentModel.find({ 'metadata.uploaded_by': userId }).lean();
    
    // User search statistics
    const userSearches = await SearchQueryModel.find({ user_id: userId }).lean();
    
    // Document type distribution
    const documentTypeStats = await DocumentModel.aggregate([
      { $match: { 'metadata.uploaded_by': userId } },
      { $group: { 
          _id: '$metadata.file_type', 
          count: { $sum: 1 },
          total_size: { $sum: '$metadata.file_size' },
          avg_vectors: { $avg: { $size: { $ifNull: ['$vectors', []] } } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Search frequency over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const searchTrends = await SearchQueryModel.aggregate([
      { 
        $match: { 
          user_id: userId,
          created_at: { $gte: thirtyDaysAgo.toISOString() }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: { $dateFromString: { dateString: "$created_at" } } } },
          search_count: { $sum: 1 },
          avg_results: { $avg: { $size: '$results' } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Most searched terms
    const popularQueries = await SearchQueryModel.aggregate([
      { $match: { user_id: userId } },
      { $group: { _id: '$query', count: { $sum: 1 }, last_searched: { $max: '$created_at' } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Processing performance metrics
    const processingStats = await DocumentModel.aggregate([
      { $match: { 'metadata.uploaded_by': userId, status: 'ready' } },
      { 
        $project: {
          processing_time: {
            $dateDiff: {
              startDate: { $dateFromString: { dateString: '$created_at' } },
              endDate: { $dateFromString: { dateString: '$updated_at' } },
              unit: 'millisecond'
            }
          },
          vector_count: { $size: { $ifNull: ['$vectors', []] } },
          content_length: { $strLenCP: '$content' }
        }
      },
      {
        $group: {
          _id: null,
          avg_processing_time: { $avg: '$processing_time' },
          avg_vectors_per_doc: { $avg: '$vector_count' },
          avg_content_length: { $avg: '$content_length' }
        }
      }
    ]);

    // Specialized components analytics (if any)
    const specializedStats = await DocumentModel.aggregate([
      { 
        $match: { 
          'metadata.uploaded_by': userId,
          'specialized_data': { $exists: true }
        }
      },
      {
        $group: {
          _id: '$specialized_data.file_type',
          total_parts: { $sum: { $size: { $ifNull: ['$specialized_data.parts', []] } } },
          total_parameters: { $sum: { $size: { $ifNull: ['$specialized_data.parameters', []] } } },
          total_constraints: { $sum: { $size: { $ifNull: ['$specialized_data.constraints', []] } } },
          avg_broken_logic: { $avg: { $size: { $ifNull: ['$specialized_data.broken_logic', []] } } },
          document_count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      message: 'Analytics dashboard retrieved successfully',
      dashboard: {
        system_overview: systemStats,
        user_summary: {
          total_documents: userDocuments.length,
          total_searches: userSearches.length,
          total_storage_used: userDocuments.reduce((sum, doc) => sum + (doc.metadata?.file_size || 0), 0),
          account_created: req.user?.iat ? new Date(req.user.iat * 1000).toISOString() : null
        },
        document_analytics: {
          type_distribution: documentTypeStats,
          processing_performance: processingStats[0] || null,
          status_breakdown: {
            ready: userDocuments.filter(doc => doc.status === 'ready').length,
            processing: userDocuments.filter(doc => doc.status === 'processing').length,
            error: userDocuments.filter(doc => doc.status === 'error').length
          }
        },
        search_analytics: {
          trends: searchTrends,
          popular_queries: popularQueries,
          avg_results_per_search: userSearches.length > 0 
            ? userSearches.reduce((sum, search) => sum + (search.results?.length || 0), 0) / userSearches.length 
            : 0
        },
        specialized_analytics: specializedStats.length > 0 ? {
          components_by_type: specializedStats,
          total_specialized_docs: specializedStats.reduce((sum, stat) => sum + stat.document_count, 0)
        } : null
      },
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(500).json({
      error: 'Failed to generate analytics dashboard',
      message: 'An error occurred while generating analytics'
    });
  }
});

// Get document usage trends over time
router.get('/trends', authenticateToken, validateDateRange, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user!.userId;
    const { start_date, end_date, granularity = 'day' } = req.query;

    // Default to last 30 days if no dates provided
    const endDate = end_date ? new Date(end_date as string) : new Date();
    const startDate = start_date ? new Date(start_date as string) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Date format based on granularity
    const dateFormat = granularity === 'month' ? '%Y-%m' : granularity === 'week' ? '%Y-W%U' : '%Y-%m-%d';

    // Document upload trends
    const uploadTrends = await DocumentModel.aggregate([
      {
        $match: {
          'metadata.uploaded_by': userId,
          created_at: { 
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString()
          }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: { $dateFromString: { dateString: '$created_at' } } } },
          upload_count: { $sum: 1 },
          total_size: { $sum: '$metadata.file_size' },
          file_types: { $addToSet: '$metadata.file_type' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Search trends
    const searchTrends = await SearchQueryModel.aggregate([
      {
        $match: {
          user_id: userId,
          created_at: { 
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString()
          }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: { $dateFromString: { dateString: '$created_at' } } } },
          search_count: { $sum: 1 },
          unique_queries: { $addToSet: '$query' },
          avg_results: { $avg: { $size: '$results' } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      message: 'Usage trends retrieved successfully',
      trends: {
        period: {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          granularity
        },
        uploads: uploadTrends,
        searches: searchTrends,
        summary: {
          total_uploads: uploadTrends.reduce((sum, trend) => sum + trend.upload_count, 0),
          total_searches: searchTrends.reduce((sum, trend) => sum + trend.search_count, 0),
          total_data_uploaded: uploadTrends.reduce((sum, trend) => sum + trend.total_size, 0)
        }
      }
    });
  } catch (error) {
    console.error('Trends analytics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve usage trends',
      message: 'An error occurred while analyzing usage trends'
    });
  }
});

// Get search performance metrics
router.get('/search-performance', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Recent search performance
    const recentSearches = await SearchQueryModel
      .find({ user_id: userId })
      .sort({ created_at: -1 })
      .limit(100)
      .lean();

    if (recentSearches.length === 0) {
      return res.status(200).json({
        message: 'No search data available',
        performance: {
          total_searches: 0,
          avg_results_per_search: 0,
          search_success_rate: 0,
          most_effective_queries: []
        }
      });
    }

    // Calculate performance metrics
    const totalResults = recentSearches.reduce((sum, search) => sum + (search.results?.length || 0), 0);
    const successfulSearches = recentSearches.filter(search => (search.results?.length || 0) > 0);
    
    // Find most effective queries (high result count)
    const queryEffectiveness = recentSearches
      .filter(search => (search.results?.length || 0) > 0)
      .map(search => ({
        query: search.query,
        results_count: search.results?.length || 0,
        avg_similarity: search.results?.length > 0 
          ? search.results.reduce((sum: number, result: any) => sum + (result.similarity_score || 0), 0) / search.results.length
          : 0,
        created_at: search.created_at
      }))
      .sort((a, b) => b.avg_similarity - a.avg_similarity)
      .slice(0, 10);

    res.status(200).json({
      message: 'Search performance metrics retrieved successfully',
      performance: {
        total_searches: recentSearches.length,
        successful_searches: successfulSearches.length,
        search_success_rate: (successfulSearches.length / recentSearches.length) * 100,
        avg_results_per_search: totalResults / recentSearches.length,
        avg_results_per_successful_search: successfulSearches.length > 0 
          ? totalResults / successfulSearches.length 
          : 0,
        most_effective_queries: queryEffectiveness,
        recent_search_history: recentSearches.slice(0, 20).map(search => ({
          query: search.query,
          results_count: search.results?.length || 0,
          created_at: search.created_at
        }))
      },
      analysis_period: '100 most recent searches'
    });
  } catch (error) {
    console.error('Search performance error:', error);
    res.status(500).json({
      error: 'Failed to analyze search performance',
      message: 'An error occurred while analyzing search performance'
    });
  }
});

// Export usage data for external analysis
router.get('/export', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const format = req.query.format as string || 'json';

    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        error: 'Invalid format',
        message: 'Format must be either json or csv'
      });
    }

    // Get all user data
    const documents = await DocumentModel.find({ 'metadata.uploaded_by': userId }).lean();
    const searches = await SearchQueryModel.find({ user_id: userId }).lean();

    const exportData = {
      export_info: {
        user_id: userId,
        generated_at: new Date().toISOString(),
        total_documents: documents.length,
        total_searches: searches.length
      },
      documents: documents.map(doc => ({
        id: doc.id,
        title: doc.title,
        file_type: doc.metadata?.file_type,
        file_size: doc.metadata?.file_size,
        upload_date: doc.metadata?.upload_date,
        status: doc.status,
        chunks_count: doc.vectors?.length || 0,
        embedding_model: doc.embeddings_model
      })),
      searches: searches.map(search => ({
        query: search.query,
        results_count: search.results?.length || 0,
        created_at: search.created_at,
        filters_used: Object.keys(search.filters || {}).length > 0
      }))
    };

    if (format === 'csv') {
      // Simple CSV export for documents
      const csvHeaders = 'ID,Title,File Type,File Size,Upload Date,Status,Chunks Count,Embedding Model\n';
      const csvData = exportData.documents.map(doc => 
        `"${doc.id}","${doc.title}","${doc.file_type}",${doc.file_size},"${doc.upload_date}","${doc.status}",${doc.chunks_count},"${doc.embedding_model}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="moe-analytics-${userId}-${Date.now()}.csv"`);
      return res.send(csvHeaders + csvData);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="moe-analytics-${userId}-${Date.now()}.json"`);
    res.status(200).json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      error: 'Failed to export analytics data',
      message: 'An error occurred while exporting data'
    });
  }
});

export { router as analyticsRoutes }; 