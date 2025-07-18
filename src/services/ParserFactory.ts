import { ParserFactory, FileType, FileParser } from '../types/file-parser.js';
import { TextParser } from './parsers/TextParser.js';

export class DocumentParserFactory implements ParserFactory {
  private parsers: Map<FileType, FileParser>;

  constructor() {
    this.parsers = new Map();
    this.initializeParsers();
  }

  private initializeParsers(): void {
    // Register all available parsers
    this.registerParser(FileType.TXT, new TextParser());
    
    // TODO: Add more parsers as they are implemented
    // this.registerParser(FileType.PDF, new PDFParser());
    // this.registerParser(FileType.DOCX, new DOCXParser());
    // this.registerParser(FileType.MD, new MarkdownParser());
    // this.registerParser(FileType.CSV, new CSVParser());
    // this.registerParser(FileType.JSON, new JSONParser());
  }

  createParser(fileType: FileType): FileParser {
    const parser = this.parsers.get(fileType);
    if (!parser) {
      throw new Error(`No parser available for file type: ${fileType}`);
    }
    return parser;
  }

  getSupportedTypes(): FileType[] {
    return Array.from(this.parsers.keys());
  }

  validateFileType(fileType: string): boolean {
    return Object.values(FileType).includes(fileType as FileType);
  }

  registerParser(fileType: FileType, parser: FileParser): void {
    this.parsers.set(fileType, parser);
  }

  getParserInfo(): Array<{ type: FileType; supportedTypes: FileType[] }> {
    return Array.from(this.parsers.entries()).map(([type, parser]) => ({
      type,
      supportedTypes: parser.getSupportedTypes()
    }));
  }

  // Helper method to get file type from filename
  getFileTypeFromFilename(filename: string): FileType | null {
    const extension = filename.toLowerCase().split('.').pop();
    if (!extension) return null;

    const extensionMap: Record<string, FileType> = {
      'txt': FileType.TXT,
      'pdf': FileType.PDF,
      'docx': FileType.DOCX,
      'doc': FileType.DOCX,
      'md': FileType.MD,
      'markdown': FileType.MD,
      'csv': FileType.CSV,
      'json': FileType.JSON,
      'xml': FileType.XML,
      'html': FileType.HTML,
      'htm': FileType.HTML
    };

    return extensionMap[extension] || null;
  }

  // Helper method to get MIME type from file type
  getMimeType(fileType: FileType): string {
    const mimeTypeMap: Record<FileType, string> = {
      [FileType.TXT]: 'text/plain',
      [FileType.PDF]: 'application/pdf',
      [FileType.DOCX]: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      [FileType.MD]: 'text/markdown',
      [FileType.CSV]: 'text/csv',
      [FileType.JSON]: 'application/json',
      [FileType.XML]: 'application/xml',
      [FileType.HTML]: 'text/html'
    };

    return mimeTypeMap[fileType] || 'application/octet-stream';
  }

  // Helper method to validate file size
  validateFileSize(fileSize: number, maxSize: number = 10 * 1024 * 1024): boolean {
    return fileSize > 0 && fileSize <= maxSize;
  }

  // Helper method to get parser capabilities
  getParserCapabilities(fileType: FileType): {
    canExtractText: boolean;
    canExtractMetadata: boolean;
    canExtractSections: boolean;
    canExtractTables: boolean;
    canExtractImages: boolean;
    canExtractLinks: boolean;
  } {
    const parser = this.parsers.get(fileType);
    if (!parser) {
      return {
        canExtractText: false,
        canExtractMetadata: false,
        canExtractSections: false,
        canExtractTables: false,
        canExtractImages: false,
        canExtractLinks: false
      };
    }

    // For now, return basic capabilities for text parser
    // This should be enhanced as more parsers are added
    return {
      canExtractText: true,
      canExtractMetadata: true,
      canExtractSections: true,
      canExtractTables: false,
      canExtractImages: false,
      canExtractLinks: true
    };
  }
} 