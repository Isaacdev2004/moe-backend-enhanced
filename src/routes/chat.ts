import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateToken, AuthenticatedRequest } from './auth.js';
import { RAGPipelineService } from '../services/RAGPipelineService.js';
import { VectorDBService } from '../services/VectorDBService.js';
import { EnhancedRAGService } from '../services/EnhancedRAGService.js';

const router = Router();
const ragPipeline = new RAGPipelineService();
const enhancedRAG = new EnhancedRAGService();
const vectorDB = new VectorDBService();

// Validation middleware
const validateChatMessage = [
  body('message')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be between 1 and 2000 characters'),
  body('session_id').optional().isUUID().withMessage('Session ID must be a valid UUID'),
  body('file_id').optional().isUUID().withMessage('File ID must be a valid UUID')
];

const validateFileAnalysis = [
  body('file_id').isString().withMessage('File ID is required'),
  body('analysis_query').optional().isLength({ max: 500 }).withMessage('Analysis query too long')
];

// Enhanced chat endpoint with comprehensive knowledge base integration
router.post('/enhanced-message', authenticateToken, validateChatMessage, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: errors.array()
      });
    }

    const { message, session_id, file_id } = req.body;
    const userId = req.user!.userId;

    console.log(`🧠 Enhanced chat message from user ${userId}: "${message}"`);

    // Get conversation history if session exists
    const conversationHistory = session_id 
      ? (await ragPipeline.getConversationHistory(userId)).find(conv => conv.id === session_id)?.messages || []
      : [];

    // Get uploaded file context if provided
    const fileContext = file_id 
      ? await getFileContext(file_id, userId)
      : undefined;

    // Process through enhanced RAG pipeline
    const enhancedResponse = await enhancedRAG.enhancedChat(
      message,
      userId,
      conversationHistory,
      fileContext
    );

    res.status(200).json({
      message: 'Enhanced response generated successfully',
      conversation: {
        session_id: session_id || generateNewSessionId(),
        user_message: {
          content: message,
          timestamp: new Date().toISOString()
        },
        assistant_response: enhancedResponse.response.message,
        context_explanation: enhancedResponse.context_explanation,
        knowledge_sources: {
          user_documents: enhancedResponse.enhanced_context.user_documents.length,
          knowledge_base: enhancedResponse.enhanced_context.knowledge_base.length,
          specialized_components: enhancedResponse.enhanced_context.specialized_components.length,
          total_sources: enhancedResponse.enhanced_context.total_context_sources
        }
      },
      knowledge_coverage: enhancedResponse.knowledge_coverage,
      context_details: {
        quality_score: enhancedResponse.enhanced_context.context_quality_score,
        sources_breakdown: {
          your_files: enhancedResponse.enhanced_context.user_documents.map(doc => ({
            title: doc.title,
            relevance: Math.round(doc.similarity_score * 100)
          })),
          knowledge_base: enhancedResponse.enhanced_context.knowledge_base.map(kb => ({
            title: kb.title,
            source: kb.source_platform || kb.source,
            relevance: Math.round(kb.similarity_score * 100)
          })),
          specialized_components: enhancedResponse.enhanced_context.specialized_components.map(comp => ({
            type: comp.component_type,
            relevance: Math.round(comp.similarity_score * 100)
          }))
        }
      },
      metadata: {
        processing_time: enhancedResponse.response.metadata.processing_time,
        tokens_used: enhancedResponse.response.metadata.tokens_used,
        confidence_level: enhancedResponse.knowledge_coverage.confidence_level,
        model_used: enhancedResponse.response.metadata.model_used
      }
    });

  } catch (error) {
    console.error('Enhanced chat error:', error);
    res.status(500).json({
      error: 'Enhanced chat processing failed',
      message: 'An error occurred while processing your message with enhanced context'
    });
  }
});

// Main chat endpoint - RAG-powered conversation
router.post('/message', authenticateToken, validateChatMessage, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: errors.array()
      });
    }

    const { message, session_id, file_id } = req.body;
    const userId = req.user!.userId;

    console.log(`💬 Chat message from user ${userId}: "${message}"`);

    // Process through RAG pipeline
    const response = await ragPipeline.processQuery(
      message,
      userId,
      session_id,
      file_id
    );

    res.status(200).json({
      message: 'Response generated successfully',
      conversation: {
        session_id: response.session_id,
        user_message: {
          content: message,
          timestamp: new Date().toISOString()
        },
        assistant_response: response.response.message,
        context: {
          sources_used: response.response.context.relevant_documents.length,
          confidence_score: response.response.metadata.confidence_score,
          model_used: response.response.metadata.model_used
        }
      },
      suggestions: response.follow_up_suggestions,
      related_documents: response.related_documents,
      metadata: {
        processing_time: response.response.metadata.processing_time,
        tokens_used: response.response.metadata.tokens_used,
        context_sources: response.response.metadata.context_sources
      }
    });

  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({
      error: 'Chat processing failed',
      message: 'An error occurred while processing your message'
    });
  }
});

// File analysis endpoint - Upload and get instant diagnostic
router.post('/analyze-file', authenticateToken, validateFileAnalysis, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: errors.array()
      });
    }

    const { file_id, analysis_query } = req.body;
    const userId = req.user!.userId;

    console.log(`🔍 File analysis request for file ${file_id}`);

    // Process file through RAG pipeline
    const analysis = await ragPipeline.processFileUpload(
      file_id,
      userId,
      analysis_query
    );

    res.status(200).json({
      message: 'File analysis completed successfully',
      file_analysis: {
        diagnostic: analysis.diagnostic,
        ai_response: analysis.initial_response.response.message,
        session_id: analysis.initial_response.session_id,
        recommendations: analysis.recommendations,
        context: {
          confidence_score: analysis.initial_response.response.metadata.confidence_score,
          sources_used: analysis.initial_response.response.context.relevant_documents.length
        }
      },
      follow_up_suggestions: analysis.initial_response.follow_up_suggestions,
      related_documents: analysis.initial_response.related_documents
    });

  } catch (error) {
    console.error('File analysis error:', error);
    res.status(500).json({
      error: 'File analysis failed',
      message: 'An error occurred while analyzing the file'
    });
  }
});

// Get conversation history
router.get('/conversations', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const conversations = await ragPipeline.getConversationHistory(userId);

    res.status(200).json({
      message: 'Conversation history retrieved successfully',
      conversations: conversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        message_count: conv.messages.length,
        context_summary: conv.context_summary,
        tokens_used: conv.total_tokens_used
      })),
      metadata: {
        total_conversations: conversations.length
      }
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      error: 'Failed to retrieve conversations',
      message: 'An error occurred while retrieving conversation history'
    });
  }
});

// Get specific conversation details
router.get('/conversations/:sessionId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user!.userId;

    // This would typically get from database - for now we'll return session info
    const conversations = await ragPipeline.getConversationHistory(userId);
    const conversation = conversations.find(conv => conv.id === sessionId);

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found',
        message: 'The requested conversation does not exist'
      });
    }

    res.status(200).json({
      message: 'Conversation details retrieved successfully',
      conversation: {
        id: conversation.id,
        title: conversation.title,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        messages: conversation.messages,
        context_summary: conversation.context_summary,
        total_tokens_used: conversation.total_tokens_used
      }
    });

  } catch (error) {
    console.error('Get conversation details error:', error);
    res.status(500).json({
      error: 'Failed to retrieve conversation',
      message: 'An error occurred while retrieving conversation details'
    });
  }
});

// Delete conversation
router.delete('/conversations/:sessionId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user!.userId;

    await ragPipeline.deleteSession(sessionId, userId);

    res.status(200).json({
      message: 'Conversation deleted successfully',
      session_id: sessionId
    });

  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      error: 'Failed to delete conversation',
      message: 'An error occurred while deleting the conversation'
    });
  }
});

// Get Mozaik-specific help
router.post('/mozaik-help', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { topic, context } = req.body;
    const userId = req.user!.userId;

    if (!topic) {
      return res.status(400).json({
        error: 'Topic is required',
        message: 'Please specify a Mozaik topic for help'
      });
    }

    // Create a specialized query for Mozaik help
    const helpQuery = `I need help with Mozaik ${topic}. ${context ? `Context: ${context}` : ''}`;

    const response = await ragPipeline.processQuery(helpQuery, userId);

    res.status(200).json({
      message: 'Mozaik help response generated successfully',
      help_response: {
        topic: topic,
        response: response.response.message.content,
        session_id: response.session_id,
        confidence_score: response.response.metadata.confidence_score
      },
      related_topics: response.follow_up_suggestions,
      related_documents: response.related_documents
    });

  } catch (error) {
    console.error('Mozaik help error:', error);
    res.status(500).json({
      error: 'Mozaik help failed',
      message: 'An error occurred while generating help response'
    });
  }
});

// Get chat statistics and insights
router.get('/statistics', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = ragPipeline.getStatistics();

    res.status(200).json({
      message: 'Chat statistics retrieved successfully',
      statistics: {
        ...stats,
        rag_features: {
          vector_search_enabled: true,
          gpt4_integration: true,
          context_injection: true,
          file_diagnostics: true,
          conversation_memory: true
        },
        capabilities: [
          'Semantic document search',
          'File diagnostic analysis',
          'Contextual responses',
          'Conversation continuity',
          'Mozaik-specific knowledge',
          'Multi-format file support'
        ]
      }
    });

  } catch (error) {
    console.error('Get chat statistics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      message: 'An error occurred while retrieving chat statistics'
    });
  }
});

// Quick diagnostic endpoint for immediate file feedback
router.post('/quick-diagnostic', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { file_id } = req.body;
    const userId = req.user!.userId;

    if (!file_id) {
      return res.status(400).json({
        error: 'File ID is required',
        message: 'Please provide a file ID for diagnostic analysis'
      });
    }

    // Get file document
    const document = await vectorDB.getDocument(file_id);
    if (!document || document.metadata.uploaded_by !== userId) {
      return res.status(404).json({
        error: 'File not found',
        message: 'The specified file does not exist or you do not have access'
      });
    }

    // Quick analysis without full RAG pipeline
    const fileContext = (document as any).specialized_data;
    const quickAnalysis = {
      file_type: fileContext?.file_type || document.metadata.file_type,
      status: fileContext?.broken_logic?.length > 0 ? 'Issues Found' : 'OK',
      issue_count: fileContext?.broken_logic?.length || 0,
      component_count: fileContext?.parts?.length || 0,
      parameter_count: fileContext?.parameters?.length || 0,
      constraint_count: fileContext?.constraints?.length || 0,
      quick_recommendations: [
        'Upload complete - file parsed successfully',
        fileContext?.broken_logic?.length > 0 
          ? 'Issues detected - run full analysis for details'
          : 'No critical issues found',
        'File ready for detailed analysis'
      ]
    };

    res.status(200).json({
      message: 'Quick diagnostic completed',
      diagnostic: quickAnalysis,
      next_steps: [
        'Run full analysis for detailed insights',
        'Ask specific questions about the file',
        'Compare with similar files in your library'
      ]
    });

  } catch (error) {
    console.error('Quick diagnostic error:', error);
    res.status(500).json({
      error: 'Quick diagnostic failed',
      message: 'An error occurred during quick diagnostic'
    });
  }
});

// Helper function to get file context
async function getFileContext(fileId: string, userId: string): Promise<any> {
  try {
    const document = await vectorDB.getDocument(fileId);
    if (!document || document.metadata.uploaded_by !== userId) {
      return null;
    }
    return (document as any).specialized_data;
  } catch (error) {
    console.error('Error getting file context:', error);
    return null;
  }
}

// Helper function to generate session ID
function generateNewSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Add enhanced capabilities endpoint
router.get('/capabilities', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.status(200).json({
      message: 'Chat capabilities retrieved successfully',
      capabilities: {
        enhanced_rag: {
          enabled: true,
          description: 'Comprehensive context retrieval from multiple sources',
          features: [
            'User document analysis',
            'Knowledge base integration', 
            'Specialized component search',
            'Multi-source context fusion',
            'Quality-scored responses'
          ]
        },
        knowledge_sources: {
          user_uploads: 'Your uploaded files and configurations',
          curated_knowledge: 'Expert Mozaik knowledge and best practices',
          scraped_content: 'Community discussions and tutorials',
          specialized_components: 'Technical component analysis'
        },
        response_quality: {
          context_injection: 'Real-time context retrieval and injection',
          confidence_scoring: 'Response quality assessment',
          source_transparency: 'Clear indication of information sources',
          conversational_memory: 'Context-aware multi-turn conversations'
        }
      },
      usage_tips: [
        'Ask about your specific uploaded files for personalized help',
        'Reference file names or component types for targeted assistance', 
        'Use follow-up questions to dive deeper into topics',
        'Ask for best practices to get expert recommendations',
        'Request troubleshooting help for specific error scenarios'
      ]
    });

  } catch (error) {
    console.error('Get capabilities error:', error);
    res.status(500).json({
      error: 'Failed to retrieve capabilities',
      message: 'An error occurred while retrieving chat capabilities'
    });
  }
});

export { router as chatRoutes }; 