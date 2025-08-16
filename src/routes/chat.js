import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from './auth.js';
import { enforceCaps } from '../middleware/usage.js';
import { PLANS } from '../config/plans.js';
import AnswerCache from '../models/AnswerCache.js';
import { makeCanonicalId, normalizePlatform, normalizeVersion } from '../utils/canonicalize.js';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Validation middleware
const validateChatMessage = [
  body('message')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be between 1 and 2000 characters'),
  body('platform').optional().isString().withMessage('Platform must be a string'),
  body('version').optional().isString().withMessage('Version must be a string'),
  body('session_id').optional().isString().withMessage('Session ID must be a string')
];

// Enhanced chat endpoint with caching and usage tracking
router.post('/message', authenticateToken, validateChatMessage, enforceCaps, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: errors.array()
      });
    }

    const { message: question, platform, version, session_id } = req.body;
    const userId = req.user?.userId;
    const model = req.modelToUse;
    const planFeatures = req.planFeatures;
    const userPlan = req.userPlan;

    console.log(`💬 Chat message from user ${userId} (${userPlan}): "${question}"`);

    // Normalize platform and version
    const normalizedPlatform = normalizePlatform(platform);
    const normalizedVersion = normalizeVersion(version);

    // Create canonical IDs for caching
    const canonicalVersioned = makeCanonicalId(question, normalizedPlatform, normalizedVersion);
    const canonicalUnversioned = makeCanonicalId(question, normalizedPlatform, null);

    // Check cache first (prefer exact version, then unversioned fallback)
    let cached = await AnswerCache.findOne({ canonical_id: canonicalVersioned }) ||
                 await AnswerCache.findOne({ canonical_id: canonicalUnversioned });

    if (cached) {
      // Cache hit - increment popularity and return cached answer
      await cached.incrementPopularity();
      
      const upgradeNotice = userPlan === 'free' ? {
        upgrade_blurb: 'Pro answers include Mozaik menu paths step-by-step, joinery and CNC checks, and install notes. Free answers are brief and generic. Upgrade to see the full walkthrough with exact settings.'
      } : null;

      return res.json({
        message: 'Response from cache',
        response: cached.answer_md,
        model_used: 'cache',
        answer_id: cached.answer_id,
        published_url: cached.published_url || null,
        sources: cached.sources || [],
        cache_info: {
          popularity: cached.popularity,
          ups: cached.ups,
          downs: cached.downs,
          quality_score: cached.quality_score
        },
        usage: req.userUsage,
        ...upgradeNotice
      });
    }

    // Cache miss - generate fresh answer
    const startTime = Date.now();
    
    // Build system prompt based on plan and platform
    const systemPrompt = userPlan === 'free' 
      ? `You are Moe, a helpful AI assistant specialized in Mozaik software. Provide concise, helpful responses. Keep answers brief and general for free tier users.`
      : `You are Moe, an expert AI assistant specialized in ${normalizedPlatform} software. Provide detailed, step-by-step answers with exact menu paths, technical specifications, and professional recommendations. Include joinery checks, CNC considerations, and installation notes where relevant.`;

    // Generate response using OpenAI
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      max_tokens: userPlan === 'free' ? 500 : 1500,
      temperature: 0.7
    });

    const response = completion.choices[0]?.message?.content || 'No response generated';
    const processingTime = Date.now() - startTime;

    // Save to cache for next time
    const answerId = uuidv4();
    const doc = await AnswerCache.create({
      answer_id: answerId,
      canonical_id: canonicalVersioned,
      platform: normalizedPlatform,
      version: normalizedVersion,
      answer_md: response,
      sources: [], // Will be populated by RAG pipeline
      popularity: 1,
      ups: 0,
      downs: 0,
      model_used: model,
      tokens_used: {
        input: completion.usage?.prompt_tokens || 0,
        output: completion.usage?.completion_tokens || 0,
        total: completion.usage?.total_tokens || 0
      },
      processing_time: processingTime,
      updated_at: new Date()
    });

    // Add upgrade notice for free tier
    const upgradeNotice = userPlan === 'free' ? {
      upgrade_blurb: 'Pro answers include Mozaik menu paths step-by-step, joinery and CNC checks, and install notes. Free answers are brief and generic. Upgrade to see the full walkthrough with exact settings.'
    } : null;

    res.json({
      message: 'Response generated successfully',
      response,
      model_used: model,
      answer_id: answerId,
      sources: [],
      usage: req.userUsage,
      processing_time: processingTime,
      tokens_used: {
        input: completion.usage?.prompt_tokens || 0,
        output: completion.usage?.completion_tokens || 0,
        total: completion.usage?.total_tokens || 0
      },
      ...upgradeNotice
    });

  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({
      error: 'Chat processing failed',
      message: 'An error occurred while processing your message',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    });
  }
});

// Simple chat endpoint (for testing)
router.post('/simple', authenticateToken, enforceCaps, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user?.userId;
    const model = req.modelToUse;
    const userPlan = req.userPlan;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Invalid message',
        message: 'Message is required and must be a string'
      });
    }

    console.log(`💬 Simple chat from user ${userId} (${userPlan}): "${message}"`);

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are Moe, a helpful AI assistant specialized in Mozaik software. Provide concise, helpful responses.'
        },
        {
          role: 'user', 
          content: message
        }
      ],
      max_tokens: userPlan === 'free' ? 500 : 1000,
      temperature: 0.7
    });

    const response = completion.choices[0]?.message?.content || 'No response generated';

    res.status(200).json({
      message: 'Simple chat response generated successfully',
      response: {
        content: response,
        model: completion.model,
        tokens_used: completion.usage?.total_tokens || 0
      },
      usage: req.userUsage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Simple chat error:', error);
    
    let errorMessage = 'Unknown error occurred';
    let errorType = 'unknown';
    
    if (error.message?.includes('API key')) {
      errorType = 'api_key';
      errorMessage = 'OpenAI API key is invalid or missing';
    } else if (error.message?.includes('quota')) {
      errorType = 'quota';
      errorMessage = 'OpenAI API quota exceeded';
    } else if (error.message?.includes('network') || error.code === 'ENOTFOUND') {
      errorType = 'network';
      errorMessage = 'Network connection to OpenAI failed';
    } else {
      errorMessage = error.message || 'OpenAI API call failed';
    }

    res.status(500).json({
      error: 'Simple chat failed',
      error_type: errorType,
      message: errorMessage,
      details: String(error)
    });
  }
});

// Get chat capabilities
router.get('/capabilities', authenticateToken, async (req, res) => {
  try {
    const userPlan = req.user?.plan || 'free';
    const plan = PLANS[userPlan];

    res.status(200).json({
      message: 'Chat capabilities retrieved successfully',
      capabilities: {
        plan: {
          current: userPlan,
          name: plan.name,
          model: plan.model,
          fileUpload: plan.fileUpload
        },
        features: {
          caching: true,
          quality_gates: true,
          source_tracking: true,
          version_awareness: true
        },
        limits: {
          daily: plan.dailyLimit,
          monthly: plan.monthlyLimit
        }
      },
      usage: req.userUsage || null
    });

  } catch (error) {
    console.error('Get capabilities error:', error);
    res.status(500).json({
      error: 'Failed to retrieve capabilities',
      message: 'An error occurred while retrieving chat capabilities'
    });
  }
});

export default router; 