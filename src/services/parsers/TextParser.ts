import { BaseParser } from './BaseParser.js';
import { FileType, FileMetadata, ParseResult } from '../../types/file-parser.js';

export class TextParser extends BaseParser {
  constructor() {
    super([FileType.TXT]);
  }

  async parse(file: Buffer, metadata: FileMetadata): Promise<ParseResult> {
    try {
      const text = await this.extractText(file);
      const sections = this.extractSectionsFromText(text);
      const links = this.extractLinksFromText(text);
      
      return {
        content: text,
        metadata: await this.extractMetadata(file),
        sections,
        tables: [],
        images: [],
        links,
        errors: []
      };
    } catch (error) {
      return {
        content: '',
        metadata,
        sections: [],
        tables: [],
        images: [],
        links: [],
        errors: [this.createParseError('parsing', `Failed to parse text file: ${error}`)]
      };
    }
  }

  async extractText(file: Buffer): Promise<string> {
    try {
      // Try different encodings
      const encodings = ['utf8', 'utf16le', 'latin1', 'ascii'];
      
      for (const encoding of encodings) {
        try {
          const text = file.toString(encoding as BufferEncoding);
          if (text && text.length > 0) {
            return this.sanitizeText(text);
          }
        } catch (e) {
          continue;
        }
      }
      
      throw new Error('Unable to decode text file with any supported encoding');
    } catch (error) {
      throw new Error(`Text extraction failed: ${error}`);
    }
  }

  async extractMetadata(file: Buffer): Promise<FileMetadata> {
    const text = await this.extractText(file);
    const lines = text.split('\n');
    
    // Extract basic metadata
    const metadata: FileMetadata = {
      filename: 'unknown.txt',
      file_type: FileType.TXT,
      file_size: file.length,
      mime_type: 'text/plain',
      encoding: 'utf8',
      language: this.detectLanguage(text),
      page_count: this.estimatePageCount(text),
      created_date: new Date().toISOString(),
      modified_date: new Date().toISOString()
    };

    // Try to extract title from first few lines
    const firstLines = lines.slice(0, 5).filter(line => line.trim().length > 0);
    if (firstLines.length > 0) {
      const potentialTitle = firstLines[0].trim();
      if (potentialTitle.length < 100 && !potentialTitle.includes('.')) {
        metadata.title = potentialTitle;
      }
    }

    return metadata;
  }

  async validateFile(file: Buffer): Promise<boolean> {
    try {
      // Check if file is not empty
      if (file.length === 0) {
        return false;
      }

      // Try to extract text to validate it's readable
      const text = await this.extractText(file);
      return text.length > 0;
    } catch (error) {
      return false;
    }
  }

  private detectLanguage(text: string): string {
    // Simple language detection based on common words
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const spanishWords = ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te'];
    const frenchWords = ['le', 'la', 'de', 'et', 'à', 'en', 'un', 'est', 'il', 'ne', 'pas', 'vous'];

    const words = text.toLowerCase().split(/\s+/);
    const englishCount = words.filter(word => englishWords.includes(word)).length;
    const spanishCount = words.filter(word => spanishWords.includes(word)).length;
    const frenchCount = words.filter(word => frenchWords.includes(word)).length;

    if (englishCount > spanishCount && englishCount > frenchCount) return 'en';
    if (spanishCount > englishCount && spanishCount > frenchCount) return 'es';
    if (frenchCount > englishCount && frenchCount > spanishCount) return 'fr';
    
    return 'en'; // Default to English
  }

  private estimatePageCount(text: string): number {
    // Rough estimate: 1 page = ~500 words
    const words = text.split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 500));
  }
} 