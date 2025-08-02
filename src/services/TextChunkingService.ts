import { ChunkingConfig, TextChunk } from '../types/file-parser.js';
import { v4 as uuidv4 } from 'uuid';

export class TextChunkingService {
  private defaultConfig: ChunkingConfig = {
    chunk_size: 1000,
    chunk_overlap: 200,
    separator: '\n\n',
    preserve_sections: true,
    min_chunk_size: 100,
    max_chunk_size: 2000
  };

  /**
   * Chunk text into smaller pieces for vectorization
   */
  async chunkText(text: string, config?: Partial<ChunkingConfig>): Promise<TextChunk[]> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const chunks: TextChunk[] = [];

    // If preserve_sections is true, try to chunk by sections first
    if (finalConfig.preserve_sections) {
      const sectionChunks = this.chunkBySections(text, finalConfig);
      if (sectionChunks.length > 0) {
        return sectionChunks;
      }
    }

    // Fall back to recursive chunking
    return this.recursiveChunk(text, finalConfig);
  }

  /**
   * Chunk text by sections (headers)
   */
  private chunkBySections(text: string, config: ChunkingConfig): TextChunk[] {
    const chunks: TextChunk[] = [];
    const lines = text.split('\n');
    let currentSection = '';
    let currentPosition = 0;
    let chunkIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Check if this is a header
      if (this.isHeader(trimmedLine)) {
        // Save previous section if it exists
        if (currentSection.trim()) {
          const sectionChunks = this.splitSectionIntoChunks(
            currentSection,
            currentPosition,
            chunkIndex,
            config
          );
          chunks.push(...sectionChunks);
          chunkIndex += sectionChunks.length;
        }

        // Start new section
        currentSection = line + '\n';
        currentPosition += line.length + 1;
      } else {
        currentSection += line + '\n';
        currentPosition += line.length + 1;
      }
    }

    // Handle the last section
    if (currentSection.trim()) {
      const sectionChunks = this.splitSectionIntoChunks(
        currentSection,
        currentPosition - currentSection.length,
        chunkIndex,
        config
      );
      chunks.push(...sectionChunks);
    }

    return chunks;
  }

  /**
   * Split a section into chunks if it's too large
   */
  private splitSectionIntoChunks(
    section: string,
    startPosition: number,
    chunkIndex: number,
    config: ChunkingConfig
  ): TextChunk[] {
    const chunks: TextChunk[] = [];

    if (section.length <= config.chunk_size) {
      // Section is small enough, keep it as one chunk
      chunks.push(this.createChunk(
        section,
        startPosition,
        startPosition + section.length,
        chunkIndex,
        true
      ));
    } else {
      // Section is too large, split it
      const subChunks = this.recursiveChunk(section, config, startPosition, chunkIndex);
      chunks.push(...subChunks);
    }

    return chunks;
  }

  /**
   * Recursive chunking for large text
   */
  private recursiveChunk(
    text: string,
    config: ChunkingConfig,
    startPosition: number = 0,
    chunkIndex: number = 0
  ): TextChunk[] {
    const chunks: TextChunk[] = [];

    if (text.length <= config.chunk_size) {
      // Text is small enough
      if (text.length >= config.min_chunk_size) {
        chunks.push(this.createChunk(
          text,
          startPosition,
          startPosition + text.length,
          chunkIndex,
          false
        ));
      }
      return chunks;
    }

    // Find the best split point
    const splitPoint = this.findBestSplitPoint(text, config);
    const firstPart = text.substring(0, splitPoint);
    const secondPart = text.substring(splitPoint - config.chunk_overlap);

    // Create chunk for first part
    if (firstPart.length >= config.min_chunk_size) {
      chunks.push(this.createChunk(
        firstPart,
        startPosition,
        startPosition + firstPart.length,
        chunkIndex,
        false
      ));
      chunkIndex++;
    }

    // Recursively chunk the second part
    const remainingChunks = this.recursiveChunk(
      secondPart,
      config,
      startPosition + splitPoint - config.chunk_overlap,
      chunkIndex
    );

    chunks.push(...remainingChunks);
    return chunks;
  }

  /**
   * Find the best point to split text
   */
  private findBestSplitPoint(text: string, config: ChunkingConfig): number {
    const targetSize = config.chunk_size;
    const maxSize = config.max_chunk_size;

    // Start from the target size
    let splitPoint = Math.min(targetSize, text.length);

    // Look for natural break points
    const breakPoints = [
      '\n\n', // Double newline
      '\n',   // Single newline
      '. ',   // Sentence end
      '! ',   // Exclamation
      '? ',   // Question
      '; ',   // Semicolon
      ', ',   // Comma
      ' '     // Space
    ];

    for (const breakPoint of breakPoints) {
      const lastBreak = text.lastIndexOf(breakPoint, splitPoint);
      if (lastBreak > targetSize * 0.7) { // At least 70% of target size
        splitPoint = lastBreak + breakPoint.length;
        break;
      }
    }

    // Ensure we don't exceed max size
    if (splitPoint > maxSize) {
      splitPoint = maxSize;
    }

    return splitPoint;
  }

  /**
   * Check if a line is a header
   */
  private isHeader(line: string): boolean {
    if (!line || line.length > 100) return false;

    // Check for markdown headers
    if (/^#{1,6}\s/.test(line)) return true;

    // Check for all caps (likely a title)
    if (line.length < 50 && line.toUpperCase() === line && /[A-Z]/.test(line)) return true;

    // Check for title case with no periods
    if (line.length < 80 && !line.includes('.') && /^[A-Z]/.test(line)) {
      const words = line.split(' ');
      const titleCaseWords = words.filter(word => /^[A-Z]/.test(word));
      return titleCaseWords.length >= words.length * 0.7; // 70% of words start with capital
    }

    return false;
  }

  /**
   * Create a text chunk
   */
  private createChunk(
    content: string,
    startPosition: number,
    endPosition: number,
    chunkIndex: number,
    isCompleteSection: boolean
  ): TextChunk {
    return {
      id: uuidv4(),
      content: content.trim(),
      token_count: this.estimateTokenCount(content),
      start_position: startPosition,
      end_position: endPosition,
      metadata: {
        chunk_index: chunkIndex,
        is_complete_section: isCompleteSection
      }
    };
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Get chunking statistics
   */
  getChunkingStats(chunks: TextChunk[]): {
    totalChunks: number;
    averageChunkSize: number;
    totalTokens: number;
    averageTokens: number;
    completeSections: number;
  } {
    if (chunks.length === 0) {
      return {
        totalChunks: 0,
        averageChunkSize: 0,
        totalTokens: 0,
        averageTokens: 0,
        completeSections: 0
      };
    }

    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.token_count, 0);
    const completeSections = chunks.filter(chunk => chunk.metadata.is_complete_section).length;

    return {
      totalChunks: chunks.length,
      averageChunkSize: Math.round(totalSize / chunks.length),
      totalTokens,
      averageTokens: Math.round(totalTokens / chunks.length),
      completeSections
    };
  }
} 