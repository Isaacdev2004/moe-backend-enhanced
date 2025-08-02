import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { YoutubeTranscript } from 'youtube-transcript';
import Parser from 'rss-parser';
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
  };
}

export enum ContentSource {
  YOUTUBE = 'youtube',
  FACEBOOK = 'facebook',
  MOZAIK_DOCS = 'mozaik_docs',
  COMMUNITY_FORUM = 'community_forum',
  BLOG = 'blog',
  REDDIT = 'reddit',
  STACKOVERFLOW = 'stackoverflow'
}

export interface ScrapingConfig {
  sources: ContentSource[];
  max_content_per_source: number;
  min_content_length: number;
  relevance_keywords: string[];
  scraping_interval_hours: number;
  enabled: boolean;
}

export class KnowledgeScraperService {
  private vectorDB: VectorDBService;
  private embeddingService: EmbeddingService;
  private rssParser: Parser;
  private scrapingConfig: ScrapingConfig;

  constructor() {
    this.vectorDB = new VectorDBService();
    this.embeddingService = new EmbeddingService();
    this.rssParser = new Parser();
    
    this.scrapingConfig = {
      sources: [
        ContentSource.YOUTUBE,
        ContentSource.MOZAIK_DOCS,
        ContentSource.COMMUNITY_FORUM,
        ContentSource.BLOG
      ],
      max_content_per_source: 50,
      min_content_length: 200,
      relevance_keywords: [
        'mozaik', 'component', 'parameter', 'constraint', 'configuration',
        'troubleshooting', 'diagnostic', 'optimization', 'best practices',
        'tutorial', 'guide', 'documentation', 'error', 'solution'
      ],
      scraping_interval_hours: 24,
      enabled: process.env.KNOWLEDGE_SCRAPING_ENABLED === 'true'
    };
  }

  /**
   * Main method to scrape and ingest knowledge from all configured sources
   */
  async scrapeAndIngestKnowledge(): Promise<{
    total_scraped: number;
    by_source: Record<string, number>;
    processing_time: number;
    errors: string[];
  }> {
    if (!this.scrapingConfig.enabled) {
      console.log('📚 Knowledge scraping is disabled');
      return { total_scraped: 0, by_source: {}, processing_time: 0, errors: ['Scraping disabled'] };
    }

    console.log('🕷️ Starting knowledge scraping process...');
    const startTime = Date.now();
    const results: Record<string, number> = {};
    const errors: string[] = [];
    let totalScraped = 0;

    for (const source of this.scrapingConfig.sources) {
      try {
        console.log(`📖 Scraping from ${source}...`);
        const content = await this.scrapeFromSource(source);
        const processed = await this.processAndIngestContent(content);
        
        results[source] = processed;
        totalScraped += processed;
        
        console.log(`✅ Scraped ${processed} items from ${source}`);
        
        // Add delay between sources to be respectful
        await this.delay(2000);
        
      } catch (error) {
        console.error(`❌ Error scraping ${source}:`, error);
        errors.push(`${source}: ${error}`);
        results[source] = 0;
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`🎉 Knowledge scraping completed: ${totalScraped} items in ${processingTime}ms`);

    return {
      total_scraped: totalScraped,
      by_source: results,
      processing_time: processingTime,
      errors
    };
  }

  /**
   * Scrape content from a specific source
   */
  private async scrapeFromSource(source: ContentSource): Promise<ScrapedContent[]> {
    switch (source) {
      case ContentSource.YOUTUBE:
        return this.scrapeYouTubeContent();
      case ContentSource.MOZAIK_DOCS:
        return this.scrapeMozaikDocs();
      case ContentSource.COMMUNITY_FORUM:
        return this.scrapeCommunityForum();
      case ContentSource.BLOG:
        return this.scrapeBlogContent();
      default:
        console.warn(`Scraping not implemented for source: ${source}`);
        return [];
    }
  }

  /**
   * Scrape YouTube videos and transcripts about Mozaik
   */
  private async scrapeYouTubeContent(): Promise<ScrapedContent[]> {
    const content: ScrapedContent[] = [];
    
    try {
      // YouTube search URLs for Mozaik-related content
      const searchQueries = [
        'mozaik software tutorial',
        'mozaik component configuration',
        'mozaik troubleshooting',
        'mozaik best practices'
      ];

      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();

      for (const query of searchQueries) {
        try {
          const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
          await page.goto(searchUrl, { waitUntil: 'networkidle0' });
          
          // Extract video links
          const videoLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="/watch?v="]'));
            return links.slice(0, 10).map(link => ({
              url: 'https://www.youtube.com' + (link as HTMLAnchorElement).href.split('youtube.com')[1],
              title: (link as HTMLElement).textContent?.trim() || 'Unknown Title'
            }));
          });

          // Process each video
          for (const video of videoLinks) {
            try {
              const videoId = video.url.split('v=')[1]?.split('&')[0];
              if (!videoId) continue;

              // Get transcript
              const transcript = await this.getYouTubeTranscript(videoId);
              if (transcript && transcript.length > this.scrapingConfig.min_content_length) {
                content.push({
                  id: uuidv4(),
                  title: video.title,
                  content: transcript,
                  source: ContentSource.YOUTUBE,
                  url: video.url,
                  date_scraped: new Date().toISOString(),
                  content_type: 'video_transcript',
                  tags: this.extractTags(video.title + ' ' + transcript),
                  metadata: {
                    relevance_score: this.calculateRelevanceScore(video.title + ' ' + transcript)
                  }
                });
              }
            } catch (transcriptError) {
              console.warn(`Failed to get transcript for ${video.url}:`, transcriptError);
            }
          }
        } catch (queryError) {
          console.warn(`Failed to process query "${query}":`, queryError);
        }
        
        // Rate limiting
        await this.delay(3000);
      }

      await browser.close();
    } catch (error) {
      console.error('YouTube scraping error:', error);
    }

    return content.slice(0, this.scrapingConfig.max_content_per_source);
  }

  /**
   * Get YouTube transcript for a video
   */
  private async getYouTubeTranscript(videoId: string): Promise<string> {
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      return transcript.map(item => item.text).join(' ');
    } catch (error) {
      // If automatic captions fail, return empty string
      return '';
    }
  }

  /**
   * Scrape Mozaik official documentation
   */
  private async scrapeMozaikDocs(): Promise<ScrapedContent[]> {
    const content: ScrapedContent[] = [];
    
    try {
      // Simulated Mozaik documentation URLs - replace with actual URLs
      const docUrls = [
        'https://mozaik-docs.example.com/getting-started',
        'https://mozaik-docs.example.com/components',
        'https://mozaik-docs.example.com/configuration',
        'https://mozaik-docs.example.com/troubleshooting',
        'https://mozaik-docs.example.com/best-practices'
      ];

      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();

      for (const url of docUrls) {
        try {
          await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });
          
          const pageContent = await page.evaluate(() => {
            // Remove script and style elements
            const scripts = document.querySelectorAll('script, style');
            scripts.forEach(script => script.remove());
            
            // Get main content (adjust selectors based on actual site structure)
            const contentElement = document.querySelector('main, article, .content, .documentation') || document.body;
            return {
              title: document.title,
              content: contentElement?.textContent?.trim() || ''
            };
          });

          if (pageContent.content.length > this.scrapingConfig.min_content_length) {
            content.push({
              id: uuidv4(),
              title: pageContent.title,
              content: pageContent.content,
              source: ContentSource.MOZAIK_DOCS,
              url: url,
              date_scraped: new Date().toISOString(),
              content_type: 'documentation',
              tags: this.extractTags(pageContent.title + ' ' + pageContent.content),
              metadata: {
                relevance_score: this.calculateRelevanceScore(pageContent.content)
              }
            });
          }
        } catch (pageError) {
          console.warn(`Failed to scrape ${url}:`, pageError);
        }
        
        await this.delay(1000);
      }

      await browser.close();
    } catch (error) {
      console.error('Mozaik docs scraping error:', error);
    }

    return content;
  }

  /**
   * Scrape community forums and discussion boards
   */
  private async scrapeCommunityForum(): Promise<ScrapedContent[]> {
    const content: ScrapedContent[] = [];
    
    try {
      // Simulated forum URLs - replace with actual Mozaik community forums
      const forumUrls = [
        'https://community.mozaik.com/discussions',
        'https://forum.mozaik-users.com/topics',
        'https://stackoverflow.com/questions/tagged/mozaik'
      ];

      for (const baseUrl of forumUrls) {
        try {
          const response = await axios.get(baseUrl, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });

          const $ = cheerio.load(response.data);
          
          // Extract forum posts (adjust selectors based on actual forum structure)
          $('.discussion-item, .topic, .question').each((index, element) => {
            if (content.length >= this.scrapingConfig.max_content_per_source) return false;
            
            const title = $(element).find('h3, h2, .title, .question-title').first().text().trim();
            const postContent = $(element).find('.content, .body, .description').first().text().trim();
            const author = $(element).find('.author, .username').first().text().trim();
            
            if (postContent.length > this.scrapingConfig.min_content_length) {
              content.push({
                id: uuidv4(),
                title: title || 'Forum Discussion',
                content: postContent,
                source: ContentSource.COMMUNITY_FORUM,
                url: baseUrl,
                author: author || 'Community User',
                date_scraped: new Date().toISOString(),
                content_type: 'forum_post',
                tags: this.extractTags(title + ' ' + postContent),
                metadata: {
                  relevance_score: this.calculateRelevanceScore(postContent)
                }
              });
            }
          });
        } catch (forumError) {
          console.warn(`Failed to scrape forum ${baseUrl}:`, forumError);
        }
        
        await this.delay(2000);
      }
    } catch (error) {
      console.error('Community forum scraping error:', error);
    }

    return content;
  }

  /**
   * Scrape blog articles and technical posts
   */
  private async scrapeBlogContent(): Promise<ScrapedContent[]> {
    const content: ScrapedContent[] = [];
    
    try {
      // RSS feeds and blog URLs about Mozaik
      const blogSources = [
        'https://blog.mozaik.com/feed',
        'https://medium.com/feed/tag/mozaik',
        'https://dev.to/feed/tag/mozaik'
      ];

      for (const feedUrl of blogSources) {
        try {
          const feed = await this.rssParser.parseURL(feedUrl);
          
          for (const item of feed.items.slice(0, 10)) {
            if (content.length >= this.scrapingConfig.max_content_per_source) break;
            
            const articleContent = item.content || item.summary || '';
            const cleanContent = this.cleanHtmlContent(articleContent);
            
            if (cleanContent.length > this.scrapingConfig.min_content_length) {
              content.push({
                id: uuidv4(),
                title: item.title || 'Blog Article',
                content: cleanContent,
                source: ContentSource.BLOG,
                url: item.link || feedUrl,
                author: item.creator || 'Blog Author',
                date_scraped: new Date().toISOString(),
                content_type: 'blog_article',
                tags: this.extractTags((item.title || '') + ' ' + cleanContent),
                metadata: {
                  relevance_score: this.calculateRelevanceScore(cleanContent)
                }
              });
            }
          }
        } catch (feedError) {
          console.warn(`Failed to parse RSS feed ${feedUrl}:`, feedError);
        }
        
        await this.delay(1000);
      }
    } catch (error) {
      console.error('Blog content scraping error:', error);
    }

    return content;
  }

  /**
   * Process and ingest scraped content into vector database
   */
  private async processAndIngestContent(content: ScrapedContent[]): Promise<number> {
    let processed = 0;
    
    for (const item of content) {
      try {
        // Create document for vector database
        const document = {
          id: item.id,
          title: item.title,
          content: item.content,
          content_chunks: [],
          vectors: [],
          metadata: {
            filename: `${item.source}_${item.id}`,
            file_type: 'scraped_content',
            file_size: item.content.length,
            upload_date: item.date_scraped,
            uploaded_by: 'knowledge_scraper',
            tags: item.tags,
            category: 'mozaik_knowledge',
            language: 'en'
          },
          embeddings_model: '',
          created_at: item.date_scraped,
          updated_at: item.date_scraped,
          status: 'processing' as const
        };

        // Add source-specific metadata
        (document as any).scraped_metadata = {
          source: item.source,
          content_type: item.content_type,
          author: item.author,
          url: item.url,
          relevance_score: item.metadata.relevance_score
        };

        // Store in vector database
        await this.vectorDB.addDocument(document);
        processed++;
        
      } catch (error) {
        console.error(`Failed to process content item ${item.id}:`, error);
      }
    }

    return processed;
  }

  /**
   * Extract relevant tags from content
   */
  private extractTags(text: string): string[] {
    const tags = new Set<string>();
    const words = text.toLowerCase().split(/\s+/);
    
    // Add keyword-based tags
    for (const keyword of this.scrapingConfig.relevance_keywords) {
      if (words.some(word => word.includes(keyword))) {
        tags.add(keyword);
      }
    }

    // Add technical terms
    const technicalTerms = ['api', 'configuration', 'parameter', 'component', 'troubleshooting', 'error'];
    for (const term of technicalTerms) {
      if (words.includes(term)) {
        tags.add(term);
      }
    }

    return Array.from(tags);
  }

  /**
   * Calculate relevance score based on keyword presence
   */
  private calculateRelevanceScore(content: string): number {
    const words = content.toLowerCase().split(/\s+/);
    let score = 0;
    
    for (const keyword of this.scrapingConfig.relevance_keywords) {
      const occurrences = words.filter(word => word.includes(keyword)).length;
      score += occurrences * 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Clean HTML content and extract text
   */
  private cleanHtmlContent(html: string): string {
    const $ = cheerio.load(html);
    $('script, style').remove();
    return $.text().replace(/\s+/g, ' ').trim();
  }

  /**
   * Delay utility for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get scraping configuration
   */
  getScrapingConfig(): ScrapingConfig {
    return { ...this.scrapingConfig };
  }

  /**
   * Update scraping configuration
   */
  updateScrapingConfig(updates: Partial<ScrapingConfig>): void {
    this.scrapingConfig = { ...this.scrapingConfig, ...updates };
  }

  /**
   * Get scraping statistics
   */
  async getScrapingStats(): Promise<{
    total_scraped_documents: number;
    by_source: Record<string, number>;
    last_scrape_time: string | null;
    next_scheduled_scrape: string | null;
  }> {
    // This would typically query the database for scraped content statistics
    return {
      total_scraped_documents: 0,
      by_source: {},
      last_scrape_time: null,
      next_scheduled_scrape: null
    };
  }
} 