import { v4 as uuidv4 } from 'uuid';
import { VectorDBService as IVectorDBService, DocumentVector, User, SearchResult, SearchFilters } from '../types/vector-db.js';
import { DocumentModel, SearchQueryModel } from '../models/Document.js';
import { EmbeddingService, EmbeddingResult } from './EmbeddingService.js';
import { TextChunkingService } from './TextChunkingService.js';
import { TextChunk } from '../types/file-parser.js';

export class VectorDBService implements IVectorDBService {
  private embeddingService: EmbeddingService;
  private chunkingService: TextChunkingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
    this.chunkingService = new TextChunkingService();
  }

  // Document operations
  async addDocument(document: DocumentVector): Promise<string> {
    try {
      console.log(`Adding document: ${document.title}`);
      
      // Generate chunks from content
      const chunks = await this.chunkingService.chunkText(document.content);
      console.log(`Generated ${chunks.length} chunks for document`);
      
      // Generate embeddings for chunks
      const embeddings = await this.embeddingService.generateEmbeddings(chunks);
      console.log(`Generated ${embeddings.length} embeddings`);
      
      // Update document with processed data
      const documentWithEmbeddings = {
        ...document,
        id: document.id || uuidv4(),
        content_chunks: chunks.map(chunk => chunk.content),
        vectors: embeddings.map(emb => emb.vector),
        chunks: chunks,
        embeddings_model: this.embeddingService.getConfig().model,
        status: 'ready' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Save to MongoDB
      const mongoDoc = new DocumentModel(documentWithEmbeddings);
      await mongoDoc.save();
      
      console.log(`✅ Document saved successfully with ID: ${documentWithEmbeddings.id}`);
      return documentWithEmbeddings.id;
    } catch (error) {
      console.error('Error adding document:', error);
      throw new Error(`Failed to add document: ${error}`);
    }
  }

  async getDocument(id: string): Promise<DocumentVector | null> {
    try {
      const doc = await DocumentModel.findOne({ id }).lean();
      return doc ? this.convertToDocumentVector(doc) : null;
    } catch (error) {
      console.error('Error getting document:', error);
      throw new Error(`Failed to get document: ${error}`);
    }
  }

  async updateDocument(id: string, updates: Partial<DocumentVector>): Promise<void> {
    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      await DocumentModel.updateOne({ id }, { $set: updateData });
      console.log(`✅ Document ${id} updated successfully`);
    } catch (error) {
      console.error('Error updating document:', error);
      throw new Error(`Failed to update document: ${error}`);
    }
  }

  async deleteDocument(id: string): Promise<void> {
    try {
      await DocumentModel.deleteOne({ id });
      console.log(`✅ Document ${id} deleted successfully`);
    } catch (error) {
      console.error('Error deleting document:', error);
      throw new Error(`Failed to delete document: ${error}`);
    }
  }

  async listDocuments(userId: string, filters?: SearchFilters): Promise<DocumentVector[]> {
    try {
      const query: any = { 'metadata.uploaded_by': userId };

      // Apply filters
      if (filters) {
        if (filters.file_types?.length) {
          query['metadata.file_type'] = { $in: filters.file_types };
        }
        if (filters.categories?.length) {
          query['metadata.category'] = { $in: filters.categories };
        }
        if (filters.tags?.length) {
          query['metadata.tags'] = { $in: filters.tags };
        }
        if (filters.date_range) {
          query.created_at = {
            ...(filters.date_range.start && { $gte: filters.date_range.start }),
            ...(filters.date_range.end && { $lte: filters.date_range.end })
          };
        }
      }

      const docs = await DocumentModel.find(query)
        .sort({ created_at: -1 })
        .lean();

      return docs.map(doc => this.convertToDocumentVector(doc));
    } catch (error) {
      console.error('Error listing documents:', error);
      throw new Error(`Failed to list documents: ${error}`);
    }
  }

  // Search operations
  async search(query: string, filters?: SearchFilters, limit: number = 10): Promise<SearchResult[]> {
    try {
      console.log(`Searching for: "${query}" with limit: ${limit}`);
      
      // Generate embedding for query
      const queryVector = await this.embeddingService.generateQueryEmbedding(query);
      
      // Perform vector search
      return this.searchByVector(queryVector, filters, limit);
    } catch (error) {
      console.error('Error searching:', error);
      throw new Error(`Failed to search: ${error}`);
    }
  }

  async searchByVector(vector: number[], filters?: SearchFilters, limit: number = 10): Promise<SearchResult[]> {
    try {
      // Build MongoDB query with filters
      const mongoQuery: any = { status: 'ready' };
      
      if (filters) {
        if (filters.file_types?.length) {
          mongoQuery['metadata.file_type'] = { $in: filters.file_types };
        }
        if (filters.categories?.length) {
          mongoQuery['metadata.category'] = { $in: filters.categories };
        }
        if (filters.tags?.length) {
          mongoQuery['metadata.tags'] = { $in: filters.tags };
        }
        if (filters.date_range) {
          mongoQuery.created_at = {
            ...(filters.date_range.start && { $gte: filters.date_range.start }),
            ...(filters.date_range.end && { $lte: filters.date_range.end })
          };
        }
      }

      // Get relevant documents
      const documents = await DocumentModel.find(mongoQuery).lean();
      
      const results: SearchResult[] = [];

      // Calculate similarities for each document's chunks
      for (const doc of documents) {
        const docWithChunks = doc as any; // Type assertion for additional fields
        if (!docWithChunks.vectors || !docWithChunks.chunks) continue;

        for (let i = 0; i < docWithChunks.vectors.length && i < docWithChunks.chunks.length; i++) {
          const chunkVector = docWithChunks.vectors[i];
          const chunk = docWithChunks.chunks[i];
          
          if (!chunkVector || !chunk) continue;

          // Calculate similarity
          const similarity = this.embeddingService.calculateSimilarity(vector, chunkVector);
          
          if (similarity > 0.7) { // Similarity threshold
            results.push({
              document_id: doc.id,
              chunk_index: i,
              similarity_score: similarity,
              content_snippet: this.createSnippet(chunk.content),
              context: this.createContext(docWithChunks.chunks, i),
              metadata: {
                filename: doc.metadata.filename,
                page_number: chunk.metadata?.page_number,
                section_title: this.extractSectionTitle(chunk.content)
              }
            });
          }
        }
      }

      // Sort by similarity and limit results
      results.sort((a, b) => b.similarity_score - a.similarity_score);
      return results.slice(0, limit);
    } catch (error) {
      console.error('Error searching by vector:', error);
      throw new Error(`Failed to search by vector: ${error}`);
    }
  }

  // User operations (using in-memory for now, can be extended to database)
  private users: Map<string, User> = new Map();

  async addUser(user: User): Promise<string> {
    const userId = user.id || uuidv4();
    const userWithId = {
      ...user,
      id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.users.set(userId, userWithId);
    return userId;
  }

  async getUser(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<void> {
    const existingUser = this.users.get(id);
    if (existingUser) {
      const updatedUser = {
        ...existingUser,
        ...updates,
        updated_at: new Date().toISOString()
      };
      this.users.set(id, updatedUser);
    }
  }

  async deleteUser(id: string): Promise<void> {
    this.users.delete(id);
  }

  // Utility operations
  async getStats(): Promise<{
    total_documents: number;
    total_users: number;
    total_vectors: number;
  }> {
    try {
      const totalDocuments = await DocumentModel.countDocuments();
      const totalUsers = this.users.size;
      
      // Calculate total vectors
      const vectorAggregation = await DocumentModel.aggregate([
        { $project: { vectorCount: { $size: { $ifNull: ['$vectors', []] } } } },
        { $group: { _id: null, totalVectors: { $sum: '$vectorCount' } } }
      ]);
      
      const totalVectors = vectorAggregation[0]?.totalVectors || 0;

      return {
        total_documents: totalDocuments,
        total_users: totalUsers,
        total_vectors: totalVectors
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      throw new Error(`Failed to get stats: ${error}`);
    }
  }

  async clearData(): Promise<void> {
    try {
      await DocumentModel.deleteMany({});
      await SearchQueryModel.deleteMany({});
      this.users.clear();
      console.log('✅ All data cleared successfully');
    } catch (error) {
      console.error('Error clearing data:', error);
      throw new Error(`Failed to clear data: ${error}`);
    }
  }

  // Specialized search for parsed components
  async searchSpecializedComponents(
    query: string, 
    componentTypes?: ('parts' | 'parameters' | 'constraints')[],
    limit: number = 10
  ): Promise<SearchResult[]> {
    try {
      const mongoQuery: any = { 
        status: 'ready'
      };

      const documents = await DocumentModel.find(mongoQuery).lean();
      const queryVector = await this.embeddingService.generateQueryEmbedding(query);
      const results: SearchResult[] = [];

      for (const doc of documents) {
        const docWithSpecialized = doc as any; // Type assertion for additional fields
        if (!docWithSpecialized.specialized_data) continue;

        const specializedData = docWithSpecialized.specialized_data;
        
        // Search in parts
        if (!componentTypes || componentTypes.includes('parts')) {
          const partResults = this.searchInComponents(
            queryVector, 
            specializedData.parts || [], 
            doc.id, 
            'parts'
          );
          results.push(...partResults);
        }

        // Search in parameters
        if (!componentTypes || componentTypes.includes('parameters')) {
          const paramResults = this.searchInComponents(
            queryVector, 
            specializedData.parameters || [], 
            doc.id, 
            'parameters'
          );
          results.push(...paramResults);
        }

        // Search in constraints
        if (!componentTypes || componentTypes.includes('constraints')) {
          const constraintResults = this.searchInComponents(
            queryVector, 
            specializedData.constraints || [], 
            doc.id, 
            'constraints'
          );
          results.push(...constraintResults);
        }
      }

      // Sort by similarity and limit results
      results.sort((a, b) => b.similarity_score - a.similarity_score);
      return results.slice(0, limit);
    } catch (error) {
      console.error('Error searching specialized components:', error);
      throw new Error(`Failed to search specialized components: ${error}`);
    }
  }

  // Helper methods
  private convertToDocumentVector(doc: any): DocumentVector {
    return {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      content_chunks: doc.content_chunks || [],
      vectors: doc.vectors || [],
      metadata: doc.metadata,
      embeddings_model: doc.embeddings_model,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      status: doc.status
    };
  }

  private createSnippet(content: string, maxLength: number = 200): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }

  private createContext(chunks: TextChunk[], currentIndex: number): string {
    const contextChunks = [];
    
    // Add previous chunk if exists
    if (currentIndex > 0 && chunks[currentIndex - 1]) {
      contextChunks.push(this.createSnippet(chunks[currentIndex - 1].content, 100));
    }
    
    // Add current chunk
    contextChunks.push(chunks[currentIndex].content);
    
    // Add next chunk if exists
    if (currentIndex < chunks.length - 1 && chunks[currentIndex + 1]) {
      contextChunks.push(this.createSnippet(chunks[currentIndex + 1].content, 100));
    }
    
    return contextChunks.join(' ... ');
  }

  private extractSectionTitle(content: string): string | undefined {
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || (trimmed.length < 80 && !trimmed.includes('.'))) {
        return trimmed;
      }
    }
    return undefined;
  }

  private searchInComponents(
    queryVector: number[], 
    components: any[], 
    documentId: string, 
    componentType: string
  ): SearchResult[] {
    const results: SearchResult[] = [];
    
    for (let i = 0; i < components.length; i++) {
      const component = components[i];
      const componentText = JSON.stringify(component);
      
      // For now, use text similarity (could be improved with component-specific embeddings)
      const textSimilarity = this.calculateTextSimilarity(
        queryVector.join(' '), // Simple text conversion for now
        componentText
      );
      
      if (textSimilarity > 0.3) {
        results.push({
          document_id: documentId,
          chunk_index: i,
          similarity_score: textSimilarity,
          content_snippet: this.createSnippet(componentText),
          context: `${componentType}: ${component.name || component.id || 'Unknown'}`,
          metadata: {
            filename: `${componentType}_${i}`,
            section_title: component.name || component.id
          }
        });
      }
    }
    
    return results;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity for now - can be improved
    const set1 = new Set(text1.toLowerCase().split(/\s+/));
    const set2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }
} 