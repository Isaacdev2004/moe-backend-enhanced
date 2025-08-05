import { ContentSource } from '../services/KnowledgeScraperService.js';

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