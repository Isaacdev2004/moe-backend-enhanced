import { FileParser, FileType, FileMetadata, ParseResult, DocumentSection, TableData, ImageData, LinkData, ParseError } from '../../types/file-parser.js';
import { v4 as uuidv4 } from 'uuid';

export abstract class BaseParser implements FileParser {
  protected supportedTypes: FileType[];

  constructor(supportedTypes: FileType[]) {
    this.supportedTypes = supportedTypes;
  }

  abstract parse(file: Buffer, metadata: FileMetadata): Promise<ParseResult>;
  abstract extractText(file: Buffer): Promise<string>;
  abstract extractMetadata(file: Buffer): Promise<FileMetadata>;
  abstract validateFile(file: Buffer): Promise<boolean>;

  getSupportedTypes(): FileType[] {
    return this.supportedTypes;
  }

  protected createDocumentSection(
    title: string,
    content: string,
    level: number,
    startPosition: number,
    endPosition: number,
    pageNumber?: number
  ): DocumentSection {
    return {
      id: uuidv4(),
      title,
      content,
      level,
      page_number: pageNumber,
      start_position: startPosition,
      end_position: endPosition
    };
  }

  protected createTableData(
    headers: string[],
    rows: string[][],
    startPosition: number,
    endPosition: number,
    title?: string,
    pageNumber?: number
  ): TableData {
    return {
      id: uuidv4(),
      title,
      headers,
      rows,
      page_number: pageNumber,
      start_position: startPosition,
      end_position: endPosition
    };
  }

  protected createImageData(
    altText: string,
    position: number,
    pageNumber?: number,
    caption?: string
  ): ImageData {
    return {
      id: uuidv4(),
      alt_text: altText,
      caption,
      page_number: pageNumber,
      position
    };
  }

  protected createLinkData(
    text: string,
    url: string,
    position: number,
    pageNumber?: number
  ): LinkData {
    return {
      id: uuidv4(),
      text,
      url,
      page_number: pageNumber,
      position
    };
  }

  protected createParseError(
    type: 'parsing' | 'validation' | 'extraction',
    message: string,
    severity: 'warning' | 'error' = 'error',
    position?: number
  ): ParseError {
    return {
      type,
      message,
      position,
      severity
    };
  }

  protected extractSectionsFromText(text: string): DocumentSection[] {
    const sections: DocumentSection[] = [];
    const lines = text.split('\n');
    let currentSection: DocumentSection | null = null;
    let position = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check for headers (simple heuristic)
      if (trimmedLine && trimmedLine.length < 100 && !trimmedLine.includes('.')) {
        const level = this.determineHeaderLevel(trimmedLine);
        
        if (level > 0) {
          // Close previous section
          if (currentSection) {
            currentSection.end_position = position - line.length - 1;
            sections.push(currentSection);
          }
          
          // Start new section
          currentSection = this.createDocumentSection(
            trimmedLine,
            '',
            level,
            position,
            position + line.length
          );
        }
      }
      
      if (currentSection) {
        currentSection.content += line + '\n';
      }
      
      position += line.length + 1; // +1 for newline
    }

    // Close last section
    if (currentSection) {
      currentSection.end_position = position;
      sections.push(currentSection);
    }

    return sections;
  }

  private determineHeaderLevel(text: string): number {
    // Simple heuristic for determining header level
    if (text.length < 30 && text.toUpperCase() === text) return 1;
    if (text.length < 50 && /^[A-Z][a-z]/.test(text)) return 2;
    if (text.length < 80) return 3;
    return 0; // Not a header
  }

  protected extractLinksFromText(text: string): LinkData[] {
    const links: LinkData[] = [];
    const urlRegex = /https?:\/\/[^\s]+/g;
    let match;
    let position = 0;

    while ((match = urlRegex.exec(text)) !== null) {
      links.push(this.createLinkData(
        match[0],
        match[0],
        match.index,
        undefined
      ));
    }

    return links;
  }

  protected sanitizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
} 