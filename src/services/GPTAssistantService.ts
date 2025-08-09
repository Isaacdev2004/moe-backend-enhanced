import OpenAI from 'openai';
import { VectorDBService } from './VectorDBService.js';
import { SearchFilters } from '../types/vector-db.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  context_used?: string[];
}

export interface ChatContext {
  relevant_documents: Array<{
    id: string;
    title: string;
    content_snippet: string;
    similarity_score: number;
    source_type: 'general' | 'specialized' | 'diagnostic';
  }>;
  mozaik_knowledge: Array<{
    topic: string;
    content: string;
    confidence: number;
  }>;
  file_diagnostics?: Array<{
    file_type: string;
    issues_found: string[];
    recommendations: string[];
  }>;
}

export interface ChatResponse {
  message: ChatMessage;
  context: ChatContext;
  metadata: {
    model_used: string;
    tokens_used: number;
    processing_time: number;
    context_sources: number;
    confidence_score: number;
  };
}

export class GPTAssistantService {
  private openai: OpenAI;
  private vectorDB: VectorDBService;
  private systemPrompt: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({ apiKey });
    this.vectorDB = new VectorDBService();
    
    this.systemPrompt = `You are Moe, an expert AI assistant specialized in Mozaik software and engineering diagnostics. You have access to a comprehensive knowledge base of Mozaik documentation, user discussions, technical specifications, and diagnostic data.

Your expertise includes:
- Mozaik software troubleshooting and optimization
- Analysis of .moz, .dat, .des, and .xml configuration files
- Component parameter validation and constraint checking
- Version compatibility and migration guidance
- Best practices for Mozaik implementations

When responding:
1. Always use the provided context to give accurate, specific answers
2. Reference specific documents or sources when available
3. For file diagnostics, provide actionable recommendations
4. If you're uncertain, clearly state limitations
5. Be helpful, concise, and technically accurate
6. Prioritize safety and proper engineering practices

Context will be provided with each query to help you give the most relevant response.`;
  }

  /**
   * Main chat method with RAG integration
   */
  async chat(
    message: string, 
    userId: string,
    conversationHistory: ChatMessage[] = [],
    uploadedFileContext?: any
  ): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      console.log(`Processing chat request from user ${userId}: "${message}"`);

      // Step 1: Retrieve relevant context using vector search
      const context = await this.retrieveContext(message, userId, uploadedFileContext);
      
      // Step 2: Build enhanced prompt with context
      const enhancedPrompt = this.buildContextualPrompt(message, context, uploadedFileContext);
      
      // Step 3: Prepare conversation history
      const messages = this.prepareMessages(enhancedPrompt, conversationHistory);
      
      // Step 4: Call GPT-4 with context
      const completion = await this.openai.chat.completions.create({
        model: process.env.GPT_MODEL || 'gpt-4o-mini',
        messages,
        max_tokens: 1500,
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const assistantMessage = completion.choices[0].message.content || '';
      const tokensUsed = completion.usage?.total_tokens || 0;

      // Step 5: Calculate confidence score based on context quality
      const confidenceScore = this.calculateConfidenceScore(context, assistantMessage);

      const response: ChatResponse = {
        message: {
          role: 'assistant',
          content: assistantMessage,
          timestamp: new Date().toISOString(),
          context_used: context.relevant_documents.map(doc => doc.id)
        },
        context,
        metadata: {
          model_used: process.env.GPT_MODEL || 'gpt-4o-mini',
          tokens_used: tokensUsed,
          processing_time: Date.now() - startTime,
          context_sources: context.relevant_documents.length,
          confidence_score: confidenceScore
        }
      };

      console.log(`✅ Chat response generated in ${response.metadata.processing_time}ms`);
      return response;

    } catch (error) {
      console.error('Error in GPT Assistant chat:', error);
      throw new Error(`Chat processing failed: ${error}`);
    }
  }

  /**
   * Retrieve relevant context for the user's query
   */
  private async retrieveContext(
    query: string, 
    userId: string, 
    uploadedFileContext?: any
  ): Promise<ChatContext> {
    try {
      // Search user's documents for relevant context
      const documentResults = await this.vectorDB.search(query, {}, 5);
      
      // Search specialized components if query seems technical
      const isFileQuery = this.isFileRelatedQuery(query);
      const specializedResults = isFileQuery 
        ? await this.vectorDB.searchSpecializedComponents(query, undefined, 3)
        : [];

      // Build Mozaik-specific knowledge context
      const mozaikKnowledge = await this.extractMozaikKnowledge(query);

      // Process file diagnostics if file context is provided
      const fileDiagnostics = uploadedFileContext 
        ? await this.generateFileDiagnostics(uploadedFileContext, query)
        : undefined;

      const context: ChatContext = {
        relevant_documents: [
          ...documentResults.map(result => ({
            id: result.document_id,
            title: result.metadata.filename,
            content_snippet: result.content_snippet,
            similarity_score: result.similarity_score,
            source_type: 'general' as const
          })),
          ...specializedResults.map(result => ({
            id: result.document_id,
            title: result.metadata.filename || 'Specialized Component',
            content_snippet: result.content_snippet,
            similarity_score: result.similarity_score,
            source_type: 'specialized' as const
          }))
        ],
        mozaik_knowledge: mozaikKnowledge,
        file_diagnostics: fileDiagnostics
      };

      return context;
    } catch (error) {
      console.error('Error retrieving context:', error);
      return {
        relevant_documents: [],
        mozaik_knowledge: [],
        file_diagnostics: undefined
      };
    }
  }

  /**
   * Build contextual prompt with retrieved information
   */
  private buildContextualPrompt(
    userQuery: string, 
    context: ChatContext, 
    uploadedFileContext?: any
  ): string {
    let prompt = `User Query: "${userQuery}"\n\n`;

    // Add relevant documents context
    if (context.relevant_documents.length > 0) {
      prompt += "RELEVANT DOCUMENTS:\n";
      context.relevant_documents.forEach((doc, index) => {
        prompt += `${index + 1}. "${doc.title}" (relevance: ${(doc.similarity_score * 100).toFixed(1)}%)\n`;
        prompt += `   ${doc.content_snippet}\n\n`;
      });
    }

    // Add Mozaik knowledge context
    if (context.mozaik_knowledge.length > 0) {
      prompt += "MOZAIK KNOWLEDGE BASE:\n";
      context.mozaik_knowledge.forEach((knowledge, index) => {
        prompt += `${index + 1}. ${knowledge.topic}: ${knowledge.content}\n`;
      });
      prompt += "\n";
    }

    // Add file diagnostics if available
    if (context.file_diagnostics && context.file_diagnostics.length > 0) {
      prompt += "FILE DIAGNOSTICS:\n";
      context.file_diagnostics.forEach((diag, index) => {
        prompt += `${index + 1}. ${diag.file_type} Analysis:\n`;
        prompt += `   Issues: ${diag.issues_found.join(', ')}\n`;
        prompt += `   Recommendations: ${diag.recommendations.join(', ')}\n`;
      });
      prompt += "\n";
    }

    // Add uploaded file context
    if (uploadedFileContext) {
      prompt += "UPLOADED FILE CONTEXT:\n";
      prompt += `File Type: ${uploadedFileContext.file_type}\n`;
      if (uploadedFileContext.parts) {
        prompt += `Components Found: ${uploadedFileContext.parts.length} parts\n`;
      }
      if (uploadedFileContext.broken_logic) {
        prompt += `Issues Detected: ${uploadedFileContext.broken_logic.length} potential problems\n`;
      }
      prompt += "\n";
    }

    prompt += "Please provide a helpful, accurate response based on the above context and your Mozaik expertise.";

    return prompt;
  }

  /**
   * Prepare messages for GPT-4 API
   */
  private prepareMessages(
    enhancedPrompt: string, 
    conversationHistory: ChatMessage[]
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: this.systemPrompt }
    ];

    // Add recent conversation history (last 10 messages)
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    // Add the current query with context
    messages.push({
      role: 'user',
      content: enhancedPrompt
    });

    return messages;
  }

  /**
   * Extract Mozaik-specific knowledge for the query
   */
  private async extractMozaikKnowledge(query: string): Promise<Array<{
    topic: string;
    content: string;
    confidence: number;
  }>> {
    // This would typically query a specialized Mozaik knowledge base
    // For now, we'll return some common Mozaik knowledge patterns
    const mozaikKeywords = [
      'mozaik', 'component', 'parameter', 'constraint', 'version',
      'configuration', 'optimization', 'troubleshooting', 'diagnostic'
    ];

    const queryLower = query.toLowerCase();
    const relevantKnowledge = [];

    if (mozaikKeywords.some(keyword => queryLower.includes(keyword))) {
      // Simulated knowledge base entries - in production this would be real data
      relevantKnowledge.push({
        topic: 'Mozaik Component Validation',
        content: 'Components should be validated for parameter completeness and constraint satisfaction before deployment.',
        confidence: 0.8
      });

      if (queryLower.includes('parameter')) {
        relevantKnowledge.push({
          topic: 'Parameter Configuration',
          content: 'Parameters must specify type, default values, and validation rules. Missing required parameters cause runtime errors.',
          confidence: 0.9
        });
      }

      if (queryLower.includes('error') || queryLower.includes('issue')) {
        relevantKnowledge.push({
          topic: 'Common Issues',
          content: 'Most Mozaik issues stem from version mismatches, missing parameters, or invalid constraint definitions.',
          confidence: 0.85
        });
      }
    }

    return relevantKnowledge;
  }

  /**
   * Generate file diagnostics for uploaded files
   */
  private async generateFileDiagnostics(
    fileContext: any, 
    query: string
  ): Promise<Array<{
    file_type: string;
    issues_found: string[];
    recommendations: string[];
  }>> {
    const diagnostics = [];

    if (fileContext.broken_logic && fileContext.broken_logic.length > 0) {
      const issues = fileContext.broken_logic.map((issue: any) => issue.description || 'Unknown issue');
      const recommendations = fileContext.broken_logic.map((issue: any) => 
        issue.suggested_fix || 'Review configuration for errors'
      );

      diagnostics.push({
        file_type: fileContext.file_type || 'Unknown',
        issues_found: issues,
        recommendations: recommendations
      });
    } else {
      diagnostics.push({
        file_type: fileContext.file_type || 'Unknown',
        issues_found: ['No critical issues detected'],
        recommendations: ['File appears to be properly configured']
      });
    }

    return diagnostics;
  }

  /**
   * Check if query is related to file analysis
   */
  private isFileRelatedQuery(query: string): boolean {
    const fileKeywords = [
      'file', 'upload', 'analyze', 'diagnostic', 'parameter', 'component',
      'constraint', 'error', 'issue', 'troubleshoot', '.moz', '.dat', '.des'
    ];

    return fileKeywords.some(keyword => 
      query.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * Calculate confidence score based on context quality
   */
  private calculateConfidenceScore(context: ChatContext, response: string): number {
    let score = 0.5; // Base score

    // Higher score if we have relevant documents
    if (context.relevant_documents.length > 0) {
      const avgSimilarity = context.relevant_documents.reduce(
        (sum, doc) => sum + doc.similarity_score, 0
      ) / context.relevant_documents.length;
      score += avgSimilarity * 0.3;
    }

    // Higher score if we have Mozaik knowledge
    if (context.mozaik_knowledge.length > 0) {
      score += 0.2;
    }

    // Higher score if we have file diagnostics
    if (context.file_diagnostics && context.file_diagnostics.length > 0) {
      score += 0.2;
    }

    // Response quality indicators
    if (response.length > 100) score += 0.1; // Detailed response
    if (response.includes('based on') || response.includes('according to')) score += 0.1; // Uses context

    return Math.min(score, 1.0);
  }

  /**
   * Generate diagnostic summary for uploaded file
   */
  async generateFileDiagnostic(
    fileContext: any, 
    userId: string
  ): Promise<{
    summary: string;
    issues: Array<{ severity: string; description: string; solution: string }>;
    recommendations: string[];
    compatibility_check: { status: string; details: string };
  }> {
    try {
      const diagnosticPrompt = `Analyze this Mozaik file and provide a comprehensive diagnostic report:

File Type: ${fileContext.file_type}
Components: ${fileContext.parts?.length || 0} parts found
Parameters: ${fileContext.parameters?.length || 0} parameters
Constraints: ${fileContext.constraints?.length || 0} constraints
Detected Issues: ${fileContext.broken_logic?.length || 0} problems

Please provide:
1. Overall file health summary
2. Specific issues with severity levels
3. Actionable recommendations
4. Compatibility assessment`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: diagnosticPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.3
      });

      const analysis = completion.choices[0].message.content || '';

      // Parse the AI response and structure it
      return {
        summary: `File contains ${fileContext.parts?.length || 0} components with ${fileContext.broken_logic?.length || 0} detected issues.`,
        issues: fileContext.broken_logic?.map((issue: any) => ({
          severity: issue.severity || 'medium',
          description: issue.description || 'Configuration issue detected',
          solution: issue.suggested_fix || 'Review and correct configuration'
        })) || [],
        recommendations: [
          'Validate all parameter types and values',
          'Check constraint definitions for completeness',
          'Ensure version compatibility',
          'Test configuration in development environment'
        ],
        compatibility_check: {
          status: fileContext.broken_logic?.length > 0 ? 'Issues Found' : 'Compatible',
          details: analysis
        }
      };

    } catch (error) {
      console.error('Error generating file diagnostic:', error);
      throw new Error(`Diagnostic generation failed: ${error}`);
    }
  }
} 