export const PLANS = {
  free: { 
    model: 'gpt-4o-mini', 
    dailyLimit: 5, 
    monthlyLimit: 150, 
    fileUpload: false,
    name: 'Free',
    price: '$0',
    description: 'Basic answers with limited queries'
  },
  hobby: { 
    model: 'gpt-4o', 
    dailyLimit: 9999, 
    monthlyLimit: 100, 
    fileUpload: true,
    name: 'Hobbyist',
    price: '$9',
    description: 'Perfect for hobbyists and small projects'
  },
  occ: { 
    model: 'gpt-4o', 
    dailyLimit: 9999, 
    monthlyLimit: 300, 
    fileUpload: true,
    name: 'Occasional',
    price: '$20',
    description: 'For occasional professional use'
  },
  pro: { 
    model: 'gpt-4o', 
    dailyLimit: 9999, 
    monthlyLimit: 600, 
    fileUpload: true,
    name: 'Professional',
    price: '$29',
    description: 'For professional users and small businesses'
  },
  ent: { 
    model: 'gpt-4o', 
    dailyLimit: 9999, 
    monthlyLimit: 5000, 
    fileUpload: true,
    name: 'Enterprise',
    price: '$149',
    description: 'For large teams and enterprises'
  }
};

export const PLAN_TIERS = [
  { id: 'free', name: 'Free', price: '$0', queries: '5/day', model: '4o-mini', overage: 'N/A' },
  { id: 'hobby', name: 'Hobbyist', price: '$9', queries: '100/mo', model: '4o', overage: '$0.05/q' },
  { id: 'occ', name: 'Occasional', price: '$20', queries: '300/mo', model: '4o', overage: '$0.05/q' },
  { id: 'pro', name: 'Professional', price: '$29', queries: '600/mo', model: '4o', overage: '$0.05/q' },
  { id: 'ent', name: 'Enterprise', price: '$149', queries: '5,000/mo', model: '4o', overage: 'By agreement' }
]; 