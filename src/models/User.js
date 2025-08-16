import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  plan: {
    type: String,
    enum: ['free', 'hobby', 'occ', 'pro', 'ent'],
    default: 'free'
  },
  monthlyUsed: {
    type: Number,
    default: 0
  },
  monthlyResetAt: {
    type: Date,
    default: () => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1))
  },
  dailyUsed: {
    type: Number,
    default: 0
  },
  dailyResetAt: {
    type: Date,
    default: Date.now
  },
  fingerprintHashes: {
    type: [String],
    default: []
  },
  // Additional fields for enhanced tracking
  totalQueries: {
    type: Number,
    default: 0
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'cancelled', 'past_due'],
    default: 'active'
  },
  stripeCustomerId: {
    type: String,
    default: null
  },
  stripeSubscriptionId: {
    type: String,
    default: null
  },
  // Device and usage tracking
  devices: [{
    fingerprintHash: String,
    userAgent: String,
    ipAddress: String,
    lastUsed: Date
  }],
  // Usage analytics
  usageHistory: [{
    date: Date,
    queries: Number,
    model: String,
    tokensUsed: Number
  }]
}, {
  timestamps: true
});

// Indexes for performance
UserSchema.index({ email: 1 });
UserSchema.index({ plan: 1 });
UserSchema.index({ monthlyResetAt: 1 });
UserSchema.index({ dailyResetAt: 1 });
UserSchema.index({ 'devices.fingerprintHash': 1 });

// Methods
UserSchema.methods.resetDailyUsage = function() {
  this.dailyUsed = 0;
  this.dailyResetAt = Date.now();
  return this.save();
};

UserSchema.methods.resetMonthlyUsage = function() {
  this.monthlyUsed = 0;
  const now = new Date();
  const nextUtcMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  this.monthlyResetAt = nextUtcMonth;
  return this.save();
};

UserSchema.methods.incrementUsage = function() {
  this.dailyUsed += 1;
  this.monthlyUsed += 1;
  this.totalQueries += 1;
  this.lastActive = Date.now();
  return this.save();
};

UserSchema.methods.addDevice = function(fingerprintHash, userAgent, ipAddress) {
  const existingDevice = this.devices.find(d => d.fingerprintHash === fingerprintHash);
  if (existingDevice) {
    existingDevice.lastUsed = Date.now();
    existingDevice.userAgent = userAgent;
    existingDevice.ipAddress = ipAddress;
  } else {
    this.devices.push({
      fingerprintHash,
      userAgent,
      ipAddress,
      lastUsed: Date.now()
    });
  }
  return this.save();
};

UserSchema.methods.getUsageStats = function() {
  return {
    daily: {
      used: this.dailyUsed,
      resetAt: this.dailyResetAt
    },
    monthly: {
      used: this.monthlyUsed,
      resetAt: this.monthlyResetAt
    },
    total: this.totalQueries,
    lastActive: this.lastActive
  };
};

export default mongoose.model('User', UserSchema); 