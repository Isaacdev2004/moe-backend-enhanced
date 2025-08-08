// Optional dependencies - graceful degradation if not available
let puppeteer: any = null;
let cheerio: any = null;
let YoutubeTranscript: any = null;

try {
  puppeteer = await import('puppeteer-core');
} catch (error) {
  console.log('ℹ️ Puppeteer not available - web scraping disabled');
}

try {
  cheerio = await import('cheerio');
} catch (error) {
  console.log('ℹ️ Cheerio not available - HTML parsing disabled');
}

try {
  const ytModule = await import('youtube-transcript');
  YoutubeTranscript = ytModule.YoutubeTranscript;
} catch (error) {
  console.log('ℹ️ YouTube transcript not available - video scraping disabled');
}

import axios from 'axios';
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
    curation_level: 'curated' | 'verified' | 'community';
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

// Curated list of specific, vetted sources
export interface CuratedSource {
  id: string;
  name: string;
  url: string;
  source: ContentSource;
  content_type: ScrapedContent['content_type'];
  description: string;
  relevance_score: number;
  last_verified: string;
  tags: string[];
}

export interface ScrapingConfig {
  sources: ContentSource[];
  curated_sources: CuratedSource[];
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
    
    // Check if scraping dependencies are available
    const scrapingAvailable = puppeteer && cheerio;
    
    // Curated list of specific, vetted sources
    const curatedSources: CuratedSource[] = [
      // YouTube - Specific Mozaik channels
      {
        id: 'yt-mozaik-software',
        name: 'Mozaik Software Official Channel',
        url: 'https://www.youtube.com/@MozaikSoftware',
        source: ContentSource.YOUTUBE,
        content_type: 'video_transcript',
        description: 'Official Mozaik Software YouTube channel with tutorials and updates',
        relevance_score: 0.98,
        last_verified: new Date().toISOString(),
        tags: ['official', 'mozaik', 'tutorials', 'updates']
      },
      {
        id: 'yt-cabforge-systems',
        name: 'CabForge Systems',
        url: 'https://www.youtube.com/@cabforgesystems',
        source: ContentSource.YOUTUBE,
        content_type: 'video_transcript',
        description: 'CabForge Systems Mozaik tutorials and tips',
        relevance_score: 0.95,
        last_verified: new Date().toISOString(),
        tags: ['cabforge', 'tutorials', 'tips', 'mozaik']
      },
      {
        id: 'yt-cadmate',
        name: 'CADMate Training',
        url: 'https://www.youtube.com/@cadmate',
        source: ContentSource.YOUTUBE,
        content_type: 'video_transcript',
        description: 'CADMate training videos for Mozaik users',
        relevance_score: 0.96,
        last_verified: new Date().toISOString(),
        tags: ['cadmate', 'training', 'mozaik', 'education']
      },
      {
        id: 'yt-cabinet-podcast',
        name: 'The Cabinet Podcast',
        url: 'https://www.youtube.com/@thecabinetpodcast',
        source: ContentSource.YOUTUBE,
        content_type: 'video_transcript',
        description: 'Cabinet making discussions and Mozaik insights',
        relevance_score: 0.90,
        last_verified: new Date().toISOString(),
        tags: ['podcast', 'cabinet-making', 'discussions', 'insights']
      },
      {
        id: 'yt-woodworking-life',
        name: 'My Woodworking Life',
        url: 'https://www.youtube.com/@mywoodworkinglife',
        source: ContentSource.YOUTUBE,
        content_type: 'video_transcript',
        description: 'Woodworking tutorials and Mozaik tips',
        relevance_score: 0.88,
        last_verified: new Date().toISOString(),
        tags: ['woodworking', 'tutorials', 'tips', 'mozaik']
      },
      {
        id: 'yt-retrotech-cnc',
        name: 'Retrotech CNC',
        url: 'https://www.youtube.com/@RetrotechCNC',
        source: ContentSource.YOUTUBE,
        content_type: 'video_transcript',
        description: 'CNC operations and Mozaik integration',
        relevance_score: 0.92,
        last_verified: new Date().toISOString(),
        tags: ['cnc', 'operations', 'integration', 'mozaik']
      },
      {
        id: 'yt-phill-anton',
        name: 'Phill Anton Consulting',
        url: 'https://www.youtube.com/@PhillAntonConsulting',
        source: ContentSource.YOUTUBE,
        content_type: 'video_transcript',
        description: 'Professional consulting and Mozaik optimization',
        relevance_score: 0.94,
        last_verified: new Date().toISOString(),
        tags: ['consulting', 'optimization', 'professional', 'mozaik']
      },
      {
        id: 'yt-virtucadd',
        name: 'VirtuCADD',
        url: 'https://www.youtube.com/@virtucadd',
        source: ContentSource.YOUTUBE,
        content_type: 'video_transcript',
        description: 'CAD solutions and Mozaik workflows',
        relevance_score: 0.91,
        last_verified: new Date().toISOString(),
        tags: ['cad', 'workflows', 'solutions', 'mozaik']
      },
      {
        id: 'yt-finish-carpenters',
        name: 'Finish Carpenters Co',
        url: 'https://www.youtube.com/@finishcarpentersco',
        source: ContentSource.YOUTUBE,
        content_type: 'video_transcript',
        description: 'Finish carpentry and Mozaik applications',
        relevance_score: 0.89,
        last_verified: new Date().toISOString(),
        tags: ['finish-carpentry', 'applications', 'mozaik']
      },
      {
        id: 'yt-waukee-cabinet',
        name: 'Waukee Cabinet Works',
        url: 'https://www.youtube.com/@waukeecabinetworks5690',
        source: ContentSource.YOUTUBE,
        content_type: 'video_transcript',
        description: 'Cabinet works and Mozaik projects',
        relevance_score: 0.87,
        last_verified: new Date().toISOString(),
        tags: ['cabinet-works', 'projects', 'mozaik']
      },
      {
        id: 'yt-mk-cnc',
        name: 'MK CNC',
        url: 'https://www.youtube.com/@mkCNC',
        source: ContentSource.YOUTUBE,
        content_type: 'video_transcript',
        description: 'CNC operations and Mozaik integration',
        relevance_score: 0.93,
        last_verified: new Date().toISOString(),
        tags: ['cnc', 'operations', 'integration', 'mozaik']
      },
      {
        id: 'yt-jesse-raber',
        name: 'Jesse Raber',
        url: 'https://www.youtube.com/@Jesse_Raber',
        source: ContentSource.YOUTUBE,
        content_type: 'video_transcript',
        description: 'Jesse Raber\'s Mozaik tutorials and insights',
        relevance_score: 0.90,
        last_verified: new Date().toISOString(),
        tags: ['tutorials', 'insights', 'mozaik', 'jesse-raber']
      },
      {
        id: 'yt-kbrogger',
        name: 'KBrogger',
        url: 'https://www.youtube.com/@KBrogger',
        source: ContentSource.YOUTUBE,
        content_type: 'video_transcript',
        description: 'KBrogger\'s Mozaik content and tutorials',
        relevance_score: 0.89,
        last_verified: new Date().toISOString(),
        tags: ['tutorials', 'content', 'mozaik', 'kbrogger']
      },
      // Facebook - Mozaik community group
      {
        id: 'fb-mozaik-community',
        name: 'Mozaik Facebook Community Group',
        url: 'https://www.facebook.com/groups/mozaikcommunity',
        source: ContentSource.FACEBOOK,
        content_type: 'social_post',
        description: 'Mozaik community Facebook group discussions and Q&A',
        relevance_score: 0.95,
        last_verified: new Date().toISOString(),
        tags: ['community', 'discussions', 'q&a', 'mozaik', 'facebook']
      }
    ];
    
    this.scrapingConfig = {
      sources: scrapingAvailable ? [
        ContentSource.YOUTUBE,
        ContentSource.FACEBOOK,
        ContentSource.MOZAIK_DOCS
      ] : [], // Only enable safe sources if dependencies available
      curated_sources: curatedSources,
      max_content_per_source: 5, // Reduced for curated content
      min_content_length: 200,
      relevance_keywords: [
        'mozaik', 'component', 'parameter', 'constraint', 'configuration',
        'troubleshooting', 'diagnostic', 'optimization', 'best practices',
        'tutorial', 'guide', 'documentation', 'error', 'solution'
      ],
      scraping_interval_hours: 24,
      enabled: true // Enable scraping by default
    };
    
    if (!scrapingAvailable) {
      console.log('⚠️ Web scraping dependencies not available - using curated content only');
    }
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
    const startTime = Date.now();
    const errors: string[] = [];
    const by_source: Record<string, number> = {};

    console.log('🧠 Starting curated knowledge base scraping...');

    try {
      // First, scrape from curated sources (high priority)
      console.log('📚 Scraping from curated sources...');
      for (const curatedSource of this.scrapingConfig.curated_sources) {
        try {
          console.log(`🔍 Processing curated source: ${curatedSource.name}`);
          const content = await this.scrapeFromCuratedSource(curatedSource);
          
          if (content.length > 0) {
            await this.processAndIngestContent(content);
            by_source[curatedSource.source] = (by_source[curatedSource.source] || 0) + content.length;
            console.log(`✅ Scraped ${content.length} items from ${curatedSource.name}`);
          }
        } catch (error) {
          const errorMsg = `Failed to scrape curated source ${curatedSource.name}: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // Then, scrape from general sources (lower priority)
      if (this.scrapingConfig.enabled) {
        console.log('🌐 Scraping from general sources...');
        for (const source of this.scrapingConfig.sources) {
          try {
            console.log(`🔍 Processing source: ${source}`);
            const content = await this.scrapeFromSource(source);
            
            if (content.length > 0) {
              await this.processAndIngestContent(content);
              by_source[source] = (by_source[source] || 0) + content.length;
              console.log(`✅ Scraped ${content.length} items from ${source}`);
            }
          } catch (error) {
            const errorMsg = `Failed to scrape source ${source}: ${error}`;
            console.error(errorMsg);
            errors.push(errorMsg);
          }
        }
      }

      const total_scraped = Object.values(by_source).reduce((sum, count) => sum + count, 0);
      const processing_time = Date.now() - startTime;

      console.log(`🎉 Knowledge scraping completed!`);
      console.log(`📊 Total items scraped: ${total_scraped}`);
      console.log(`⏱️ Processing time: ${processing_time}ms`);
      console.log(`📈 By source:`, by_source);

      return {
        total_scraped,
        by_source,
        processing_time,
        errors
      };

    } catch (error) {
      console.error('❌ Knowledge scraping failed:', error);
      throw error;
    }
  }

  /**
   * Scrape content from a specific curated source
   */
  private async scrapeFromCuratedSource(curatedSource: CuratedSource): Promise<ScrapedContent[]> {
    const content: ScrapedContent[] = [];
    
    try {
      console.log(`🔍 Scraping curated source: ${curatedSource.name} (${curatedSource.url})`);
      
      switch (curatedSource.source) {
        case ContentSource.YOUTUBE:
          const youtubeContent = await this.scrapeYouTubeVideo(curatedSource.url);
          if (youtubeContent) {
            content.push({
              ...youtubeContent,
              metadata: {
                ...youtubeContent.metadata,
                curation_level: 'curated',
                relevance_score: curatedSource.relevance_score
              }
            });
          }
          break;
          
        case ContentSource.FACEBOOK:
          const facebookContent = await this.scrapeFacebookPost(curatedSource.url);
          if (facebookContent) {
            content.push({
              ...facebookContent,
              metadata: {
                ...facebookContent.metadata,
                curation_level: 'curated',
                relevance_score: curatedSource.relevance_score
              }
            });
          }
          break;
          
        case ContentSource.MOZAIK_DOCS:
          const docsContent = await this.scrapeMozaikDocsPage(curatedSource.url);
          if (docsContent) {
            content.push({
              ...docsContent,
              metadata: {
                ...docsContent.metadata,
                curation_level: 'curated',
                relevance_score: curatedSource.relevance_score
              }
            });
          }
          break;
          
        default:
          console.warn(`Curated scraping not implemented for source: ${curatedSource.source}`);
      }
      
    } catch (error) {
      console.error(`Failed to scrape curated source ${curatedSource.name}:`, error);
    }
    
    return content;
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
                    relevance_score: this.calculateRelevanceScore(video.title + ' ' + transcript),
                    curation_level: 'community' // Assuming community for now
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
                relevance_score: this.calculateRelevanceScore(pageContent.content),
                curation_level: 'curated' // Assuming curated for now
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
                  relevance_score: this.calculateRelevanceScore(postContent),
                  curation_level: 'community' // Assuming community for now
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
                  relevance_score: this.calculateRelevanceScore(cleanContent),
                  curation_level: 'community' // Assuming community for now
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
          relevance_score: item.metadata.relevance_score,
          curation_level: item.metadata.curation_level
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

  /**
   * Scrape a specific YouTube video
   */
  private async scrapeYouTubeVideo(videoUrl: string): Promise<ScrapedContent | null> {
    try {
      if (!YoutubeTranscript) {
        console.warn('YouTube transcript not available');
        return null;
      }

      const videoId = this.extractYouTubeVideoId(videoUrl);
      if (!videoId) {
        console.warn('Could not extract video ID from URL:', videoUrl);
        return null;
      }

      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      const transcriptText = transcript.map(item => item.text).join(' ');

      if (transcriptText.length < this.scrapingConfig.min_content_length) {
        console.warn('Transcript too short, skipping');
        return null;
      }

      return {
        id: uuidv4(),
        title: `YouTube Video - ${videoId}`,
        content: transcriptText,
        source: ContentSource.YOUTUBE,
        url: videoUrl,
        date_scraped: new Date().toISOString(),
        content_type: 'video_transcript',
        tags: this.extractTags(transcriptText),
        metadata: {
          relevance_score: this.calculateRelevanceScore(transcriptText),
          curation_level: 'curated'
        }
      };
    } catch (error) {
      console.error('Failed to scrape YouTube video:', error);
      return null;
    }
  }

  /**
   * Scrape a specific Facebook post
   */
  private async scrapeFacebookPost(postUrl: string): Promise<ScrapedContent | null> {
    try {
      if (!puppeteer || !cheerio) {
        console.warn('Web scraping not available');
        return null;
      }

      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      
      await page.goto(postUrl, { waitUntil: 'networkidle0' });
      const content = await page.content();
      
      const $ = cheerio.load(content);
      const postText = $('[data-testid="post_message"]').text().trim();
      
      await browser.close();

      if (postText.length < this.scrapingConfig.min_content_length) {
        console.warn('Post content too short, skipping');
        return null;
      }

      return {
        id: uuidv4(),
        title: `Facebook Post - ${postUrl.split('/').pop()}`,
        content: postText,
        source: ContentSource.FACEBOOK,
        url: postUrl,
        date_scraped: new Date().toISOString(),
        content_type: 'social_post',
        tags: this.extractTags(postText),
        metadata: {
          relevance_score: this.calculateRelevanceScore(postText),
          curation_level: 'curated'
        }
      };
    } catch (error) {
      console.error('Failed to scrape Facebook post:', error);
      return null;
    }
  }

  /**
   * Scrape a specific Mozaik documentation page
   */
  private async scrapeMozaikDocsPage(pageUrl: string): Promise<ScrapedContent | null> {
    try {
      if (!puppeteer || !cheerio) {
        console.warn('Web scraping not available');
        return null;
      }

      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      
      await page.goto(pageUrl, { waitUntil: 'networkidle0' });
      const content = await page.content();
      
      const $ = cheerio.load(content);
      const title = $('h1, h2').first().text().trim() || 'Mozaik Documentation';
      const pageText = $('p, li, div').text().trim();
      
      await browser.close();

      if (pageText.length < this.scrapingConfig.min_content_length) {
        console.warn('Page content too short, skipping');
        return null;
      }

      return {
        id: uuidv4(),
        title: title,
        content: pageText,
        source: ContentSource.MOZAIK_DOCS,
        url: pageUrl,
        date_scraped: new Date().toISOString(),
        content_type: 'documentation',
        tags: this.extractTags(pageText),
        metadata: {
          relevance_score: this.calculateRelevanceScore(pageText),
          curation_level: 'curated'
        }
      };
    } catch (error) {
      console.error('Failed to scrape Mozaik docs page:', error);
      return null;
    }
  }

  /**
   * Extract YouTube video ID from URL
   */
  private extractYouTubeVideoId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : null;
  }

  /**
   * Update curated sources with specific URLs
   */
  async updateCuratedSources(sources: CuratedSource[]): Promise<void> {
    this.scrapingConfig.curated_sources = sources;
    console.log(`📚 Updated curated sources: ${sources.length} sources`);
  }

  /**
   * Get current curated sources
   */
  getCuratedSources(): CuratedSource[] {
    return this.scrapingConfig.curated_sources;
  }

  /**
   * Add a new curated source
   */
  async addCuratedSource(source: CuratedSource): Promise<void> {
    this.scrapingConfig.curated_sources.push(source);
    console.log(`📚 Added curated source: ${source.name}`);
  }

  /**
   * Remove a curated source by ID
   */
  async removeCuratedSource(sourceId: string): Promise<void> {
    this.scrapingConfig.curated_sources = this.scrapingConfig.curated_sources.filter(
      source => source.id !== sourceId
    );
    console.log(`📚 Removed curated source: ${sourceId}`);
  }
} 