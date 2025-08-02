import { GPTAssistantService, ChatMessage, ChatResponse } from './GPTAssistantService.js';
import { VectorDBService } from './VectorDBService.js';
import { DocumentModel } from '../models/Document.js';
import { v4 as uuidv4 } from 'uuid';

export interface ConversationSession {
  id: string;
  user_id: string;
  title: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
  context_summary: string;
  total_tokens_used: number;
}

export interface RAGResponse {
  response: ChatResponse;
  session_id: string;
  follow_up_suggestions: string[];
  related_documents: Array<{
    id: string;
    title: string;
    relevance_score: number;
  }>;
}

export class RAGPipelineService {
  private gptAssistant: GPTAssistantService;
  private vectorDB: VectorDBService;
  private conversations: Map<string, ConversationSession> = new Map();

  constructor() {
    this.gptAssistant = new GPTAssistantService();
    this.vectorDB = new VectorDBService();
  }

  /**
   * Main RAG pipeline method - processes user input through the full pipeline
   */
  async processQuery(
    query: string,
    userId: string,
    sessionId?: string,
    uploadedFileId?: string
  ): Promise<RAGResponse> {
    try {
      console.log(`🧠 Processing RAG query for user ${userId}: "${query}"`);

      // Step 1: Get or create conversation session
      const session = sessionId 
        ? await this.getSession(sessionId, userId)
        : await this.createSession(userId, query);

      // Step 2: Retrieve uploaded file context if provided
      const fileContext = uploadedFileId 
        ? await this.getFileContext(uploadedFileId, userId)
        : undefined;

      // Step 3: Process through GPT Assistant with RAG
      const chatResponse = await this.gptAssistant.chat(
        query,
        userId,
        session.messages,
        fileContext
      );

      // Step 4: Update conversation session
      await this.updateSession(session, query, chatResponse);

      // Step 5: Generate follow-up suggestions
      const followUpSuggestions = await this.generateFollowUpSuggestions(
        query,
        chatResponse,
        fileContext
      );

      // Step 6: Find related documents
      const relatedDocuments = await this.findRelatedDocuments(
        query,
        userId,
        chatResponse.context.relevant_documents.map(doc => doc.id)
      );

      const ragResponse: RAGResponse = {
        response: chatResponse,
        session_id: session.id,
        follow_up_suggestions: followUpSuggestions,
        related_documents: relatedDocuments
      };

      console.log(`✅ RAG pipeline completed in ${chatResponse.metadata.processing_time}ms`);
      return ragResponse;

    } catch (error) {
      console.error('Error in RAG pipeline:', error);
      throw new Error(`RAG processing failed: ${error}`);
    }
  }

  /**
   * Process file upload with diagnostic analysis
   */
  async processFileUpload(
    fileId: string,
    userId: string,
    analysisQuery?: string
  ): Promise<{
    diagnostic: any;
    initial_response: RAGResponse;
    recommendations: string[];
  }> {
    try {
      console.log(`📁 Processing file upload diagnostic for file ${fileId}`);

      // Get file context from vector database
      const document = await this.vectorDB.getDocument(fileId);
      if (!document) {
        throw new Error('File not found');
      }

      // Extract specialized data if available
      const fileContext = (document as any).specialized_data;

      // Generate comprehensive diagnostic
      const diagnostic = await this.gptAssistant.generateFileDiagnostic(
        fileContext,
        userId
      );

      // Create initial analysis query
      const defaultQuery = analysisQuery || 
        `Please analyze this ${fileContext?.file_type || 'uploaded'} file and provide insights about its configuration, any issues found, and recommendations for improvement.`;

      // Process through RAG pipeline
      const initialResponse = await this.processQuery(
        defaultQuery,
        userId,
        undefined,
        fileId
      );

      // Generate specific recommendations
      const recommendations = await this.generateFileRecommendations(
        fileContext,
        diagnostic
      );

      return {
        diagnostic,
        initial_response: initialResponse,
        recommendations
      };

    } catch (error) {
      console.error('Error processing file upload:', error);
      throw new Error(`File processing failed: ${error}`);
    }
  }

  /**
   * Create a new conversation session
   */
  private async createSession(userId: string, initialQuery: string): Promise<ConversationSession> {
    const session: ConversationSession = {
      id: uuidv4(),
      user_id: userId,
      title: this.generateSessionTitle(initialQuery),
      messages: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      context_summary: '',
      total_tokens_used: 0
    };

    this.conversations.set(session.id, session);
    console.log(`📝 Created new conversation session: ${session.id}`);
    return session;
  }

  /**
   * Get existing conversation session
   */
  private async getSession(sessionId: string, userId: string): Promise<ConversationSession> {
    const session = this.conversations.get(sessionId);
    if (!session || session.user_id !== userId) {
      throw new Error('Session not found or access denied');
    }
    return session;
  }

  /**
   * Update conversation session with new messages
   */
  private async updateSession(
    session: ConversationSession,
    userQuery: string,
    chatResponse: ChatResponse
  ): Promise<void> {
    // Add user message
    session.messages.push({
      role: 'user',
      content: userQuery,
      timestamp: new Date().toISOString()
    });

    // Add assistant response
    session.messages.push(chatResponse.message);

    // Update session metadata
    session.updated_at = new Date().toISOString();
    session.total_tokens_used += chatResponse.metadata.tokens_used;
    session.context_summary = this.updateContextSummary(session.messages);

    // Keep only last 50 messages to manage memory
    if (session.messages.length > 50) {
      session.messages = session.messages.slice(-50);
    }

    this.conversations.set(session.id, session);
  }

  /**
   * Get file context from uploaded file
   */
  private async getFileContext(fileId: string, userId: string): Promise<any> {
    try {
      const document = await this.vectorDB.getDocument(fileId);
      if (!document || document.metadata.uploaded_by !== userId) {
        throw new Error('File not found or access denied');
      }

      return (document as any).specialized_data || {
        file_type: document.metadata.file_type,
        content: document.content
      };
    } catch (error) {
      console.error('Error getting file context:', error);
      return null;
    }
  }

  /**
   * Generate follow-up suggestions based on the conversation
   */
  private async generateFollowUpSuggestions(
    query: string,
    response: ChatResponse,
    fileContext?: any
  ): Promise<string[]> {
    const suggestions = [];

    // Context-based suggestions
    if (fileContext) {
      suggestions.push("Can you explain any issues found in more detail?");
      suggestions.push("What are the best practices for this file type?");
      suggestions.push("How can I optimize this configuration?");
    }

    // Query-type based suggestions
    if (query.toLowerCase().includes('error') || query.toLowerCase().includes('issue')) {
      suggestions.push("What are common causes of this type of error?");
      suggestions.push("How can I prevent this issue in the future?");
    }

    if (query.toLowerCase().includes('parameter') || query.toLowerCase().includes('configuration')) {
      suggestions.push("Are there any related parameters I should check?");
      suggestions.push("What values are recommended for this parameter?");
    }

    // Default suggestions
    if (suggestions.length === 0) {
      suggestions.push("Can you provide more details about this topic?");
      suggestions.push("Are there any related documentation or examples?");
      suggestions.push("What are the best practices for this scenario?");
    }

    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }

  /**
   * Find related documents based on the query and context
   */
  private async findRelatedDocuments(
    query: string,
    userId: string,
    excludeIds: string[]
  ): Promise<Array<{ id: string; title: string; relevance_score: number }>> {
    try {
      const searchResults = await this.vectorDB.search(query, {}, 5);
      
      return searchResults
        .filter(result => !excludeIds.includes(result.document_id))
        .map(result => ({
          id: result.document_id,
          title: result.metadata.filename,
          relevance_score: result.similarity_score
        }))
        .slice(0, 3);
    } catch (error) {
      console.error('Error finding related documents:', error);
      return [];
    }
  }

  /**
   * Generate session title from initial query
   */
  private generateSessionTitle(query: string): string {
    // Extract key words and create a meaningful title
    const words = query.split(' ').filter(word => word.length > 3);
    const title = words.slice(0, 4).join(' ');
    return title.length > 5 ? title : 'New Conversation';
  }

  /**
   * Update context summary for the session
   */
  private updateContextSummary(messages: ChatMessage[]): string {
    // Create a summary of the last few messages
    const recentMessages = messages.slice(-6);
    const summary = recentMessages
      .map(msg => `${msg.role}: ${msg.content.substring(0, 100)}`)
      .join('; ');
    
    return summary.length > 300 ? summary.substring(0, 300) + '...' : summary;
  }

  /**
   * Generate file-specific recommendations
   */
  private async generateFileRecommendations(
    fileContext: any,
    diagnostic: any
  ): Promise<string[]> {
    const recommendations = [];

    // Based on file type
    if (fileContext?.file_type) {
      switch (fileContext.file_type.toLowerCase()) {
        case 'cab':
        case 'cabx':
          recommendations.push('Validate all component parameters against specifications');
          recommendations.push('Check for proper constraint definitions');
          break;
        case 'mzb':
          recommendations.push('Verify mathematical model parameters');
          recommendations.push('Ensure boundary conditions are properly defined');
          break;
        case 'xml':
          recommendations.push('Validate XML schema compliance');
          recommendations.push('Check for proper namespace declarations');
          break;
      }
    }

    // Based on detected issues
    if (diagnostic?.issues?.length > 0) {
      recommendations.push('Address all high-severity issues before deployment');
      recommendations.push('Test configuration changes in a development environment');
    }

    // General recommendations
    recommendations.push('Document any configuration changes made');
    recommendations.push('Create backup before implementing changes');

    return recommendations.slice(0, 5);
  }

  /**
   * Get conversation history for a user
   */
  async getConversationHistory(userId: string): Promise<ConversationSession[]> {
    const userSessions = Array.from(this.conversations.values())
      .filter(session => session.user_id === userId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return userSessions.slice(0, 20); // Return last 20 conversations
  }

  /**
   * Delete a conversation session
   */
  async deleteSession(sessionId: string, userId: string): Promise<void> {
    const session = this.conversations.get(sessionId);
    if (session && session.user_id === userId) {
      this.conversations.delete(sessionId);
      console.log(`🗑️ Deleted conversation session: ${sessionId}`);
    } else {
      throw new Error('Session not found or access denied');
    }
  }

  /**
   * Get RAG pipeline statistics
   */
  getStatistics(): {
    total_conversations: number;
    total_messages: number;
    average_session_length: number;
    total_tokens_used: number;
  } {
    const sessions = Array.from(this.conversations.values());
    const totalMessages = sessions.reduce((sum, session) => sum + session.messages.length, 0);
    const totalTokens = sessions.reduce((sum, session) => sum + session.total_tokens_used, 0);

    return {
      total_conversations: sessions.length,
      total_messages: totalMessages,
      average_session_length: sessions.length > 0 ? totalMessages / sessions.length : 0,
      total_tokens_used: totalTokens
    };
  }
} 