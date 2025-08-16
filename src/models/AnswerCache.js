import mongoose from 'mongoose';

const AnswerCacheSchema = new mongoose.Schema({
  answer_id: { 
    type: String, 
    index: true, 
    unique: true 
  },
  canonical_id: { 
    type: String, 
    index: true 
  },
  platform: { 
    type: String, 
    index: true 
  },
  version: { 
    type: String, 
    default: null, 
    index: true 
  },
  answer_md: { 
    type: String, 
    required: true 
  },
  sources: [{ 
    type: String 
  }],
  popularity: { 
    type: Number, 
    default: 0, 
    index: true 
  },
  ups: { 
    type: Number, 
    default: 0 
  },
  downs: { 
    type: Number, 
    default: 0 
  },
  updated_at: { 
    type: Date, 
    default: Date.now 
  },
  published_url: { 
    type: String, 
    default: null 
  },
  // Additional fields for enhanced tracking
  model_used: {
    type: String,
    default: 'gpt-4o-mini'
  },
  tokens_used: {
    input: Number,
    output: Number,
    total: Number
  },
  processing_time: {
    type: Number,
    default: 0
  },
  quality_score: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String
  }],
  category: {
    type: String,
    default: 'general'
  },
  // User interaction tracking
  views: {
    type: Number,
    default: 0
  },
  shares: {
    type: Number,
    default: 0
  },
  // Metadata for SEO
  title: {
    type: String,
    default: null
  },
  description: {
    type: String,
    default: null
  },
  keywords: [{
    type: String
  }]
}, { 
  timestamps: true 
});

// Indexes for performance
AnswerCacheSchema.index({ canonical_id: 1, platform: 1, version: 1 });
AnswerCacheSchema.index({ popularity: -1 });
AnswerCacheSchema.index({ ups: -1 });
AnswerCacheSchema.index({ updated_at: -1 });
AnswerCacheSchema.index({ published_url: 1 });
AnswerCacheSchema.index({ category: 1, tags: 1 });

// Methods
AnswerCacheSchema.methods.incrementPopularity = function() {
  this.popularity += 1;
  this.views += 1;
  this.updated_at = new Date();
  return this.save();
};

AnswerCacheSchema.methods.addVote = function(vote) {
  if (vote === 'up') {
    this.ups += 1;
  } else if (vote === 'down') {
    this.downs += 1;
  }
  
  // Calculate quality score
  const total = this.ups + this.downs;
  if (total > 0) {
    this.quality_score = this.ups / total;
  }
  
  return this.save();
};

AnswerCacheSchema.methods.removeVote = function(vote) {
  if (vote === 'up') {
    this.ups = Math.max(0, this.ups - 1);
  } else if (vote === 'down') {
    this.downs = Math.max(0, this.downs - 1);
  }
  
  // Recalculate quality score
  const total = this.ups + this.downs;
  if (total > 0) {
    this.quality_score = this.ups / total;
  } else {
    this.quality_score = 0;
  }
  
  return this.save();
};

AnswerCacheSchema.methods.getVoteRatio = function() {
  const total = this.ups + this.downs;
  return total > 0 ? this.downs / total : 0;
};

AnswerCacheSchema.methods.isEligibleForPublishing = function() {
  const total = this.ups + this.downs;
  return (
    this.ups >= 3 &&
    this.getVoteRatio() <= 0.25 &&
    this.popularity >= 5
  );
};

AnswerCacheSchema.methods.generateTitle = function() {
  if (this.title) return this.title;
  
  // Generate title from canonical_id
  const parts = this.canonical_id.split(':');
  if (parts.length >= 2) {
    const question = parts[1].replace(/-/g, ' ');
    return question.charAt(0).toUpperCase() + question.slice(1);
  }
  
  return 'Moe Answer';
};

AnswerCacheSchema.methods.generateDescription = function() {
  if (this.description) return this.description;
  
  // Generate description from answer content
  const content = this.answer_md.replace(/[#*`]/g, '').trim();
  return content.length > 160 ? content.substring(0, 157) + '...' : content;
};

export default mongoose.model('AnswerCache', AnswerCacheSchema); 