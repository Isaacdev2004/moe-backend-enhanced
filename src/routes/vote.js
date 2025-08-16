import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken } from './auth.js';
import AnswerCache from '../models/AnswerCache.js';
import Vote from '../models/Vote.js';

const router = express.Router();

// Validation middleware
const validateVote = [
  param('answer_id').isString().withMessage('Answer ID must be a string'),
  body('vote').isIn(['up', 'down']).withMessage('Vote must be up or down'),
  body('reason').optional().isString().withMessage('Reason must be a string'),
  body('notes').optional().isString().withMessage('Notes must be a string')
];

// Vote on an answer
router.post('/:answer_id/vote', authenticateToken, validateVote, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: errors.array()
      });
    }

    const user_id = req.user?.userId;
    const { answer_id } = req.params;
    const { vote, reason = null, notes = null } = req.body;

    console.log(`🗳️ Vote from user ${user_id} on answer ${answer_id}: ${vote}`);

    // Find the answer
    const answer = await AnswerCache.findOne({ answer_id });
    if (!answer) {
      return res.status(404).json({ 
        error: 'Answer not found',
        message: 'The specified answer does not exist'
      });
    }

    // Check for existing vote
    const existingVote = await Vote.findOne({ user_id, answer_id });

    if (existingVote) {
      // User is changing their vote
      if (existingVote.vote !== vote) {
        // Remove old vote
        await answer.removeVote(existingVote.vote);
        // Add new vote
        await answer.addVote(vote);
        
        // Update existing vote record
        existingVote.vote = vote;
        existingVote.reason = reason;
        existingVote.notes = notes;
        await existingVote.save();
      } else {
        // Same vote - just update reason/notes
        existingVote.reason = reason;
        existingVote.notes = notes;
        await existingVote.save();
      }
    } else {
      // New vote
      await Vote.create({ 
        user_id, 
        answer_id, 
        vote, 
        reason, 
        notes 
      });
      await answer.addVote(vote);
    }

    // Get updated answer stats
    await answer.save();

    res.json({
      message: 'Vote recorded successfully',
      answer_id,
      vote,
      score: {
        ups: answer.ups,
        downs: answer.downs,
        total: answer.ups + answer.downs,
        quality_score: answer.quality_score
      },
      user_vote: vote,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({
      error: 'Vote failed',
      message: 'An error occurred while recording your vote'
    });
  }
});

// Get vote statistics for an answer
router.get('/:answer_id/stats', async (req, res) => {
  try {
    const { answer_id } = req.params;

    const answer = await AnswerCache.findOne({ answer_id });
    if (!answer) {
      return res.status(404).json({ 
        error: 'Answer not found',
        message: 'The specified answer does not exist'
      });
    }

    const totalVotes = answer.ups + answer.downs;
    const voteRatio = totalVotes > 0 ? answer.downs / totalVotes : 0;
    const isEligibleForPublishing = answer.isEligibleForPublishing();

    res.json({
      answer_id,
      stats: {
        ups: answer.ups,
        downs: answer.downs,
        total_votes: totalVotes,
        quality_score: answer.quality_score,
        vote_ratio: voteRatio,
        popularity: answer.popularity,
        views: answer.views
      },
      publishing: {
        eligible: isEligibleForPublishing,
        published_url: answer.published_url,
        criteria_met: {
          min_ups: answer.ups >= 3,
          max_down_ratio: voteRatio <= 0.25,
          min_popularity: answer.popularity >= 5
        }
      },
      metadata: {
        created_at: answer.createdAt,
        updated_at: answer.updatedAt,
        model_used: answer.model_used,
        platform: answer.platform,
        version: answer.version
      }
    });

  } catch (error) {
    console.error('Get vote stats error:', error);
    res.status(500).json({
      error: 'Failed to get vote statistics',
      message: 'An error occurred while retrieving vote statistics'
    });
  }
});

// Get user's vote on an answer
router.get('/:answer_id/my-vote', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user?.userId;
    const { answer_id } = req.params;

    const vote = await Vote.findOne({ user_id, answer_id });
    
    res.json({
      answer_id,
      user_vote: vote ? {
        vote: vote.vote,
        reason: vote.reason,
        notes: vote.notes,
        created_at: vote.createdAt
      } : null
    });

  } catch (error) {
    console.error('Get user vote error:', error);
    res.status(500).json({
      error: 'Failed to get user vote',
      message: 'An error occurred while retrieving your vote'
    });
  }
});

// Get top voted answers
router.get('/top/:platform?', async (req, res) => {
  try {
    const { platform } = req.params;
    const { limit = 10, min_ups = 1 } = req.query;

    const query = { ups: { $gte: parseInt(min_ups) } };
    if (platform) {
      query.platform = platform;
    }

    const topAnswers = await AnswerCache.find(query)
      .sort({ ups: -1, popularity: -1 })
      .limit(parseInt(limit))
      .select('answer_id canonical_id platform version ups downs popularity quality_score published_url')
      .lean();

    res.json({
      message: 'Top voted answers retrieved successfully',
      answers: topAnswers.map(answer => ({
        answer_id: answer.answer_id,
        canonical_id: answer.canonical_id,
        platform: answer.platform,
        version: answer.version,
        stats: {
          ups: answer.ups,
          downs: answer.downs,
          total: answer.ups + answer.downs,
          quality_score: answer.quality_score,
          popularity: answer.popularity
        },
        published_url: answer.published_url
      })),
      filters: {
        platform: platform || 'all',
        min_ups: parseInt(min_ups),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get top answers error:', error);
    res.status(500).json({
      error: 'Failed to get top answers',
      message: 'An error occurred while retrieving top voted answers'
    });
  }
});

export default router; 