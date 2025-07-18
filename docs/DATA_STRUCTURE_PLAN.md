# Data Structure Planning for Vector DB + File Parser

## Overview
This document outlines the data structures and architecture for implementing vector database storage and file parsing capabilities in the Moe Command Console.

## 1. Vector Database Schema

### 1.1 Document Collection Structure
```typescript
interface DocumentVector {
  id: string;                    // Unique document identifier
  title: string;                 // Document title
  content: string;               // Full document content
  content_chunks: string[];      // Chunked content for vectorization
  vectors: number[][];           // Embedding vectors for each chunk
  metadata: {
    filename: string;            // Original filename
    file_type: string;           // PDF, DOCX, TXT, etc.
    file_size: number;           // File size in bytes
    upload_date: string;         // ISO timestamp
    uploaded_by: string;         // User ID
    tags: string[];              // User-defined tags
    category: string;            // Document category
    language: string;            // Document language
    page_count?: number;         // For multi-page documents
  };
  embeddings_model: string;      // Model used for embeddings
  created_at: string;            // ISO timestamp
  updated_at: string;            // ISO timestamp
  status: 'processing' | 'ready' | 'error';
}
```

### 1.2 User Collection Structure
```typescript
interface User {
  id: string;                    // User ID
  email: string;                 // User email
  name: string;                  // User name
  documents: string[];           // Array of document IDs
  preferences: {
    default_language: string;    // Preferred language
    chunk_size: number;          // Preferred chunk size
    embedding_model: string;     // Preferred embedding model
  };
  created_at: string;            // ISO timestamp
  updated_at: string;            // ISO timestamp
}
```

### 1.3 Search Query Structure
```typescript
interface SearchQuery {
  id: string;                    // Query ID
  user_id: string;               // User who made the query
  query: string;                 // Search query text
  query_vector: number[];        // Vectorized query
  results: SearchResult[];       // Search results
  filters: {
    file_types?: string[];       // Filter by file types
    date_range?: {               // Filter by date range
      start: string;
      end: string;
    };
    tags?: string[];             // Filter by tags
    categories?: string[];       // Filter by categories
  };
  created_at: string;            // ISO timestamp
}
```

### 1.4 Search Result Structure
```typescript
interface SearchResult {
  document_id: string;           // Document ID
  chunk_index: number;           // Index of the matching chunk
  similarity_score: number;      // Cosine similarity score
  content_snippet: string;       // Relevant text snippet
  context: string;               // Surrounding context
  metadata: {
    filename: string;
    page_number?: number;
    section_title?: string;
  };
}
```

## 2. File Parser Architecture

### 2.1 Supported File Types
```typescript
enum FileType {
  PDF = 'pdf',
  DOCX = 'docx',
  TXT = 'txt',
  MD = 'markdown',
  CSV = 'csv',
  JSON = 'json',
  XML = 'xml',
  HTML = 'html'
}
```

### 2.2 Parser Interface
```typescript
interface FileParser {
  parse(file: Buffer, metadata: FileMetadata): Promise<ParseResult>;
  extractText(file: Buffer): Promise<string>;
  extractMetadata(file: Buffer): Promise<FileMetadata>;
  validateFile(file: Buffer): Promise<boolean>;
}
```

### 2.3 Parse Result Structure
```typescript
interface ParseResult {
  content: string;               // Extracted text content
  metadata: FileMetadata;        // File metadata
  sections: DocumentSection[];   // Document sections
  tables: TableData[];           // Extracted tables
  images: ImageData[];           // Extracted images
  links: LinkData[];             // Extracted links
  errors: ParseError[];          // Parsing errors
}
```

### 2.4 Document Section Structure
```typescript
interface DocumentSection {
  id: string;                    // Section ID
  title: string;                 // Section title
  content: string;               // Section content
  level: number;                 // Heading level (1-6)
  page_number?: number;          // Page number
  start_position: number;        // Start position in document
  end_position: number;          // End position in document
}
```

## 3. Text Chunking Strategy

### 3.1 Chunking Configuration
```typescript
interface ChunkingConfig {
  chunk_size: number;            // Target chunk size in tokens
  chunk_overlap: number;         // Overlap between chunks
  separator: string;             // Chunk separator
  preserve_sections: boolean;    // Keep sections intact
  min_chunk_size: number;        // Minimum chunk size
  max_chunk_size: number;        // Maximum chunk size
}
```

### 3.2 Chunk Structure
```typescript
interface TextChunk {
  id: string;                    // Chunk ID
  content: string;               // Chunk text
  token_count: number;           // Number of tokens
  start_position: number;        // Start position in document
  end_position: number;          // End position in document
  section_id?: string;           // Associated section
  metadata: {
    chunk_index: number;         // Chunk order
    is_complete_section: boolean; // Is this a complete section?
  };
}
```

## 4. Vector Embedding Strategy

### 4.1 Embedding Configuration
```typescript
interface EmbeddingConfig {
  model: string;                 // Embedding model name
  dimensions: number;            // Vector dimensions
  batch_size: number;            // Batch size for processing
  normalize: boolean;            // Normalize vectors
  cache_embeddings: boolean;     // Cache embeddings
}
```

### 4.2 Embedding Result
```typescript
interface EmbeddingResult {
  chunk_id: string;              // Associated chunk ID
  vector: number[];              // Embedding vector
  model: string;                 // Model used
  processing_time: number;       // Processing time in ms
  token_count: number;           // Input token count
}
```

## 5. Database Schema (MongoDB/PostgreSQL)

### 5.1 Collections/Tables

#### Documents Collection
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  content_chunks JSONB,
  vectors JSONB,
  metadata JSONB NOT NULL,
  embeddings_model VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'processing'
);
```

#### Users Collection
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  documents UUID[],
  preferences JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Search Queries Collection
```sql
CREATE TABLE search_queries (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  query TEXT NOT NULL,
  query_vector JSONB,
  results JSONB,
  filters JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 6. API Endpoints Structure

### 6.1 Document Management
```typescript
// Upload and process document
POST /api/documents/upload
// Get document by ID
GET /api/documents/:id
// List user documents
GET /api/documents
// Delete document
DELETE /api/documents/:id
// Update document metadata
PUT /api/documents/:id
```

### 6.2 Search Endpoints
```typescript
// Semantic search
POST /api/search/semantic
// Keyword search
POST /api/search/keyword
// Hybrid search
POST /api/search/hybrid
// Search history
GET /api/search/history
```

### 6.3 Processing Endpoints
```typescript
// Get processing status
GET /api/documents/:id/status
// Retry processing
POST /api/documents/:id/retry
// Cancel processing
DELETE /api/documents/:id/cancel
```

## 7. Implementation Phases

### Phase 1: Basic File Parser (Week 1)
- [ ] Implement PDF parser using pdf-parse
- [ ] Implement TXT parser
- [ ] Implement DOCX parser using mammoth
- [ ] Create parser factory pattern
- [ ] Add file validation

### Phase 2: Text Chunking (Week 2)
- [ ] Implement recursive text chunking
- [ ] Add section-aware chunking
- [ ] Implement chunk overlap strategy
- [ ] Add chunk metadata extraction

### Phase 3: Vector Embeddings (Week 3)
- [ ] Integrate OpenAI embeddings API
- [ ] Implement batch processing
- [ ] Add vector caching
- [ ] Implement similarity search

### Phase 4: Database Integration (Week 4)
- [ ] Set up vector database (Pinecone/Weaviate)
- [ ] Implement CRUD operations
- [ ] Add search functionality
- [ ] Implement user management

### Phase 5: API Development (Week 5)
- [ ] Create REST API endpoints
- [ ] Add authentication middleware
- [ ] Implement search endpoints
- [ ] Add error handling

### Phase 6: Testing & Optimization (Week 6)
- [ ] Unit tests for parsers
- [ ] Integration tests
- [ ] Performance optimization
- [ ] Documentation

## 8. Technology Stack

### Vector Database Options
1. **Pinecone** - Managed vector database
2. **Weaviate** - Open-source vector database
3. **Qdrant** - High-performance vector database
4. **Chroma** - Embedding database

### File Parsing Libraries
1. **pdf-parse** - PDF text extraction
2. **mammoth** - DOCX parsing
3. **csv-parser** - CSV parsing
4. **marked** - Markdown parsing

### Embedding Models
1. **OpenAI text-embedding-ada-002** - 1536 dimensions
2. **OpenAI text-embedding-3-small** - 1536 dimensions
3. **OpenAI text-embedding-3-large** - 3072 dimensions

## 9. Performance Considerations

### Chunking Optimization
- Optimal chunk size: 512-1024 tokens
- Overlap: 10-20% of chunk size
- Parallel processing for large documents

### Vector Search Optimization
- Index optimization for fast retrieval
- Batch processing for embeddings
- Caching frequently accessed vectors
- Pagination for large result sets

### Storage Optimization
- Compress vectors using quantization
- Archive old documents
- Implement data retention policies
- Use CDN for file storage

## 10. Security Considerations

### Data Privacy
- Encrypt sensitive documents
- Implement access controls
- Audit trail for document access
- GDPR compliance measures

### API Security
- Rate limiting for search queries
- Input validation and sanitization
- CORS configuration
- API key management

This data structure plan provides a comprehensive foundation for implementing vector database and file parser functionality in the Moe Command Console. 