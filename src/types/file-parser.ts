// File Parser Types and Interfaces

export enum FileType {
  PDF = 'pdf',
  DOCX = 'docx',
  TXT = 'txt',
  MD = 'markdown',
  CSV = 'csv',
  JSON = 'json',
  XML = 'xml',
  HTML = 'html'
}

export interface FileMetadata {
  filename: string;
  file_type: FileType;
  file_size: number;
  mime_type: string;
  encoding?: string;
  language?: string;
  page_count?: number;
  created_date?: string;
  modified_date?: string;
  author?: string;
  title?: string;
  subject?: string;
  keywords?: string[];
}

export interface ParseResult {
  content: string;
  metadata: FileMetadata;
  sections: DocumentSection[];
  tables: TableData[];
  images: ImageData[];
  links: LinkData[];
  errors: ParseError[];
}

export interface DocumentSection {
  id: string;
  title: string;
  content: string;
  level: number;
  page_number?: number;
  start_position: number;
  end_position: number;
}

export interface TableData {
  id: string;
  title?: string;
  headers: string[];
  rows: string[][];
  page_number?: number;
  start_position: number;
  end_position: number;
}

export interface ImageData {
  id: string;
  alt_text?: string;
  caption?: string;
  page_number?: number;
  position: number;
}

export interface LinkData {
  id: string;
  text: string;
  url: string;
  page_number?: number;
  position: number;
}

export interface ParseError {
  type: 'parsing' | 'validation' | 'extraction';
  message: string;
  position?: number;
  severity: 'warning' | 'error';
}

// File Parser Interface
export interface FileParser {
  parse(file: Buffer, metadata: FileMetadata): Promise<ParseResult>;
  extractText(file: Buffer): Promise<string>;
  extractMetadata(file: Buffer): Promise<FileMetadata>;
  validateFile(file: Buffer): Promise<boolean>;
  getSupportedTypes(): FileType[];
}

// Text Chunking Types
export interface ChunkingConfig {
  chunk_size: number;
  chunk_overlap: number;
  separator: string;
  preserve_sections: boolean;
  min_chunk_size: number;
  max_chunk_size: number;
}

export interface TextChunk {
  id: string;
  content: string;
  token_count: number;
  start_position: number;
  end_position: number;
  section_id?: string;
  metadata: {
    chunk_index: number;
    is_complete_section: boolean;
  };
}

// Embedding Types
export interface EmbeddingConfig {
  model: string;
  dimensions: number;
  batch_size: number;
  normalize: boolean;
  cache_embeddings: boolean;
}

export interface EmbeddingResult {
  chunk_id: string;
  vector: number[];
  model: string;
  processing_time: number;
  token_count: number;
}

// Parser Factory Interface
export interface ParserFactory {
  createParser(fileType: FileType): FileParser;
  getSupportedTypes(): FileType[];
  validateFileType(fileType: string): boolean;
}

// Processing Pipeline Types
export interface ProcessingPipeline {
  parse(file: Buffer, metadata: FileMetadata): Promise<ParseResult>;
  chunk(text: string, config: ChunkingConfig): Promise<TextChunk[]>;
  embed(chunks: TextChunk[], config: EmbeddingConfig): Promise<EmbeddingResult[]>;
  process(file: Buffer, metadata: FileMetadata): Promise<{
    parseResult: ParseResult;
    chunks: TextChunk[];
    embeddings: EmbeddingResult[];
  }>;
} 