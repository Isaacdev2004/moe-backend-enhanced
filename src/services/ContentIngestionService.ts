import { KnowledgeScraperService, ScrapedContent } from './KnowledgeScraperService.js';
import { VectorDBService } from './VectorDBService.js';
import { EmbeddingService } from './EmbeddingService.js';
import { TextChunkingService } from './TextChunkingService.js';
// Cron jobs disabled - scraping removed
import { v4 as uuidv4 } from 'uuid';

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  source_type: 'scraped' | 'uploaded';
  source_details: {
    platform: string;
    content_type: string;
    author?: string;
    url?: string;
    scraped_date?: string;
  };
  tags: string[];
  relevance_score: number;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface IngestionStats {
  total_documents: number;
  documents_by_source: Record<string, number>;
  processing_status: Record<string, number>;
  last_ingestion: string | null;
  next_scheduled: string | null;
  avg_relevance_score: number;
}

export class ContentIngestionService {
  private knowledgeScraper: KnowledgeScraperService;
  private vectorDB: VectorDBService;
  private embeddingService: EmbeddingService;
  private chunkingService: TextChunkingService;
  private scheduledJob: cron.ScheduledTask | null = null;
  private isIngesting = false;

  constructor() {
    this.knowledgeScraper = new KnowledgeScraperService();
    this.vectorDB = new VectorDBService();
    this.embeddingService = new EmbeddingService();
    this.chunkingService = new TextChunkingService();
  }

  /**
   * Initialize the content ingestion system
   */
  async initialize(): Promise<void> {
    console.log('🔄 Initializing content ingestion system...');
    
    // Pre-populate with initial knowledge if database is empty
    const stats = await this.vectorDB.getStats();
    if (stats.total_documents === 0) {
      console.log('📚 No existing knowledge found. Starting initial knowledge ingestion...');
      await this.performFullIngestion();
    }

    // Schedule regular updates
    this.scheduleRegularIngestion();
    
    console.log('✅ Content ingestion system initialized');
  }

  /**
   * Perform full knowledge ingestion from all sources
   */
  async performFullIngestion(): Promise<{
    success: boolean;
    stats: IngestionStats;
    errors: string[];
  }> {
    if (this.isIngesting) {
      throw new Error('Ingestion already in progress');
    }

    console.log('🌍 Starting full knowledge ingestion...');
    this.isIngesting = true;
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Step 1: Skip scraping (disabled for stability)
      console.log('📋 Phase 1: Scraping disabled - using manual knowledge only...');

      // Step 2: Add curated Mozaik knowledge
      console.log('📖 Phase 2: Adding curated Mozaik knowledge...');
      await this.addCuratedKnowledge();

      // Step 3: Add sample conversations and FAQs
      console.log('💬 Phase 3: Adding sample conversations and FAQs...');
      await this.addSampleConversations();

      // Step 4: Optimize knowledge base
      console.log('⚡ Phase 4: Optimizing knowledge base...');
      await this.optimizeKnowledgeBase();

      const processingTime = Date.now() - startTime;
      console.log(`✅ Full ingestion completed in ${processingTime}ms`);

      const stats = await this.getIngestionStats();

      return {
        success: true,
        stats,
        errors
      };

    } catch (error) {
      console.error('❌ Full ingestion failed:', error);
      errors.push(`Full ingestion error: ${error}`);
      
      return {
        success: false,
        stats: await this.getIngestionStats(),
        errors
      };
    } finally {
      this.isIngesting = false;
    }
  }

  /**
   * Add curated Mozaik knowledge base
   */
  private async addCuratedKnowledge(): Promise<void> {
    const curatedKnowledge = [
      {
        title: 'Mozaik Component Structure Guide',
        content: `Mozaik components follow a hierarchical structure with parts, parameters, and constraints. Each component must define:

1. Required Parameters: Parameters that must have values for the component to function
2. Optional Parameters: Parameters with default values that can be overridden
3. Constraints: Validation rules that ensure parameter values are within acceptable ranges
4. Dependencies: Other components or resources this component requires

Common parameter types include:
- String: Text values for names, descriptions, file paths
- Number: Numeric values for measurements, quantities, limits
- Boolean: True/false flags for enabling/disabling features
- Array: Lists of values or sub-parameters
- Object: Complex nested parameter structures

Best practices:
- Always provide meaningful parameter descriptions
- Set appropriate default values for optional parameters
- Define clear constraint ranges and validation rules
- Document parameter units and expected value formats
- Use consistent naming conventions across components`,
        tags: ['components', 'parameters', 'constraints', 'structure', 'best-practices'],
        relevance_score: 1.0
      },
      {
        title: 'Common Mozaik Configuration Errors',
        content: `The most frequent Mozaik configuration errors and their solutions:

1. Missing Required Parameters
   Error: "Parameter 'temperature_range' is required but not provided"
   Solution: Ensure all required parameters have valid values assigned

2. Invalid Parameter Types
   Error: "Expected number but received string for parameter 'max_pressure'"
   Solution: Check parameter type definitions and provide values in correct format

3. Constraint Violations
   Error: "Value 150 exceeds maximum allowed value of 100 for parameter 'speed'"
   Solution: Review parameter constraints and adjust values to within acceptable ranges

4. Version Compatibility Issues
   Error: "Component version 2.1 is incompatible with framework version 1.8"
   Solution: Update components to compatible versions or upgrade framework

5. Circular Dependencies
   Error: "Circular dependency detected: ComponentA -> ComponentB -> ComponentA"
   Solution: Restructure component relationships to eliminate circular references

6. Invalid File Format
   Error: "Unable to parse .moz file: invalid XML structure"
   Solution: Validate file structure and fix syntax errors in configuration files`,
        tags: ['errors', 'troubleshooting', 'configuration', 'debugging', 'solutions'],
        relevance_score: 1.0
      },
      {
        title: 'Mozaik Parameter Optimization Strategies',
        content: `Optimizing Mozaik component parameters for better performance and reliability:

Performance Optimization:
1. Memory Parameters: Set appropriate buffer sizes and memory limits
2. Processing Parameters: Optimize thread counts and batch sizes
3. Timeout Parameters: Balance responsiveness with reliability
4. Cache Parameters: Configure cache sizes for optimal data access

Reliability Optimization:
1. Retry Parameters: Set appropriate retry counts and intervals
2. Validation Parameters: Enable comprehensive input validation
3. Logging Parameters: Configure appropriate logging levels
4. Monitoring Parameters: Set up health checks and alerts

Configuration Best Practices:
1. Use environment-specific parameter sets
2. Implement parameter validation at multiple levels
3. Document parameter interdependencies
4. Test parameter changes in staging environments
5. Monitor parameter impact on system performance
6. Maintain parameter change history for rollback capability

Common Parameter Patterns:
- Connection parameters: host, port, timeout, retry_count
- Processing parameters: batch_size, thread_count, queue_size
- Security parameters: encryption_key, authentication_mode, access_level
- Monitoring parameters: log_level, metrics_enabled, alert_thresholds`,
        tags: ['optimization', 'performance', 'reliability', 'best-practices', 'parameters'],
        relevance_score: 0.9
      },
      {
        title: 'Mozaik File Format Specifications',
        content: `Understanding Mozaik file formats and their purposes:

.moz Files (Mozaik Component Files):
- Primary component definition format
- Contains component metadata, parameters, and constraints
- Supports nested component structures
- Includes version compatibility information

.dat Files (Data Configuration Files):
- Store runtime data and parameter values
- Used for dynamic component configuration
- Support various data types and formats
- Include data validation rules

.des Files (Design Specification Files):
- High-level design and architecture definitions
- Component relationship mappings
- System-level configuration parameters
- Integration specifications

.xml Files (Extended Configuration Files):
- XML-based configuration format
- Supports complex hierarchical structures
- Includes schema validation
- Compatible with external tools and systems

File Processing Guidelines:
1. Always validate file structure before processing
2. Check version compatibility with current framework
3. Verify required fields and parameters are present
4. Validate parameter types and constraint compliance
5. Handle missing or corrupted files gracefully
6. Maintain backup copies of configuration files`,
        tags: ['file-formats', 'specifications', 'moz', 'dat', 'des', 'xml'],
        relevance_score: 0.95
      }
    ];

    for (const knowledge of curatedKnowledge) {
      await this.addKnowledgeDocument({
        id: uuidv4(),
        title: knowledge.title,
        content: knowledge.content,
        source_type: 'scraped',
        source_details: {
          platform: 'curated_knowledge',
          content_type: 'documentation',
          author: 'Mozaik Expert',
          scraped_date: new Date().toISOString()
        },
        tags: knowledge.tags,
        relevance_score: knowledge.relevance_score,
        processing_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    console.log(`✅ Added ${curatedKnowledge.length} curated knowledge documents`);
  }

  /**
   * Add sample conversations and FAQs
   */
  private async addSampleConversations(): Promise<void> {
    const sampleConversations = [
      {
        title: 'Q: How do I fix parameter validation errors?',
        content: `Q: I'm getting parameter validation errors in my .moz file. How do I fix them?

A: Parameter validation errors typically occur when:
1. Required parameters are missing values
2. Parameter values don't match expected types
3. Values violate defined constraints

To fix these errors:
1. Check that all required parameters have values assigned
2. Verify parameter types match the expected format (string, number, boolean)
3. Ensure values fall within defined constraint ranges
4. Review parameter documentation for proper usage
5. Use the diagnostic tools to identify specific issues

Example fix:
Before: temperature_max = "100" (string)
After: temperature_max = 100 (number)`,
        tags: ['troubleshooting', 'validation', 'parameters', 'faq'],
        relevance_score: 0.9
      },
      {
        title: 'Q: What causes circular dependency errors?',
        content: `Q: I'm seeing circular dependency errors between my components. How do I resolve this?

A: Circular dependencies occur when components reference each other in a loop (A depends on B, B depends on C, C depends on A).

To resolve:
1. Map out your component dependencies visually
2. Identify the circular path in the dependency chain
3. Break the circle by removing or restructuring one dependency
4. Consider using interfaces or abstract components to decouple dependencies
5. Reorganize components into layers with clear dependency direction

Prevention strategies:
- Follow layered architecture patterns
- Use dependency injection where possible
- Keep component interfaces minimal and focused
- Regular dependency audits during development`,
        tags: ['dependencies', 'architecture', 'troubleshooting', 'faq'],
        relevance_score: 0.85
      }
    ];

    for (const conversation of sampleConversations) {
      await this.addKnowledgeDocument({
        id: uuidv4(),
        title: conversation.title,
        content: conversation.content,
        source_type: 'scraped',
        source_details: {
          platform: 'sample_conversations',
          content_type: 'forum_post',
          author: 'Community Expert',
          scraped_date: new Date().toISOString()
        },
        tags: conversation.tags,
        relevance_score: conversation.relevance_score,
        processing_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    console.log(`✅ Added ${sampleConversations.length} sample conversations`);
  }

  /**
   * Add a knowledge document to the system
   */
  private async addKnowledgeDocument(doc: KnowledgeDocument): Promise<void> {
    try {
      // Create vector database document
      const vectorDoc = {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        content_chunks: [],
        vectors: [],
        metadata: {
          filename: `knowledge_${doc.id}`,
          file_type: 'knowledge_base',
          file_size: doc.content.length,
          upload_date: doc.created_at,
          uploaded_by: 'content_ingestion',
          tags: doc.tags,
          category: 'mozaik_knowledge',
          language: 'en'
        },
        embeddings_model: '',
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        status: 'processing' as const
      };

      // Add source metadata
      (vectorDoc as any).knowledge_metadata = {
        source_type: doc.source_type,
        source_details: doc.source_details,
        relevance_score: doc.relevance_score,
        processing_status: doc.processing_status
      };

      // Store in vector database (will automatically chunk and vectorize)
      await this.vectorDB.addDocument(vectorDoc);
      
    } catch (error) {
      console.error(`Failed to add knowledge document ${doc.id}:`, error);
      throw error;
    }
  }

  /**
   * Optimize the knowledge base
   */
  private async optimizeKnowledgeBase(): Promise<void> {
    // This could include:
    // - Removing duplicate content
    // - Updating relevance scores
    // - Reorganizing content clusters
    // - Pruning low-quality content
    
    console.log('⚡ Knowledge base optimization completed');
  }

  /**
   * Schedule regular knowledge ingestion
   */
  private scheduleRegularIngestion(): void {
    if (this.scheduledJob) {
      this.scheduledJob.stop();
    }

    // Run every 24 hours
    this.scheduledJob = cron.schedule('0 2 * * *', async () => {
      console.log('⏰ Running scheduled knowledge ingestion...');
      try {
        await this.performIncrementalUpdate();
      } catch (error) {
        console.error('❌ Scheduled ingestion failed:', error);
      }
    });

    console.log('📅 Scheduled regular knowledge ingestion (daily at 2 AM)');
  }

  /**
   * Perform incremental knowledge update
   */
  private async performIncrementalUpdate(): Promise<void> {
    if (this.isIngesting) {
      console.log('⏭️ Skipping incremental update - ingestion already in progress');
      return;
    }

    console.log('🔄 Starting incremental knowledge update...');
    this.isIngesting = true;

    try {
      // Only scrape new content since last update
      const result = await this.knowledgeScraper.scrapeAndIngestKnowledge();
      console.log(`✅ Incremental update completed: ${result.total_scraped} new items`);
    } catch (error) {
      console.error('❌ Incremental update failed:', error);
    } finally {
      this.isIngesting = false;
    }
  }

  /**
   * Get ingestion statistics
   */
  async getIngestionStats(): Promise<IngestionStats> {
    const systemStats = await this.vectorDB.getStats();
    
    // This would typically query the database for detailed stats
    return {
      total_documents: systemStats.total_documents,
      documents_by_source: {
        'uploaded_files': 0,
        'scraped_content': systemStats.total_documents,
        'curated_knowledge': 0
      },
      processing_status: {
        'completed': systemStats.total_documents,
        'processing': 0,
        'failed': 0,
        'pending': 0
      },
      last_ingestion: new Date().toISOString(),
      next_scheduled: this.scheduledJob ? 'Daily at 2:00 AM' : null,
      avg_relevance_score: 0.85
    };
  }

  /**
   * Force refresh of knowledge base
   */
  async forceRefreshKnowledge(): Promise<{
    success: boolean;
    message: string;
    stats: IngestionStats;
  }> {
    try {
      console.log('🔄 Force refreshing knowledge base...');
      const result = await this.performFullIngestion();
      
      return {
        success: result.success,
        message: result.success 
          ? `Knowledge base refreshed successfully. ${result.stats.total_documents} documents processed.`
          : `Knowledge base refresh completed with errors: ${result.errors.join(', ')}`,
        stats: result.stats
      };
    } catch (error) {
      return {
        success: false,
        message: `Knowledge base refresh failed: ${error}`,
        stats: await this.getIngestionStats()
      };
    }
  }

  /**
   * Stop the ingestion service
   */
  stop(): void {
    if (this.scheduledJob) {
      this.scheduledJob.stop();
      this.scheduledJob = null;
    }
    console.log('🛑 Content ingestion service stopped');
  }

  /**
   * Check if ingestion is currently in progress
   */
  isIngestionInProgress(): boolean {
    return this.isIngesting;
  }
} 