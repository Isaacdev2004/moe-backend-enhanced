// Simplified Knowledge Scraper Service - Scraping Disabled
// This service now only manages curated sources without actual scraping

import axios from 'axios';
import { VectorDBService } from './VectorDBService.js';
import { EmbeddingService } from './EmbeddingService.js';
import { v4 as uuidv4 } from 'uuid';

export interface ScrapedContent {
  id: string;
  title: string;
  content: string;
  source: ContentSource;
  url: string;
  author?: string;
  date_scraped: string;
  content_type: 'documentation' | 'forum_post' | 'video_transcript' | 'social_post' | 'blog_article';
  tags: string[];
  metadata: {
    views?: number;
    likes?: number;
    comments?: number;
    duration?: string;
    relevance_score: number;
    curation_level: 'curated' | 'verified' | 'community';
  };
}

export interface CuratedSource {
  id: string;
  name: string;
  url: string;
  source: ContentSource;
  content_type: 'documentation' | 'forum_post' | 'video_transcript' | 'social_post' | 'blog_article';
  description: string;
  relevance_score: number;
  last_verified: string;
  tags: string[];
}

export enum ContentSource {
  YOUTUBE = 'youtube',
  FACEBOOK = 'facebook',
  DOCS = 'documentation',
  FORUM = 'forum',
  BLOG = 'blog',
  MANUAL = 'manual'
}

export interface ScrapingConfig {
  sources: ContentSource[];
  max_content_per_source: number;
  min_content_length: number;
  enabled: boolean;
}

export class KnowledgeScraperService {
  private vectorDB: VectorDBService;
  private embeddingService: EmbeddingService;
  private scrapingConfig: ScrapingConfig;
  private curated_sources: CuratedSource[];

  constructor() {
    this.vectorDB = new VectorDBService();
    this.embeddingService = new EmbeddingService();
    
    // Scraping is permanently disabled
    this.scrapingConfig = {
      sources: [],
      max_content_per_source: 0,
      min_content_length: 100,
      enabled: false
    };

    // Keep curated sources for reference only
    this.curated_sources = [
      {
        id: 'yt-1',
        name: 'CabinetPartsPro',
        url: 'https://www.youtube.com/@CabinetPartsPro',
        source: ContentSource.YOUTUBE,
        content_type: 'video_transcript',
        description: 'Professional cabinet making tutorials and tips',
        relevance_score: 0.9,
        last_verified: new Date().toISOString(),
        tags: ['cabinet', 'professional', 'tutorials']
      },
      {
        id: 'yt-2', 
        name: 'WoodWorkingCorner',
        url: 'https://www.youtube.com/@WoodWorkingCorner',
        source: ContentSource.YOUTUBE,
        content_type: 'video_transcript',
        description: 'Comprehensive woodworking and cabinet design guides',
        relevance_score: 0.85,
        last_verified: new Date().toISOString(),
        tags: ['woodworking', 'design', 'tutorials']
      },
      {
        id: 'fb-1',
        name: 'Mozaik Software Users Group',
        url: 'https://www.facebook.com/groups/mozaiksoftware',
        source: ContentSource.FACEBOOK,
        content_type: 'social_post',
        description: 'Official Mozaik software user community',
        relevance_score: 0.95,
        last_verified: new Date().toISOString(),
        tags: ['mozaik', 'community', 'support']
      }
      // Note: Additional YouTube channels would be listed here but scraping is disabled
    ];

    console.log('📋 KnowledgeScraperService initialized (scraping disabled - manual mode only)');
  }

  /**
   * Get scraping configuration
   */
  getScrapingConfig(): ScrapingConfig {
    return { ...this.scrapingConfig };
  }

  /**
   * Update scraping configuration (no-op since scraping is disabled)
   */
  updateScrapingConfig(updates: Partial<ScrapingConfig>): void {
    console.log('⚠️ Scraping is disabled - configuration not updated');
  }

  /**
   * Scrape and ingest knowledge (disabled - returns empty result)
   */
  async scrapeAndIngestKnowledge(): Promise<{
    total_scraped: number;
    by_source: Record<string, number>;
    processing_time: number;
    errors: string[];
  }> {
    console.log('⚠️ Knowledge scraping is disabled - use manual knowledge seeding instead');
    
    return {
      total_scraped: 0,
      by_source: {},
      processing_time: 0,
      errors: ['Scraping is disabled - dependencies removed for stability']
    };
  }

  /**
   * Get curated sources (for reference only)
   */
  getCuratedSources(): CuratedSource[] {
    return [...this.curated_sources];
  }

  /**
   * Add curated source (for reference only)
   */
  addCuratedSource(source: CuratedSource): void {
    this.curated_sources.push(source);
    console.log(`📋 Added curated source: ${source.name} (reference only)`);
  }

  /**
   * Update curated sources (for reference only)
   */
  updateCuratedSources(sources: CuratedSource[]): void {
    this.curated_sources = [...sources];
    console.log(`📋 Updated ${sources.length} curated sources (reference only)`);
  }

  /**
   * Remove curated source (for reference only)  
   */
  removeCuratedSource(sourceId: string): boolean {
    const initialLength = this.curated_sources.length;
    this.curated_sources = this.curated_sources.filter(s => s.id !== sourceId);
    const removed = this.curated_sources.length < initialLength;
    
    if (removed) {
      console.log(`📋 Removed curated source: ${sourceId} (reference only)`);
    }
    
    return removed;
  }

  /**
   * Get scraping status
   */
  getScrapingStatus(): {
    enabled: boolean;
    last_scrape: string | null;
    total_sources: number;
    active_sources: number;
    next_scrape: string | null;
  } {
    return {
      enabled: false,
      last_scrape: null,
      total_sources: this.curated_sources.length,
      active_sources: 0,
      next_scrape: null
    };
  }
} 