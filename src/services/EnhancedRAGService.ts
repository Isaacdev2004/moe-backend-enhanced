import { GPTAssistantService, ChatMessage, ChatResponse } from './GPTAssistantService.js';
import { VectorDBService } from './VectorDBService.js';
import { DocumentModel } from '../models/Document.js';
import { SearchFilters } from '../types/vector-db.js';

export interface EnhancedContext {
  user_documents: Array<{
    id: string;
    title: string;
    content_snippet: string;
    similarity_score: number;
    source: 'user_upload';
  }>;
  knowledge_base: Array<{
    id: string;
    title: string;
    content_snippet: string;
    similarity_score: number;
    source: 'scraped_knowledge' | 'curated_knowledge';
    source_platform?: string;
  }>;
  specialized_components: Array<{
    id: string;
    component_type: string;
    content_snippet: string;
    similarity_score: number;
    source: 'user_specialzied';
  }>;
  total_context_sources: number;
  context_quality_score: number;
}

export interface EnhancedChatResponse {
  response: ChatResponse;
  enhanced_context: EnhancedContext;
  context_explanation: string;
  knowledge_coverage: {
    user_specific: boolean;
    general_knowledge: boolean;
    specialized_components: boolean;
    confidence_level: 'high' | 'medium' | 'low';
  };
}

export class EnhancedRAGService {
  private gptAssistant: GPTAssistantService;
  private vectorDB: VectorDBService;

  constructor() {
    this.gptAssistant = new GPTAssistantService();
    this.vectorDB = new VectorDBService();
  }

  /**
   * Enhanced chat method with comprehensive context retrieval
   */
  async enhancedChat(
    message: string,
    userId: string,
    conversationHistory: ChatMessage[] = [],
    uploadedFileContext?: any
  ): Promise<EnhancedChatResponse> {
    try {
      console.log(`🧠 Enhanced RAG processing for user ${userId}: "${message}"`);

      // Step 1: Retrieve comprehensive context from all sources
      const enhancedContext = await this.retrieveEnhancedContext(message, userId, uploadedFileContext);

      // Step 2: Build context explanation for transparency
      const contextExplanation = this.buildContextExplanation(enhancedContext);

      // Step 3: Create enhanced system prompt with all context sources
      const enhancedSystemPrompt = this.buildEnhancedSystemPrompt(enhancedContext);

      // Step 4: Generate response using enhanced context
      const chatResponse = await this.generateEnhancedResponse(
        message,
        userId,
        conversationHistory,
        enhancedContext,
        enhancedSystemPrompt,
        uploadedFileContext
      );

      // Step 5: Assess knowledge coverage
      const knowledgeCoverage = this.assessKnowledgeCoverage(enhancedContext, message);

      return {
        response: chatResponse,
        enhanced_context: enhancedContext,
        context_explanation: contextExplanation,
        knowledge_coverage: knowledgeCoverage
      };

    } catch (error) {
      console.error('Enhanced RAG error:', error);
      throw new Error(`Enhanced RAG processing failed: ${error}`);
    }
  }

  /**
   * Retrieve enhanced context from all available sources
   */
  private async retrieveEnhancedContext(
    query: string,
    userId: string,
    uploadedFileContext?: any
  ): Promise<EnhancedContext> {
    try {
      // 1. Search user's uploaded documents
      const userDocuments = await this.searchUserDocuments(query, userId);

      // 2. Search knowledge base (scraped + curated content)
      const knowledgeBase = await this.searchKnowledgeBase(query);

      // 3. Search specialized components from user's files
      const specializedComponents = await this.searchSpecializedComponents(query, userId);

      // 4. Calculate context quality score
      const contextQualityScore = this.calculateContextQuality([
        ...userDocuments,
        ...knowledgeBase,
        ...specializedComponents
      ]);

      return {
        user_documents: userDocuments,
        knowledge_base: knowledgeBase,
        specialized_components: specializedComponents,
        total_context_sources: userDocuments.length + knowledgeBase.length + specializedComponents.length,
        context_quality_score: contextQualityScore
      };

    } catch (error) {
      console.error('Error retrieving enhanced context:', error);
      return {
        user_documents: [],
        knowledge_base: [],
        specialized_components: [],
        total_context_sources: 0,
        context_quality_score: 0
      };
    }
  }

  /**
   * Search user's uploaded documents
   */
  private async searchUserDocuments(query: string, userId: string): Promise<Array<{
    id: string;
    title: string;
    content_snippet: string;
    similarity_score: number;
    source: 'user_upload';
  }>> {
    try {
      const results = await this.vectorDB.search(query, {}, 3);
      
      return results
        .filter(result => {
          // Only include user's own documents that are uploaded files
          return result.metadata.filename && !result.metadata.filename.startsWith('knowledge_');
        })
        .map(result => ({
          id: result.document_id,
          title: result.metadata.filename,
          content_snippet: result.content_snippet,
          similarity_score: result.similarity_score,
          source: 'user_upload' as const
        }));
    } catch (error) {
      console.error('Error searching user documents:', error);
      return [];
    }
  }

  /**
   * Search knowledge base (scraped and curated content)
   */
  private async searchKnowledgeBase(query: string): Promise<Array<{
    id: string;
    title: string;
    content_snippet: string;
    similarity_score: number;
    source: 'scraped_knowledge' | 'curated_knowledge';
    source_platform?: string;
  }>> {
    try {
      // Search specifically for knowledge base content
      const knowledgeFilter: SearchFilters = {
        categories: ['mozaik_knowledge']
      };

      const results = await this.vectorDB.search(query, knowledgeFilter, 5);
      
      return results
        .filter(result => result.metadata.filename.startsWith('knowledge_'))
        .map(result => ({
          id: result.document_id,
          title: result.metadata.filename.replace('knowledge_', ''),
          content_snippet: result.content_snippet,
          similarity_score: result.similarity_score,
          source: this.determineKnowledgeSource(result.content_snippet),
          source_platform: this.extractSourcePlatform(result.content_snippet)
        }));
    } catch (error) {
      console.error('Error searching knowledge base:', error);
      return [];
    }
  }

  /**
   * Search specialized components from user's files
   */
  private async searchSpecializedComponents(query: string, userId: string): Promise<Array<{
    id: string;
    component_type: string;
    content_snippet: string;
    similarity_score: number;
    source: 'user_specialzied';
  }>> {
    try {
      const results = await this.vectorDB.searchSpecializedComponents(query, undefined, 3);
      
      return results.map(result => ({
        id: result.document_id,
        component_type: this.extractComponentType(result.content_snippet),
        content_snippet: result.content_snippet,
        similarity_score: result.similarity_score,
        source: 'user_specialzied' as const
      }));
    } catch (error) {
      console.error('Error searching specialized components:', error);
      return [];
    }
  }

  /**
   * Build enhanced system prompt with all context sources
   */
  private buildEnhancedSystemPrompt(context: EnhancedContext): string {
    let prompt = `You are Moe, an expert AI assistant specialized in Mozaik software with access to multiple knowledge sources:

KNOWLEDGE SOURCES AVAILABLE:
1. User's Uploaded Documents: ${context.user_documents.length} relevant files
2. Mozaik Knowledge Base: ${context.knowledge_base.length} expert resources  
3. Specialized Components: ${context.specialized_components.length} technical components

CONTEXT QUALITY: ${(context.context_quality_score * 100).toFixed(1)}%

`;

    // Add user documents context
    if (context.user_documents.length > 0) {
      prompt += "\nUSER'S DOCUMENTS:\n";
      context.user_documents.forEach((doc, index) => {
        prompt += `${index + 1}. ${doc.title} (${(doc.similarity_score * 100).toFixed(1)}% relevant)\n`;
        prompt += `   ${doc.content_snippet}\n\n`;
      });
    }

    // Add knowledge base context
    if (context.knowledge_base.length > 0) {
      prompt += "\nMOZAIK KNOWLEDGE BASE:\n";
      context.knowledge_base.forEach((kb, index) => {
        prompt += `${index + 1}. ${kb.title} (${(kb.similarity_score * 100).toFixed(1)}% relevant)\n`;
        prompt += `   Source: ${kb.source_platform || kb.source}\n`;
        prompt += `   ${kb.content_snippet}\n\n`;
      });
    }

    // Add specialized components context
    if (context.specialized_components.length > 0) {
      prompt += "\nSPECIALIZED COMPONENTS:\n";
      context.specialized_components.forEach((comp, index) => {
        prompt += `${index + 1}. ${comp.component_type} (${(comp.similarity_score * 100).toFixed(1)}% relevant)\n`;
        prompt += `   ${comp.content_snippet}\n\n`;
      });
    }

    prompt += `
RESPONSE GUIDELINES:
1. Prioritize information from user's specific documents when available
2. Use knowledge base to provide expert context and best practices
3. Reference specialized components for technical details
4. Clearly indicate which sources inform your response
5. If context is limited, acknowledge this and provide general guidance
6. Always aim to be helpful, accurate, and actionable

Provide your response based on this comprehensive context.`;

    return prompt;
  }

  /**
   * Generate enhanced response using all context sources
   */
  private async generateEnhancedResponse(
    message: string,
    userId: string,
    conversationHistory: ChatMessage[],
    context: EnhancedContext,
    systemPrompt: string,
    uploadedFileContext?: any
  ): Promise<ChatResponse> {
    // Use the existing GPT assistant but with our enhanced system prompt
    const originalSystemPrompt = this.gptAssistant['systemPrompt'];
    
    // Temporarily override system prompt
    this.gptAssistant['systemPrompt'] = systemPrompt;
    
    try {
      const response = await this.gptAssistant.chat(
        message,
        userId,
        conversationHistory,
        uploadedFileContext
      );

      // Enhance the response metadata
      response.metadata.context_sources = context.total_context_sources;
      response.metadata.confidence_score = Math.max(
        response.metadata.confidence_score,
        context.context_quality_score
      );

      return response;
    } finally {
      // Restore original system prompt
      this.gptAssistant['systemPrompt'] = originalSystemPrompt;
    }
  }

  /**
   * Build context explanation for transparency
   */
  private buildContextExplanation(context: EnhancedContext): string {
    const explanations = [];

    if (context.user_documents.length > 0) {
      explanations.push(`${context.user_documents.length} of your uploaded documents`);
    }

    if (context.knowledge_base.length > 0) {
      explanations.push(`${context.knowledge_base.length} expert resources from Mozaik knowledge base`);
    }

    if (context.specialized_components.length > 0) {
      explanations.push(`${context.specialized_components.length} specialized components from your files`);
    }

    if (explanations.length === 0) {
      return "Response generated using general Mozaik expertise";
    }

    const baseExplanation = `Response generated using ${explanations.join(', ')}`;
    const qualityNote = context.context_quality_score > 0.8 
      ? " (high-quality context match)"
      : context.context_quality_score > 0.5 
        ? " (moderate context match)"
        : " (limited context match)";

    return baseExplanation + qualityNote;
  }

  /**
   * Assess knowledge coverage for the query
   */
  private assessKnowledgeCoverage(
    context: EnhancedContext,
    query: string
  ): {
    user_specific: boolean;
    general_knowledge: boolean;
    specialized_components: boolean;
    confidence_level: 'high' | 'medium' | 'low';
  } {
    const hasUserSpecific = context.user_documents.length > 0;
    const hasGeneralKnowledge = context.knowledge_base.length > 0;
    const hasSpecializedComponents = context.specialized_components.length > 0;
    
    let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
    
    if (context.context_quality_score > 0.8 && context.total_context_sources >= 3) {
      confidenceLevel = 'high';
    } else if (context.context_quality_score > 0.5 && context.total_context_sources >= 2) {
      confidenceLevel = 'medium';
    }

    return {
      user_specific: hasUserSpecific,
      general_knowledge: hasGeneralKnowledge,
      specialized_components: hasSpecializedComponents,
      confidence_level: confidenceLevel
    };
  }

  /**
   * Calculate overall context quality score
   */
  private calculateContextQuality(contextItems: Array<{ similarity_score: number }>): number {
    if (contextItems.length === 0) return 0;
    
    const avgSimilarity = contextItems.reduce((sum, item) => sum + item.similarity_score, 0) / contextItems.length;
    const sourceVariety = Math.min(contextItems.length / 5, 1); // Bonus for having multiple sources
    
    return Math.min(avgSimilarity + (sourceVariety * 0.2), 1.0);
  }

  /**
   * Determine if knowledge is scraped or curated
   */
  private determineKnowledgeSource(content: string): 'scraped_knowledge' | 'curated_knowledge' {
    // Simple heuristic - curated content tends to be more structured
    if (content.includes('Best practices:') || content.includes('Guidelines:') || content.includes('Common parameter types')) {
      return 'curated_knowledge';
    }
    return 'scraped_knowledge';
  }

  /**
   * Extract source platform from content
   */
  private extractSourcePlatform(content: string): string | undefined {
    if (content.includes('YouTube') || content.includes('video')) return 'YouTube';
    if (content.includes('forum') || content.includes('discussion')) return 'Community Forum';
    if (content.includes('documentation') || content.includes('guide')) return 'Documentation';
    if (content.includes('blog') || content.includes('article')) return 'Blog';
    return undefined;
  }

  /**
   * Extract component type from specialized content
   */
  private extractComponentType(content: string): string {
    if (content.includes('parameter')) return 'Parameters';
    if (content.includes('constraint')) return 'Constraints';
    if (content.includes('component')) return 'Components';
    return 'Technical Content';
  }
} 