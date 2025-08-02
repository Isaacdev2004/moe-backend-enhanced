import mongoose, { Schema, Document as MongoDocument } from 'mongoose';
import { DocumentVector, DocumentMetadata } from '../types/vector-db.js';

// Document Metadata Schema
const DocumentMetadataSchema = new Schema<DocumentMetadata>({
  filename: { type: String, required: true },
  file_type: { type: String, required: true },
  file_size: { type: Number, required: true },
  upload_date: { type: String, required: true },
  uploaded_by: { type: String, required: true },
  tags: [{ type: String }],
  category: { type: String, required: true },
  language: { type: String, required: true },
  page_count: { type: Number }
});

// Text Chunk Schema for storing processed chunks
const TextChunkSchema = new Schema({
  id: { type: String, required: true },
  content: { type: String, required: true },
  token_count: { type: Number, required: true },
  start_position: { type: Number, required: true },
  end_position: { type: Number, required: true },
  section_id: { type: String },
  metadata: {
    chunk_index: { type: Number, required: true },
    is_complete_section: { type: Boolean, required: true }
  }
});

// Main Document Schema
const DocumentSchema = new Schema<DocumentVector & MongoDocument>({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  content_chunks: [{ type: String }],
  vectors: [[{ type: Number }]], // Array of number arrays for vector embeddings
  metadata: { type: DocumentMetadataSchema, required: true },
  embeddings_model: { type: String, required: true },
  created_at: { type: String, required: true },
  updated_at: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['processing', 'ready', 'error'], 
    default: 'processing' 
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  strict: false // Allow additional fields like chunks and specialized_data
});

// Indexes for efficient searching
DocumentSchema.index({ 'metadata.uploaded_by': 1 });
DocumentSchema.index({ 'metadata.file_type': 1 });
DocumentSchema.index({ 'metadata.category': 1 });
DocumentSchema.index({ 'metadata.tags': 1 });
DocumentSchema.index({ status: 1 });
DocumentSchema.index({ created_at: -1 });

// Search Query Schema for storing user search history
const SearchQuerySchema = new Schema({
  id: { type: String, required: true, unique: true },
  user_id: { type: String, required: true },
  query: { type: String, required: true },
  query_vector: [{ type: Number }],
  results: [{
    document_id: { type: String, required: true },
    chunk_index: { type: Number, required: true },
    similarity_score: { type: Number, required: true },
    content_snippet: { type: String, required: true },
    context: { type: String, required: true },
    metadata: {
      filename: { type: String, required: true },
      page_number: { type: Number },
      section_title: { type: String }
    }
  }],
  filters: {
    file_types: [{ type: String }],
    date_range: {
      start: { type: String },
      end: { type: String }
    },
    tags: [{ type: String }],
    categories: [{ type: String }]
  },
  created_at: { type: String, required: true }
}, {
  timestamps: { createdAt: 'created_at' }
});

SearchQuerySchema.index({ user_id: 1 });
SearchQuerySchema.index({ created_at: -1 });

// Export models
export const DocumentModel = mongoose.model<DocumentVector & MongoDocument>('Document', DocumentSchema);
export const SearchQueryModel = mongoose.model('SearchQuery', SearchQuerySchema); 