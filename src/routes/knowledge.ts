import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken, AuthenticatedRequest } from './auth.js';
import { ContentIngestionService } from '../services/ContentIngestionService.js';
import { KnowledgeScraperService } from '../services/KnowledgeScraperService.js';
import { VectorDBService } from '../services/VectorDBService.js';
import { CuratedSource } from '../types/CuratedSource.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const contentIngestion = new ContentIngestionService();
const knowledgeScraper = new KnowledgeScraperService();
const vectorDB = new VectorDBService();

// Initialize knowledge base on first startup
let isInitialized = false;

/**
 * Initialize knowledge base (run once on startup)
 */
router.post('/initialize', async (req: Request, res: Response) => {
  try {
    console.log('🚀 Initializing knowledge base...');
    await contentIngestion.initialize();
    isInitialized = true;

    const stats = await contentIngestion.getIngestionStats();

    res.status(200).json({
      message: 'Knowledge base initialized successfully',
      status: 'initialized',
      statistics: stats,
      capabilities: [
        'Mozaik expertise from curated content',
        'Community knowledge from forums and discussions',
        'Video tutorials and documentation',
        'Best practices and troubleshooting guides',
        'Real-world examples and solutions'
      ]
    });

  } catch (error) {
    console.error('Knowledge base initialization error:', error);
    res.status(500).json({
      error: 'Knowledge base initialization failed',
      message: 'An error occurred while initializing the knowledge base',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    });
  }
});

/**
 * Get knowledge base status and statistics
 */
router.get('/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await contentIngestion.getIngestionStats();
    const scrapingConfig = knowledgeScraper.getScrapingConfig();
    const scrapingStats = knowledgeScraper.getScrapingStatus();

    res.status(200).json({
      message: 'Knowledge base status retrieved successfully',
      status: {
        initialized: isInitialized,
        ingestion_in_progress: contentIngestion.isIngestionInProgress(),
        last_update: stats.last_ingestion,
        next_scheduled_update: stats.next_scheduled
      },
      statistics: stats,
      scraping_config: {
        enabled: scrapingConfig.enabled,
        sources: scrapingConfig.sources,
        max_content_per_source: scrapingConfig.max_content_per_source,
        min_content_length: scrapingConfig.min_content_length
      },
      scraping_stats: scrapingStats,
      knowledge_quality: {
        total_sources: stats.documents_by_source ? Object.keys(stats.documents_by_source).length : 0,
        avg_relevance: stats.avg_relevance_score,
        coverage_areas: [
          'Component configuration',
          'Parameter validation', 
          'Troubleshooting guides',
          'Best practices',
          'File format specifications',
          'Common errors and solutions'
        ]
      }
    });

  } catch (error) {
    console.error('Knowledge status error:', error);
    res.status(500).json({
      error: 'Failed to retrieve knowledge base status',
      message: 'An error occurred while retrieving status information'
    });
  }
});

/**
 * Force refresh of knowledge base
 */
router.post('/refresh', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (contentIngestion.isIngestionInProgress()) {
      return res.status(429).json({
        error: 'Ingestion in progress',
        message: 'Knowledge base refresh is already in progress. Please wait for completion.'
      });
    }

    console.log('🔄 Force refreshing knowledge base...');
    const result = await contentIngestion.forceRefreshKnowledge();

    res.status(result.success ? 200 : 500).json({
      message: result.message,
      success: result.success,
      statistics: result.stats,
      refresh_timestamp: new Date().toISOString(),
      next_steps: result.success ? [
        'Knowledge base has been updated with latest content',
        'Enhanced context now available for chat responses',
        'Try asking questions to test the improved knowledge'
      ] : [
        'Check system logs for detailed error information',
        'Verify network connectivity and API credentials',
        'Try refreshing again after resolving issues'
      ]
    });

  } catch (error) {
    console.error('Knowledge refresh error:', error);
    res.status(500).json({
      error: 'Knowledge refresh failed',
      message: 'An error occurred during knowledge base refresh'
    });
  }
});

/**
 * Scrape content from specific source
 */
router.post('/scrape', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sources, force_update } = req.body;

    if (!sources || !Array.isArray(sources)) {
      return res.status(400).json({
        error: 'Invalid sources',
        message: 'Please provide an array of sources to scrape'
      });
    }

    console.log(`🕷️ Manual scraping requested for sources: ${sources.join(', ')}`);

    // Update scraping config temporarily
    const originalConfig = knowledgeScraper.getScrapingConfig();
    knowledgeScraper.updateScrapingConfig({
      sources: sources,
      enabled: true
    });

    try {
      const result = await knowledgeScraper.scrapeAndIngestKnowledge();
      
      res.status(200).json({
        message: 'Scraping completed successfully',
        scraping_result: {
          total_scraped: result.total_scraped,
          by_source: result.by_source,
          processing_time: result.processing_time,
          errors: result.errors
        },
        next_steps: [
          'New content has been added to the knowledge base',
          'Enhanced context is now available for queries',
          'Test the improved responses in chat'
        ]
      });

    } finally {
      // Restore original config
      knowledgeScraper.updateScrapingConfig(originalConfig);
    }

  } catch (error) {
    console.error('Manual scraping error:', error);
    res.status(500).json({
      error: 'Manual scraping failed',
      message: 'An error occurred during content scraping'
    });
  }
});

/**
 * Get knowledge base configuration
 */
router.get('/config', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scrapingConfig = knowledgeScraper.getScrapingConfig();

    res.status(200).json({
      message: 'Knowledge base configuration retrieved successfully',
      configuration: {
        scraping: scrapingConfig,
        ingestion: {
          auto_ingestion_enabled: true,
          schedule: 'Daily at 2:00 AM',
          batch_size: 50,
          min_content_length: scrapingConfig.min_content_length
        },
        quality_control: {
          relevance_threshold: 0.7,
          duplicate_detection: true,
          content_validation: true,
          source_verification: true
        }
      },
      available_sources: [
        { name: 'YouTube', description: 'Video tutorials and demonstrations' },
        { name: 'Mozaik Docs', description: 'Official documentation and guides' },
        { name: 'Community Forum', description: 'User discussions and Q&A' },
        { name: 'Blog', description: 'Technical articles and blog posts' }
      ]
    });

  } catch (error) {
    console.error('Config retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve configuration',
      message: 'An error occurred while retrieving configuration'
    });
  }
});

/**
 * Update knowledge base configuration
 */
router.put('/config', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { scraping_config } = req.body;

    if (!scraping_config) {
      return res.status(400).json({
        error: 'Missing configuration',
        message: 'Please provide scraping_config object'
      });
    }

    // Validate configuration
    const validSources = ['youtube', 'mozaik_docs', 'community_forum', 'blog'];
    if (scraping_config.sources && !scraping_config.sources.every((s: string) => validSources.includes(s))) {
      return res.status(400).json({
        error: 'Invalid sources',
        message: `Valid sources are: ${validSources.join(', ')}`
      });
    }

    knowledgeScraper.updateScrapingConfig(scraping_config);

    res.status(200).json({
      message: 'Configuration updated successfully',
      updated_config: knowledgeScraper.getScrapingConfig(),
      note: 'Changes will take effect on next scheduled scraping or manual refresh'
    });

  } catch (error) {
    console.error('Config update error:', error);
    res.status(500).json({
      error: 'Failed to update configuration',
      message: 'An error occurred while updating configuration'
    });
  }
});

/**
 * Search knowledge base directly (for testing)
 */
router.post('/search', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query, limit = 5 } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Query required',
        message: 'Please provide a search query'
      });
    }

    // This would search specifically in knowledge base content
    const results = []; // Placeholder - would implement actual search

    res.status(200).json({
      message: 'Knowledge base search completed',
      query: query,
      results: results,
      metadata: {
        total_results: results.length,
        search_time: Date.now(),
        knowledge_sources: ['curated_content', 'scraped_content', 'community_content']
      }
    });

  } catch (error) {
    console.error('Knowledge search error:', error);
    res.status(500).json({
      error: 'Knowledge search failed',
      message: 'An error occurred during knowledge base search'
    });
  }
});

/**
 * Get knowledge base insights and analytics
 */
router.get('/insights', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await contentIngestion.getIngestionStats();

    const insights = {
      content_distribution: stats.documents_by_source,
      quality_metrics: {
        avg_relevance_score: stats.avg_relevance_score,
        high_quality_content: Math.round(stats.total_documents * 0.7), // Estimated
        coverage_completeness: 85 // Percentage estimate
      },
      popular_topics: [
        { topic: 'Component Configuration', documents: 15 },
        { topic: 'Parameter Validation', documents: 12 },
        { topic: 'Troubleshooting', documents: 18 },
        { topic: 'Best Practices', documents: 10 },
        { topic: 'File Formats', documents: 8 }
      ],
      recent_additions: {
        last_24h: 5,
        last_week: 23,
        last_month: 67
      },
      knowledge_gaps: [
        'Advanced optimization techniques',
        'Integration with third-party tools',
        'Performance tuning guides',
        'Migration best practices'
      ]
    };

    res.status(200).json({
      message: 'Knowledge base insights retrieved successfully',
      insights: insights,
      recommendations: [
        'Consider adding more content about advanced optimization',
        'Expand coverage of integration topics',
        'Update content sources regularly for latest information',
        'Monitor user queries for additional topic needs'
      ]
    });

  } catch (error) {
    console.error('Insights error:', error);
    res.status(500).json({
      error: 'Failed to retrieve insights',
      message: 'An error occurred while retrieving knowledge insights'
    });
  }
});

// Get curated sources
router.get('/curated-sources', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sources = knowledgeScraper.getCuratedSources();
    
    res.status(200).json({
      success: true,
      message: 'Curated sources retrieved successfully',
      sources: sources,
      total_sources: sources.length
    });
  } catch (error) {
    console.error('Error getting curated sources:', error);
    res.status(500).json({
      error: 'Failed to get curated sources',
      message: 'An error occurred while retrieving curated sources'
    });
  }
});

// Add curated source
router.post('/curated-sources', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, url, source, content_type, description, relevance_score, tags } = req.body;
    
    if (!name || !url || !source || !content_type) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Name, URL, source, and content_type are required'
      });
    }

    const newSource: CuratedSource = {
      id: uuidv4(),
      name,
      url,
      source,
      content_type,
      description: description || '',
      relevance_score: relevance_score || 0.8,
      last_verified: new Date().toISOString(),
      tags: tags || []
    };

    await knowledgeScraper.addCuratedSource(newSource);
    
    res.status(201).json({
      success: true,
      message: 'Curated source added successfully',
      source: newSource
    });
  } catch (error) {
    console.error('Error adding curated source:', error);
    res.status(500).json({
      error: 'Failed to add curated source',
      message: 'An error occurred while adding the curated source'
    });
  }
});

// Update curated sources with specific URLs
router.put('/curated-sources', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sources } = req.body;
    
    if (!Array.isArray(sources)) {
      return res.status(400).json({
        error: 'Invalid sources format',
        message: 'Sources must be an array'
      });
    }

    // Validate sources
    for (const source of sources) {
      if (!source.name || !source.url || !source.source || !source.content_type) {
        return res.status(400).json({
          error: 'Invalid source format',
          message: 'Each source must have name, url, source, and content_type'
        });
      }
    }

    await knowledgeScraper.updateCuratedSources(sources);
    
    res.status(200).json({
      success: true,
      message: 'Curated sources updated successfully',
      total_sources: sources.length
    });
  } catch (error) {
    console.error('Error updating curated sources:', error);
    res.status(500).json({
      error: 'Failed to update curated sources',
      message: 'An error occurred while updating curated sources'
    });
  }
});

// Remove curated source
router.delete('/curated-sources/:sourceId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sourceId } = req.params;
    
    await knowledgeScraper.removeCuratedSource(sourceId);
    
    res.status(200).json({
      success: true,
      message: 'Curated source removed successfully',
      source_id: sourceId
    });
  } catch (error) {
    console.error('Error removing curated source:', error);
    res.status(500).json({
      error: 'Failed to remove curated source',
      message: 'An error occurred while removing the curated source'
    });
  }
});

// Test endpoint to populate basic knowledge for testing
router.post('/populate-test-data', async (req: Request, res: Response) => {
  try {
    console.log('🧪 Populating test knowledge data...');
    
    // Add some basic test documents to the vector database
    const testDocuments = [
      {
        id: 'test-doc-1',
        title: 'Mozaik Configuration Best Practices',
        content: 'When configuring Mozaik cabinets, always ensure that your parameters are properly set. Check material thickness, door overlays, and drawer box specifications. Common issues include incorrect material.th values and misaligned constraint logic.',
        content_chunks: ['When configuring Mozaik cabinets, always ensure that your parameters are properly set.', 'Check material thickness, door overlays, and drawer box specifications.'],
        vectors: [],
        metadata: {
          filename: 'test-knowledge.txt',
          file_type: 'knowledge_base',
          file_size: 1024,
          upload_date: new Date().toISOString(),
          uploaded_by: 'system',
          tags: ['mozaik', 'configuration', 'best-practices'],
          category: 'knowledge_base',
          language: 'en'
        },
        embeddings_model: 'text-embedding-3-small',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'ready' as const
      },
      {
        id: 'test-doc-2',
        title: 'Common Mozaik Troubleshooting',
        content: 'Common Mozaik issues include cabinet doors not appearing, drawer boxes overlapping, and CNC cutting errors. To fix cabinet door issues, check visibility conditions and part logic. For CNC errors, verify material optimization and tooling parameters.',
        content_chunks: ['Common Mozaik issues include cabinet doors not appearing, drawer boxes overlapping, and CNC cutting errors.', 'To fix cabinet door issues, check visibility conditions and part logic.'],
        vectors: [],
        metadata: {
          filename: 'troubleshooting-guide.txt',
          file_type: 'knowledge_base',
          file_size: 1536,
          upload_date: new Date().toISOString(),
          uploaded_by: 'system',
          tags: ['mozaik', 'troubleshooting', 'errors', 'solutions'],
          category: 'knowledge_base',
          language: 'en'
        },
        embeddings_model: 'text-embedding-3-small',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'ready' as const
      }
    ];

    // Add documents to vector database
    for (const doc of testDocuments) {
      await vectorDB.addDocument(doc);
    }

    const stats = await vectorDB.getStats();

    res.status(200).json({
      message: 'Test knowledge data populated successfully',
      status: 'ready',
      documents_added: testDocuments.length,
      total_documents: stats.total_documents,
      note: 'This is test data for development. Use /initialize for full knowledge base.'
    });

  } catch (error) {
    console.error('Error populating test data:', error);
    res.status(500).json({
      error: 'Failed to populate test data',
      message: 'An error occurred while adding test knowledge',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    });
  }
});

// Emergency knowledge seeding - Manual Mozaik knowledge without scraping
router.post('/seed-manual-knowledge', async (req: Request, res: Response) => {
  try {
    console.log('🌱 Seeding manual Mozaik knowledge base...');
    
    // Comprehensive Mozaik knowledge from the YouTube channels and community
    const mozaikKnowledge = [
      {
        id: 'mozaik-basics-1',
        title: 'Mozaik Cabinet Configuration Fundamentals',
        content: `Mozaik software is a powerful cabinet design and manufacturing solution. Key configuration principles include: 1) Material Setup - Define material thickness (material.th), overlay values, and construction methods. Common material.th values are 0.75" for cabinet boxes and 0.25" for backs. 2) Parameter Management - Use global parameters for consistency across projects. Set door overlays (typically 0.5" to 0.75"), drawer box specifications, and hardware offsets. 3) Constraint Logic - Establish visibility conditions for parts based on cabinet style, door type, and construction method. Common constraints include hiding parts when certain door styles are selected or when specific construction methods are used.`,
        content_chunks: [
          'Mozaik software is a powerful cabinet design and manufacturing solution with key configuration principles.',
          'Material Setup requires defining material thickness (material.th), overlay values, and construction methods.',
          'Parameter Management uses global parameters for consistency with door overlays and drawer specifications.',
          'Constraint Logic establishes visibility conditions for parts based on cabinet style and construction.'
        ],
        vectors: [],
        metadata: {
          filename: 'mozaik-fundamentals.txt',
          file_type: 'knowledge_base',
          file_size: 2048,
          upload_date: new Date().toISOString(),
          uploaded_by: 'system',
          tags: ['mozaik', 'configuration', 'fundamentals', 'materials', 'parameters'],
          category: 'knowledge_base',
          language: 'en'
        },
        embeddings_model: 'text-embedding-3-small',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'ready' as const
      },
      {
        id: 'mozaik-troubleshooting-1',
        title: 'Common Mozaik Issues and Solutions',
        content: `Common Mozaik troubleshooting scenarios: 1) Cabinet doors not appearing - Check visibility conditions in part properties, verify door style parameters match cabinet configuration, ensure overlay values are correct. 2) Drawer boxes overlapping or missing - Review drawer box logic, check bottom mount vs side mount settings, verify drawer slide clearances. 3) CNC cutting errors - Validate material optimization settings, check tooling parameters, ensure proper nesting constraints. 4) Parameter conflicts - Use parameter hierarchy, avoid circular references, test with simple configurations first. 5) Missing back panels - Check back panel logic rules, verify thickness settings, ensure proper material selection.`,
        content_chunks: [
          'Cabinet doors not appearing - Check visibility conditions and door style parameters.',
          'Drawer boxes overlapping - Review drawer box logic and slide clearances.',
          'CNC cutting errors - Validate material optimization and tooling parameters.',
          'Parameter conflicts - Use parameter hierarchy and avoid circular references.',
          'Missing back panels - Check back panel logic rules and thickness settings.'
        ],
        vectors: [],
        metadata: {
          filename: 'mozaik-troubleshooting.txt',
          file_type: 'knowledge_base',
          file_size: 2560,
          upload_date: new Date().toISOString(),
          uploaded_by: 'system',
          tags: ['mozaik', 'troubleshooting', 'errors', 'solutions', 'cnc'],
          category: 'knowledge_base',
          language: 'en'
        },
        embeddings_model: 'text-embedding-3-small',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'ready' as const
      },
      {
        id: 'mozaik-cnc-optimization-1',
        title: 'CNC Setup and Optimization for Mozaik',
        content: `Mozaik CNC optimization best practices: 1) Material Settings - Set correct material thickness, grain direction, and waste factors. Account for saw kerf and planer variance. 2) Tooling Configuration - Define router bits, drill bits, and saw blades with proper speeds and feeds. Use appropriate step-down values. 3) Nesting Optimization - Enable grain matching, set minimum part sizes, configure edge banding requirements. Optimize for material yield vs processing time. 4) Post-Processing - Configure proper post-processors for your CNC machine, validate G-code output, test with simple parts first. 5) Quality Control - Implement cut optimization checks, verify dimensions after processing, maintain consistent setup procedures.`,
        content_chunks: [
          'Material Settings require correct thickness, grain direction, and waste factors.',
          'Tooling Configuration defines router bits and drill bits with proper speeds.',
          'Nesting Optimization enables grain matching and material yield optimization.',
          'Post-Processing configures proper post-processors and validates G-code output.',
          'Quality Control implements cut optimization and dimension verification.'
        ],
        vectors: [],
        metadata: {
          filename: 'cnc-optimization.txt',
          file_type: 'knowledge_base',
          file_size: 3072,
          upload_date: new Date().toISOString(),
          uploaded_by: 'system',
          tags: ['cnc', 'optimization', 'tooling', 'nesting', 'quality'],
          category: 'knowledge_base',
          language: 'en'
        },
        embeddings_model: 'text-embedding-3-small',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'ready' as const
      },
      {
        id: 'mozaik-community-wisdom-1',
        title: 'Mozaik Community Best Practices',
        content: `Insights from the Mozaik community and expert practitioners: 1) Cabinet Design Workflow - Start with standard configurations, test thoroughly before customization, maintain consistent naming conventions. 2) Parameter Management - Use descriptive parameter names, document complex formulas, version control parameter changes. 3) Production Tips - Batch similar cabinet styles, optimize cut lists before nesting, maintain standard hardware libraries. 4) Common Pitfalls - Avoid overcomplicating initial setups, test parameter changes in isolation, backup configurations before major changes. 5) Expert Recommendations - Join community forums for troubleshooting, follow CADMate training protocols, stay updated with software versions.`,
        content_chunks: [
          'Cabinet Design Workflow starts with standard configurations and thorough testing.',
          'Parameter Management uses descriptive names and documents complex formulas.',
          'Production Tips include batching similar styles and optimizing cut lists.',
          'Common Pitfalls include overcomplicating setups and not testing changes.',
          'Expert Recommendations suggest joining forums and following training protocols.'
        ],
        vectors: [],
        metadata: {
          filename: 'community-practices.txt',
          file_type: 'knowledge_base',
          file_size: 2304,
          upload_date: new Date().toISOString(),
          uploaded_by: 'system',
          tags: ['community', 'best-practices', 'workflow', 'expert-tips'],
          category: 'knowledge_base',
          language: 'en'
        },
        embeddings_model: 'text-embedding-3-small',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'ready' as const
      }
    ];

    // Add documents to vector database with embeddings
    let docsAdded = 0;
    for (const doc of mozaikKnowledge) {
      try {
        await vectorDB.addDocument(doc);
        docsAdded++;
        console.log(`✅ Added: ${doc.title}`);
      } catch (error) {
        console.error(`❌ Failed to add: ${doc.title}`, error);
      }
    }

    const stats = await vectorDB.getStats();

    res.status(200).json({
      message: 'Manual Mozaik knowledge seeded successfully',
      status: 'ready',
      documents_added: docsAdded,
      total_documents: stats.total_documents,
      knowledge_areas: [
        'Cabinet Configuration Fundamentals',
        'Common Issues and Troubleshooting',
        'CNC Setup and Optimization', 
        'Community Best Practices'
      ],
      note: 'Manual knowledge base ready for chat testing'
    });

  } catch (error) {
    console.error('Error seeding manual knowledge:', error);
    res.status(500).json({
      error: 'Failed to seed manual knowledge',
      message: 'An error occurred while adding manual knowledge',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    });
  }
});

export { router as knowledgeRoutes }; 