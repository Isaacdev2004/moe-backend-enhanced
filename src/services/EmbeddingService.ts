import OpenAI from 'openai';
import { TextChunk } from '../types/file-parser.js';

export interface EmbeddingConfig {
  model: string;
  dimensions: number;
  batch_size: number;
  max_retries: number;
  retry_delay: number;
}

export interface EmbeddingResult {
  chunk_id: string;
  vector: number[];
  model: string;
  processing_time: number;
  token_count: number;
}

export class EmbeddingService {
  private openai: OpenAI;
  private config: EmbeddingConfig;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({
      apiKey: apiKey,
    });

    this.config = {
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536'),
      batch_size: 100, // OpenAI allows up to 2048 inputs per request
      max_retries: 3,
      retry_delay: 1000
    };
  }

  /**
   * Generate embeddings for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const startTime = Date.now();
      
      const response = await this.openai.embeddings.create({
        model: this.config.model,
        input: text,
        encoding_format: 'float',
      });

      const processingTime = Date.now() - startTime;
      console.log(`Generated embedding in ${processingTime}ms for ${text.length} characters`);

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error}`);
    }
  }

  /**
   * Generate embeddings for multiple text chunks in batches
   */
  async generateEmbeddings(chunks: TextChunk[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    const batches = this.createBatches(chunks, this.config.batch_size);

    console.log(`Processing ${chunks.length} chunks in ${batches.length} batches`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} chunks)`);

      try {
        const batchResults = await this.processBatch(batch);
        results.push(...batchResults);
      } catch (error) {
        console.error(`Error processing batch ${i + 1}:`, error);
        
        // Retry individual chunks if batch fails
        for (const chunk of batch) {
          try {
            const vector = await this.generateEmbedding(chunk.content);
            results.push({
              chunk_id: chunk.id,
              vector,
              model: this.config.model,
              processing_time: 0, // Not measured for individual retries
              token_count: chunk.token_count
            });
          } catch (chunkError) {
            console.error(`Failed to process chunk ${chunk.id}:`, chunkError);
            // Add empty vector as fallback
            results.push({
              chunk_id: chunk.id,
              vector: new Array(this.config.dimensions).fill(0),
              model: this.config.model,
              processing_time: 0,
              token_count: chunk.token_count
            });
          }
        }
      }

      // Add delay between batches to respect rate limits
      if (i < batches.length - 1) {
        await this.delay(500);
      }
    }

    return results;
  }

  /**
   * Process a batch of chunks
   */
  private async processBatch(chunks: TextChunk[]): Promise<EmbeddingResult[]> {
    const startTime = Date.now();
    const texts = chunks.map(chunk => chunk.content);

    const response = await this.openai.embeddings.create({
      model: this.config.model,
      input: texts,
      encoding_format: 'float',
    });

    const processingTime = Date.now() - startTime;

    return chunks.map((chunk, index) => ({
      chunk_id: chunk.id,
      vector: response.data[index].embedding,
      model: this.config.model,
      processing_time: processingTime / chunks.length, // Average per chunk
      token_count: chunk.token_count
    }));
  }

  /**
   * Generate embedding for search queries
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    return this.generateEmbedding(query);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  calculateSimilarity(vector1: number[], vector2: number[]): number {
    if (vector1.length !== vector2.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      norm1 += vector1[i] * vector1[i];
      norm2 += vector2[i] * vector2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Get embedding configuration
   */
  getConfig(): EmbeddingConfig {
    return { ...this.config };
  }

  /**
   * Update embedding configuration
   */
  updateConfig(updates: Partial<EmbeddingConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Create batches from array of chunks
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Delay utility for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get token usage estimate
   */
  estimateTokenUsage(texts: string[]): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return texts.reduce((total, text) => total + Math.ceil(text.length / 4), 0);
  }

  /**
   * Get embedding statistics
   */
  getEmbeddingStats(embeddings: EmbeddingResult[]): {
    totalEmbeddings: number;
    totalTokens: number;
    totalProcessingTime: number;
    averageProcessingTime: number;
    model: string;
  } {
    const totalTokens = embeddings.reduce((sum, emb) => sum + emb.token_count, 0);
    const totalProcessingTime = embeddings.reduce((sum, emb) => sum + emb.processing_time, 0);

    return {
      totalEmbeddings: embeddings.length,
      totalTokens,
      totalProcessingTime,
      averageProcessingTime: embeddings.length > 0 ? totalProcessingTime / embeddings.length : 0,
      model: this.config.model
    };
  }
} 