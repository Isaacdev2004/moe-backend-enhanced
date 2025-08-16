import mongoose from 'mongoose';

const VoteSchema = new mongoose.Schema({
  user_id: { 
    type: String, 
    index: true 
  },
  answer_id: { 
    type: String, 
    index: true 
  },
  vote: { 
    type: String, 
    enum: ['up', 'down'], 
    required: true 
  },
  reason: { 
    type: String, 
    default: null 
  },
  notes: { 
    type: String, 
    default: null 
  },
  // Additional tracking fields
  ip_address: {
    type: String,
    default: null
  },
  user_agent: {
    type: String,
    default: null
  },
  session_id: {
    type: String,
    default: null
  }
}, { 
  timestamps: true 
});

// Compound index to ensure one vote per user per answer
VoteSchema.index({ user_id: 1, answer_id: 1 }, { unique: true });

// Indexes for analytics
VoteSchema.index({ vote: 1, createdAt: -1 });
VoteSchema.index({ answer_id: 1, vote: 1 });
VoteSchema.index({ user_id: 1, createdAt: -1 });

// Methods
VoteSchema.methods.toPublicJSON = function() {
  return {
    vote: this.vote,
    reason: this.reason,
    created_at: this.createdAt
  };
};

// Statics for analytics
VoteSchema.statics.getVoteStats = async function(answerId) {
  const stats = await this.aggregate([
    { $match: { answer_id: answerId } },
    {
      $group: {
        _id: '$vote',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = { ups: 0, downs: 0, total: 0 };
  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });

  return result;
};

VoteSchema.statics.getUserVoteHistory = async function(userId, limit = 50) {
  return this.find({ user_id: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('answer_id', 'canonical_id platform version')
    .lean();
};

VoteSchema.statics.getRecentVotes = async function(limit = 100) {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('answer_id', 'canonical_id platform version ups downs')
    .lean();
};

export default mongoose.model('Vote', VoteSchema); 