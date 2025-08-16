// Canonicalization utility for normalizing questions
const STOP = new Set([
  'the', 'a', 'an', 'to', 'for', 'in', 'of', 'and', 'or', 'on', 'my', 'your', 'our', 
  'is', 'are', 'with', 'by', 'at', 'from', 'up', 'down', 'out', 'off', 'over', 'under',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'me', 'him', 'her', 'us', 'them', 'myself', 'yourself', 'himself', 'herself',
  'itself', 'ourselves', 'yourselves', 'themselves', 'what', 'when', 'where', 'who',
  'whom', 'which', 'whose', 'why', 'how', 'can', 'could', 'will', 'would', 'should',
  'may', 'might', 'must', 'shall', 'do', 'does', 'did', 'have', 'has', 'had', 'am',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'get', 'gets', 'got', 'getting'
]);

function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w && !STOP.has(w))
    .join('-');
}

function makeCanonicalId(question, platform, version) {
  const base = slugify(question || '');
  const plat = (platform || 'generic').toLowerCase();
  const ver = (version || '').toLowerCase();
  
  // Include platform; version can be optional in fallback
  return `${plat}:${base}${ver ? ':' + ver : ''}`;
}

function normalizeQuestion(question) {
  if (!question) return '';
  
  return question
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getQuestionKeywords(question) {
  const normalized = normalizeQuestion(question);
  return normalized
    .split(' ')
    .filter(word => word.length > 2 && !STOP.has(word))
    .slice(0, 10); // Limit to 10 keywords
}

function calculateSimilarity(question1, question2) {
  const keywords1 = new Set(getQuestionKeywords(question1));
  const keywords2 = new Set(getQuestionKeywords(question2));
  
  const intersection = new Set([...keywords1].filter(x => keywords2.has(x)));
  const union = new Set([...keywords1, ...keywords2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

function findSimilarQuestions(question, existingQuestions, threshold = 0.7) {
  return existingQuestions
    .map(q => ({
      question: q,
      similarity: calculateSimilarity(question, q)
    }))
    .filter(item => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}

// Platform-specific canonicalization
const PLATFORM_ALIASES = {
  'mozaik': ['mozaik', 'moz', 'cabinet', 'cab'],
  'vcarve': ['vcarve', 'vcarve pro', 'vcarve desktop', 'vcarve aspire'],
  'fusion360': ['fusion', 'fusion 360', 'autodesk fusion', 'fusion360'],
  'microvellum': ['microvellum', 'mv', 'cabinet vision'],
  'sketchup': ['sketchup', 'sketch up', 'google sketchup'],
  'solidworks': ['solidworks', 'solid works', 'sw'],
  'rhino': ['rhino', 'rhinoceros', 'rhino 3d'],
  'generic': ['generic', 'general', 'other']
};

function normalizePlatform(platform) {
  if (!platform) return 'generic';
  
  const normalized = platform.toLowerCase().trim();
  
  for (const [key, aliases] of Object.entries(PLATFORM_ALIASES)) {
    if (aliases.includes(normalized)) {
      return key;
    }
  }
  
  return 'generic';
}

function normalizeVersion(version) {
  if (!version) return null;
  
  // Remove common version prefixes and normalize
  return version
    .toLowerCase()
    .replace(/^(v|version|ver)\s*/i, '')
    .replace(/\s+/g, '')
    .trim();
}

export {
  slugify,
  makeCanonicalId,
  normalizeQuestion,
  getQuestionKeywords,
  calculateSimilarity,
  findSimilarQuestions,
  normalizePlatform,
  normalizeVersion,
  STOP
}; 