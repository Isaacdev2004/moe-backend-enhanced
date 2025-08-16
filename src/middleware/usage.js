import { PLANS } from '../config/plans.js';
import User from '../models/User.js';

export async function enforceCaps(req, res, next) {
  try {
    const userId = req.user?.userId || req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const plan = PLANS[user.plan];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const dayMs = 24 * 60 * 60 * 1000;
    
    // Reset daily usage if needed
    if (Date.now() > new Date(user.dailyResetAt).getTime() + dayMs) {
      await user.resetDailyUsage();
    }

    // Reset monthly usage if needed
    const now = new Date();
    if (!user.monthlyResetAt || now >= user.monthlyResetAt) {
      await user.resetMonthlyUsage();
    }

    // Check limits
    if (user.dailyUsed >= plan.dailyLimit || user.monthlyUsed >= plan.monthlyLimit) {
      return res.status(402).json({
        status: 'limit_reached',
        plan: user.plan,
        plan_name: plan.name,
        used: { 
          daily: user.dailyUsed, 
          monthly: user.monthlyUsed 
        },
        limit: { 
          daily: plan.dailyLimit, 
          monthly: plan.monthlyLimit 
        },
        upgrade_options: ['hobby', 'occ', 'pro', 'ent'],
        message: `You've reached your ${user.plan} plan limit. Upgrade to continue.`
      });
    }

    // Increment usage
    await user.incrementUsage();

    // Set request properties for downstream use
    req.modelToUse = plan.model;
    req.planFeatures = plan;
    req.userPlan = user.plan;
    req.userUsage = {
      daily: user.dailyUsed,
      monthly: user.monthlyUsed,
      total: user.totalQueries
    };

    next();
  } catch (error) {
    console.error('Usage caps middleware error:', error);
    return res.status(500).json({ 
      error: 'Usage tracking failed',
      message: 'An error occurred while checking usage limits'
    });
  }
}

export async function checkFileUploadAccess(req, res, next) {
  try {
    const userId = req.user?.userId || req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const plan = PLANS[user.plan];
    if (!plan.fileUpload) {
      return res.status(402).json({
        status: 'upgrade_required',
        feature: 'file_parsing',
        message: 'Upgrade to enable file parsing and diagnostics. Pro analyzes .cab, .cabx, .mzb, and .xml with a step-by-step fix plan.',
        upgrade_options: ['hobby', 'occ', 'pro', 'ent'],
        current_plan: user.plan
      });
    }

    next();
  } catch (error) {
    console.error('File upload access check error:', error);
    return res.status(500).json({ 
      error: 'Access check failed',
      message: 'An error occurred while checking file upload access'
    });
  }
}

export async function getUsageStats(req, res) {
  try {
    const userId = req.user?.userId || req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const plan = PLANS[user.plan];
    const stats = user.getUsageStats();

    res.json({
      plan: {
        current: user.plan,
        name: plan.name,
        price: plan.price,
        description: plan.description
      },
      usage: {
        daily: {
          used: stats.daily.used,
          limit: plan.dailyLimit,
          remaining: Math.max(0, plan.dailyLimit - stats.daily.used),
          resetAt: stats.daily.resetAt
        },
        monthly: {
          used: stats.monthly.used,
          limit: plan.monthlyLimit,
          remaining: Math.max(0, plan.monthlyLimit - stats.monthly.used),
          resetAt: stats.monthly.resetAt
        },
        total: stats.total
      },
      features: {
        fileUpload: plan.fileUpload,
        model: plan.model
      },
      lastActive: stats.lastActive
    });
  } catch (error) {
    console.error('Get usage stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get usage stats',
      message: 'An error occurred while retrieving usage information'
    });
  }
} 