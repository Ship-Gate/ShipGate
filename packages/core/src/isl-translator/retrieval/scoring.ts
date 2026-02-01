/**
 * Deterministic scoring functions for ISL template retrieval
 *
 * Uses simple heuristics based on:
 * - Keyword matching (exact and partial)
 * - Tag matching (category alignment)
 * - Context signals (stack, preferences)
 */

import type {
  ISLTemplate,
  RetrievalContext,
  ScoreBreakdown,
  SelectionReason,
  ScoringWeights,
  DEFAULT_SCORING_WEIGHTS,
} from './retrievalTypes.js';

// ============================================================================
// KEYWORD EXTRACTION
// ============================================================================

/**
 * Common words to ignore during keyword extraction
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
  'that', 'this', 'these', 'those', 'it', 'its', 'i', 'me', 'my',
  'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them', 'their',
  'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
  'create', 'make', 'build', 'implement', 'add', 'want', 'need',
  'system', 'feature', 'function', 'using', 'use', 'please',
]);

/**
 * Domain-specific keyword mappings for better matching
 */
const KEYWORD_SYNONYMS: Record<string, string[]> = {
  'auth': ['authentication', 'login', 'signin', 'sign-in', 'authenticate'],
  'user': ['users', 'account', 'accounts', 'profile', 'profiles'],
  'payment': ['payments', 'billing', 'checkout', 'purchase', 'stripe', 'pay'],
  'subscription': ['subscriptions', 'recurring', 'plan', 'plans', 'tier'],
  'password': ['passwords', 'credential', 'credentials', 'reset'],
  'oauth': ['oauth2', 'social-login', 'google-auth', 'github-auth'],
  'rbac': ['role', 'roles', 'permission', 'permissions', 'access-control'],
  'api': ['api-key', 'api-keys', 'apikey', 'apikeys', 'token', 'tokens'],
  'webhook': ['webhooks', 'callback', 'callbacks', 'hook', 'hooks'],
  'upload': ['uploads', 'file', 'files', 'image', 'images', 'attachment'],
  'rate-limit': ['rate-limiting', 'throttle', 'throttling', 'limit'],
  'audit': ['audit-log', 'audit-logs', 'logging', 'trail'],
  'email': ['emails', 'mail', 'verification', 'verify'],
  'mfa': ['2fa', 'two-factor', 'totp', 'multi-factor', 'otp'],
  'session': ['sessions', 'jwt', 'token-auth'],
};

/**
 * Tag mappings for common categories
 */
const TAG_MAPPINGS: Record<string, string[]> = {
  'authentication': ['auth', 'login', 'signin', 'password', 'oauth', 'mfa', 'session'],
  'authorization': ['rbac', 'permission', 'role', 'access', 'api-key'],
  'payments': ['payment', 'billing', 'subscription', 'stripe', 'checkout'],
  'security': ['auth', 'mfa', '2fa', 'encryption', 'secure', 'audit'],
  'user-management': ['user', 'profile', 'account', 'settings'],
  'file-handling': ['upload', 'file', 'image', 'attachment', 'storage'],
  'notifications': ['email', 'notification', 'alert', 'webhook'],
  'crud': ['create', 'read', 'update', 'delete', 'manage'],
};

/**
 * Extract keywords from a text prompt
 */
export function extractKeywords(text: string): string[] {
  // Normalize text
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Split into words
  const words = normalized.split(' ');

  // Filter stop words and short words
  const keywords = words.filter(
    word => word.length > 2 && !STOP_WORDS.has(word)
  );

  // Expand synonyms
  const expanded = new Set<string>();
  for (const keyword of keywords) {
    expanded.add(keyword);
    // Check if this keyword is a synonym value
    for (const [canonical, synonyms] of Object.entries(KEYWORD_SYNONYMS)) {
      if (synonyms.includes(keyword) || keyword === canonical) {
        expanded.add(canonical);
        synonyms.forEach(s => expanded.add(s));
      }
    }
  }

  return Array.from(expanded);
}

/**
 * Identify relevant tags from keywords
 */
export function identifyTags(keywords: string[]): string[] {
  const tags = new Set<string>();

  for (const keyword of keywords) {
    for (const [tag, tagKeywords] of Object.entries(TAG_MAPPINGS)) {
      if (tagKeywords.some(tk => keyword.includes(tk) || tk.includes(keyword))) {
        tags.add(tag);
      }
    }
  }

  return Array.from(tags);
}

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Calculate keyword match score between prompt keywords and template
 */
export function calculateKeywordScore(
  promptKeywords: string[],
  template: ISLTemplate
): { score: number; matches: string[] } {
  if (promptKeywords.length === 0) {
    return { score: 0, matches: [] };
  }

  const templateKeywords = new Set<string>();

  // Add template keywords
  if (template.keywords) {
    template.keywords.forEach(k => templateKeywords.add(k.toLowerCase()));
  }

  // Add words from name and description
  const nameWords = template.name.toLowerCase().split(/[\s-]+/);
  const descWords = template.description.toLowerCase().split(/[\s-]+/);
  nameWords.forEach(w => templateKeywords.add(w));
  descWords.forEach(w => templateKeywords.add(w));

  // Add tags
  template.tags.forEach(t => templateKeywords.add(t.toLowerCase()));

  // Calculate matches
  const matches: string[] = [];
  for (const keyword of promptKeywords) {
    for (const templateKw of templateKeywords) {
      if (
        templateKw === keyword ||
        templateKw.includes(keyword) ||
        keyword.includes(templateKw)
      ) {
        matches.push(keyword);
        break;
      }
    }
  }

  // Score = matched / total prompt keywords
  const score = matches.length / promptKeywords.length;

  return {
    score: Math.min(score, 1.0),
    matches: [...new Set(matches)],
  };
}

/**
 * Calculate tag match score
 */
export function calculateTagScore(
  identifiedTags: string[],
  template: ISLTemplate
): { score: number; matches: string[] } {
  if (identifiedTags.length === 0) {
    return { score: 0.5, matches: [] }; // Neutral score if no tags identified
  }

  const templateTags = new Set(template.tags.map(t => t.toLowerCase()));
  const matches: string[] = [];

  for (const tag of identifiedTags) {
    if (templateTags.has(tag.toLowerCase())) {
      matches.push(tag);
    }
    // Check for partial matches
    for (const templateTag of templateTags) {
      if (
        templateTag.includes(tag.toLowerCase()) ||
        tag.toLowerCase().includes(templateTag)
      ) {
        matches.push(tag);
        break;
      }
    }
  }

  const score = matches.length / identifiedTags.length;

  return {
    score: Math.min(score, 1.0),
    matches: [...new Set(matches)],
  };
}

/**
 * Calculate context match score
 */
export function calculateContextScore(
  context: RetrievalContext | undefined,
  template: ISLTemplate
): { score: number; reasons: string[] } {
  if (!context) {
    return { score: 0.5, reasons: [] }; // Neutral score if no context
  }

  const reasons: string[] = [];
  let totalPoints = 0;
  let earnedPoints = 0;

  // Check stack alignment
  if (context.stack) {
    totalPoints += 2;

    // Payment provider match
    if (context.stack.paymentProvider && template.tags.includes('payments')) {
      if (
        context.stack.paymentProvider.toLowerCase() === 'stripe' &&
        (template.slug.includes('stripe') || template.name.toLowerCase().includes('stripe'))
      ) {
        earnedPoints += 1;
        reasons.push('Matches payment provider (Stripe)');
      }
    }

    // Auth provider match
    if (context.stack.authProvider && template.tags.includes('auth')) {
      earnedPoints += 0.5;
      reasons.push('Project uses authentication');
    }
  }

  // Check existing entities/behaviors
  if (context.existingEntities && context.existingEntities.length > 0) {
    totalPoints += 1;
    const templateContent = template.content.toLowerCase();
    for (const entity of context.existingEntities) {
      if (templateContent.includes(entity.toLowerCase())) {
        earnedPoints += 0.5;
        reasons.push(`Relates to existing entity: ${entity}`);
        break;
      }
    }
  }

  // Check requirements
  if (context.requirements && context.requirements.length > 0) {
    totalPoints += context.requirements.length;
    for (const req of context.requirements) {
      const reqLower = req.toLowerCase();
      if (
        template.tags.some(t => reqLower.includes(t)) ||
        template.description.toLowerCase().includes(reqLower)
      ) {
        earnedPoints += 1;
        reasons.push(`Matches requirement: ${req}`);
      }
    }
  }

  // Calculate score
  const score = totalPoints > 0 ? earnedPoints / totalPoints : 0.5;

  return {
    score: Math.min(score, 1.0),
    reasons,
  };
}

/**
 * Calculate preference match score
 */
export function calculatePreferenceScore(
  context: RetrievalContext | undefined,
  template: ISLTemplate
): { score: number; reasons: string[] } {
  if (!context?.preferences) {
    return { score: 0.5, reasons: [] }; // Neutral score if no preferences
  }

  const reasons: string[] = [];
  let totalChecks = 0;
  let matchedChecks = 0;

  const prefs = context.preferences;

  // Complexity preference
  if (prefs.preferredComplexity && template.complexity) {
    totalChecks++;
    if (prefs.preferredComplexity === template.complexity) {
      matchedChecks++;
      reasons.push(`Matches preferred complexity: ${template.complexity}`);
    }
  }

  // Audit logging preference
  if (prefs.includeAuditLogging !== undefined) {
    totalChecks++;
    const hasAudit =
      template.tags.includes('audit') ||
      template.content.toLowerCase().includes('audit');
    if (prefs.includeAuditLogging === hasAudit) {
      matchedChecks++;
      if (hasAudit) {
        reasons.push('Includes audit logging as preferred');
      }
    }
  }

  // Rate limiting preference
  if (prefs.includeRateLimiting !== undefined) {
    totalChecks++;
    const hasRateLimit =
      template.tags.includes('rate-limiting') ||
      template.content.toLowerCase().includes('rate_limit');
    if (prefs.includeRateLimiting === hasRateLimit) {
      matchedChecks++;
      if (hasRateLimit) {
        reasons.push('Includes rate limiting as preferred');
      }
    }
  }

  // Security preference
  if (prefs.includeSecurity !== undefined) {
    totalChecks++;
    const hasSecurity =
      template.tags.includes('security') ||
      template.content.toLowerCase().includes('security');
    if (prefs.includeSecurity === hasSecurity) {
      matchedChecks++;
      if (hasSecurity) {
        reasons.push('Includes security features as preferred');
      }
    }
  }

  const score = totalChecks > 0 ? matchedChecks / totalChecks : 0.5;

  return {
    score: Math.min(score, 1.0),
    reasons,
  };
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Score a template against the prompt and context
 */
export function scoreTemplate(
  template: ISLTemplate,
  promptKeywords: string[],
  identifiedTags: string[],
  context: RetrievalContext | undefined,
  weights: ScoringWeights
): { breakdown: ScoreBreakdown; reasons: SelectionReason[] } {
  const reasons: SelectionReason[] = [];

  // Calculate individual scores
  const keywordResult = calculateKeywordScore(promptKeywords, template);
  const tagResult = calculateTagScore(identifiedTags, template);
  const contextResult = calculateContextScore(context, template);
  const preferenceResult = calculatePreferenceScore(context, template);

  // Build reasons
  if (keywordResult.matches.length > 0) {
    reasons.push({
      type: 'keyword',
      description: `Matched keywords: ${keywordResult.matches.join(', ')}`,
      weight: weights.keyword,
    });
  }

  if (tagResult.matches.length > 0) {
    reasons.push({
      type: 'tag',
      description: `Matched tags: ${tagResult.matches.join(', ')}`,
      weight: weights.tag,
    });
  }

  for (const reason of contextResult.reasons) {
    reasons.push({
      type: 'context',
      description: reason,
      weight: weights.context,
    });
  }

  for (const reason of preferenceResult.reasons) {
    reasons.push({
      type: 'preference',
      description: reason,
      weight: weights.preference,
    });
  }

  // Calculate weighted total score
  const totalScore =
    keywordResult.score * weights.keyword +
    tagResult.score * weights.tag +
    contextResult.score * weights.context +
    preferenceResult.score * weights.preference;

  const breakdown: ScoreBreakdown = {
    keywordScore: keywordResult.score,
    tagScore: tagResult.score,
    contextScore: contextResult.score,
    preferenceScore: preferenceResult.score,
    totalScore: Math.min(totalScore, 1.0),
  };

  return { breakdown, reasons };
}

/**
 * Round score to 2 decimal places
 */
export function roundScore(score: number): number {
  return Math.round(score * 100) / 100;
}
