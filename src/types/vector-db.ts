// Vector Database Types and Interfaces

export interface DocumentVector {
  id: string;
  title: string;
  content: string;
  content_chunks: string[];
  vectors: number[][];
  metadata: DocumentMetadata;
  embeddings_model: string;
  created_at: string;
  updated_at: string;
  status: 'processing' | 'ready' | 'error';
}

export interface DocumentMetadata {
  filename: string;
  file_type: string;
  file_size: number;
  upload_date: string;
  uploaded_by: string;
  tags: string[];
  category: string;
  language: string;
  page_count?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  documents: string[];
  preferences: UserPreferences;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  default_language: string;
  chunk_size: number;
  embedding_model: string;
}

export interface SearchQuery {
  id: string;
  user_id: string;
  query: string;
  query_vector: number[];
  results: SearchResult[];
  filters: SearchFilters;
  created_at: string;
}

export interface SearchFilters {
  file_types?: string[];
  date_range?: {
    start: string;
    end: string;
  };
  tags?: string[];
  categories?: string[];
}

export interface SearchResult {
  document_id: string;
  chunk_index: number;
  similarity_score: number;
  content_snippet: string;
  context: string;
  metadata: {
    filename: string;
    page_number?: number;
    section_title?: string;
  };
}

// Vector Database Service Interface
export interface VectorDBService {
  // Document operations
  addDocument(document: DocumentVector): Promise<string>;
  getDocument(id: string): Promise<DocumentVector | null>;
  updateDocument(id: string, updates: Partial<DocumentVector>): Promise<void>;
  deleteDocument(id: string): Promise<void>;
  listDocuments(userId: string, filters?: SearchFilters): Promise<DocumentVector[]>;
  
  // Search operations
  search(query: string, filters?: SearchFilters, limit?: number): Promise<SearchResult[]>;
  searchByVector(vector: number[], filters?: SearchFilters, limit?: number): Promise<SearchResult[]>;
  
  // User operations
  addUser(user: User): Promise<string>;
  getUser(id: string): Promise<User | null>;
  updateUser(id: string, updates: Partial<User>): Promise<void>;
  deleteUser(id: string): Promise<void>;
  
  // Utility operations
  getStats(): Promise<{
    total_documents: number;
    total_users: number;
    total_vectors: number;
  }>;
  clearData(): Promise<void>;
} 