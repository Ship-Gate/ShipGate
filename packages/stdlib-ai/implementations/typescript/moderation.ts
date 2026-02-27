// ============================================================================
// ISL Standard Library - AI Moderation
// @isl-lang/stdlib-ai
// ============================================================================

import {
  type ModerateContentInput,
  type ModerateContentOutput,
  type ModerationScore,
  type ProviderConfig,
  ModerationCategory,
  AIError,
  AIErrorCode,
} from './types';

// ============================================================================
// Content Moderation
// ============================================================================

/**
 * Check content for safety violations
 */
export async function moderateContent(
  input: ModerateContentInput,
  _config?: ProviderConfig
): Promise<ModerateContentOutput> {
  // Validate input
  if (!input.text) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Text is required');
  }

  const categoriesToCheck = input.categories || Object.values(ModerationCategory);

  // This is a stub - real implementation would call moderation API
  const categories = {} as Record<ModerationCategory, ModerationScore>;

  for (const category of categoriesToCheck) {
    // Placeholder: all content is safe
    categories[category] = {
      flagged: false,
      score: Math.random() * 0.1, // Low scores (safe)
    };
  }

  // Check for any flagged categories
  const flagged = Object.values(categories).some(c => c.flagged);

  return {
    flagged,
    categories,
  };
}

/**
 * Check if text contains PII (Personally Identifiable Information)
 */
export async function detectPII(
  text: string,
  _config?: ProviderConfig
): Promise<{
  hasPII: boolean;
  detections: Array<{
    type: string;
    value: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}> {
  const detections: Array<{
    type: string;
    value: string;
    start: number;
    end: number;
    confidence: number;
  }> = [];

  // Simple regex-based detection (placeholder)
  const patterns: Record<string, RegExp> = {
    EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    PHONE: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
    CREDIT_CARD: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    IP_ADDRESS: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  };

  for (const [type, pattern] of Object.entries(patterns)) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      detections.push({
        type,
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.9,
      });
    }
  }

  return {
    hasPII: detections.length > 0,
    detections,
  };
}

/**
 * Redact PII from text
 */
export async function redactPII(
  text: string,
  options?: {
    replacement?: string;
    types?: string[];
  },
  _config?: ProviderConfig
): Promise<{
  redactedText: string;
  redactions: Array<{ type: string; original: string }>;
}> {
  const replacement = options?.replacement || '[REDACTED]';
  const piiResult = await detectPII(text);

  let redactedText = text;
  const redactions: Array<{ type: string; original: string }> = [];

  // Sort detections by position (descending) to replace from end to start
  const sortedDetections = [...piiResult.detections].sort((a, b) => b.start - a.start);

  for (const detection of sortedDetections) {
    if (options?.types && !options.types.includes(detection.type)) {
      continue;
    }
    redactedText =
      redactedText.slice(0, detection.start) +
      replacement +
      redactedText.slice(detection.end);
    redactions.push({
      type: detection.type,
      original: detection.value,
    });
  }

  return {
    redactedText,
    redactions,
  };
}

/**
 * Check text for toxicity
 */
export async function detectToxicity(
  _text: string,
  _config?: ProviderConfig
): Promise<{
  toxic: boolean;
  score: number;
  categories: Record<string, number>;
}> {
  // This is a stub - real implementation would call toxicity API
  const categories: Record<string, number> = {
    toxicity: Math.random() * 0.1,
    severe_toxicity: Math.random() * 0.05,
    obscene: Math.random() * 0.1,
    threat: Math.random() * 0.05,
    insult: Math.random() * 0.1,
    identity_attack: Math.random() * 0.05,
  };

  const maxScore = Math.max(...Object.values(categories));

  return {
    toxic: maxScore > 0.5,
    score: maxScore,
    categories,
  };
}

/**
 * Check if content is safe for a specific audience
 */
export async function checkAudienceSafety(
  text: string,
  audience: 'general' | 'teen' | 'adult',
  _config?: ProviderConfig
): Promise<{
  safe: boolean;
  rating: string;
  concerns: string[];
}> {
  const moderationResult = await moderateContent({ text });
  const concerns: string[] = [];

  // Check flagged categories
  for (const [category, score] of Object.entries(moderationResult.categories)) {
    if (score.flagged) {
      concerns.push(category);
    }
  }

  // Determine rating based on scores
  let rating: string;
  if (concerns.length === 0) {
    rating = 'G';
  } else if (concerns.includes(ModerationCategory.VIOLENCE) || concerns.includes(ModerationCategory.HATE)) {
    rating = 'R';
  } else {
    rating = 'PG-13';
  }

  // Check if safe for audience
  const safeForAudience =
    (audience === 'adult') ||
    (audience === 'teen' && !['R'].includes(rating)) ||
    (audience === 'general' && rating === 'G');

  return {
    safe: safeForAudience,
    rating,
    concerns,
  };
}

/**
 * Filter harmful content from text
 */
export async function filterHarmfulContent(
  text: string,
  options?: {
    categories?: ModerationCategory[];
    replacement?: string;
  },
  _config?: ProviderConfig
): Promise<{
  filteredText: string;
  filtered: boolean;
  reason?: string;
}> {
  const categories = options?.categories || Object.values(ModerationCategory);
  const replacement = options?.replacement || '[Content removed]';

  const moderationResult = await moderateContent({ text, categories });

  if (!moderationResult.flagged) {
    return {
      filteredText: text,
      filtered: false,
    };
  }

  // Find which categories were flagged
  const flaggedCategories = Object.entries(moderationResult.categories)
    .filter(([_, score]) => score.flagged)
    .map(([category]) => category);

  return {
    filteredText: replacement,
    filtered: true,
    reason: `Content flagged for: ${flaggedCategories.join(', ')}`,
  };
}

// ============================================================================
// Prompt Injection Detection
// ============================================================================

/**
 * Detect potential prompt injection attempts
 */
export async function detectPromptInjection(
  text: string,
  _config?: ProviderConfig
): Promise<{
  detected: boolean;
  confidence: number;
  indicators: string[];
}> {
  const indicators: string[] = [];

  // Simple heuristic-based detection (placeholder)
  const suspiciousPatterns = [
    { pattern: /ignore\s+(all\s+)?(previous|above)\s+instructions/i, name: 'instruction_override' },
    { pattern: /you\s+are\s+now\s+/i, name: 'role_hijacking' },
    { pattern: /system\s*:\s*/i, name: 'system_prompt_injection' },
    { pattern: /\[INST\]|\[\/INST\]/i, name: 'instruction_tags' },
    { pattern: /<\|.*?\|>/i, name: 'special_tokens' },
    { pattern: /```system|```assistant/i, name: 'code_block_injection' },
    { pattern: /do\s+not\s+follow\s+your\s+instructions/i, name: 'instruction_negation' },
    { pattern: /pretend\s+(you\s+are|to\s+be)/i, name: 'pretend_instruction' },
  ];

  for (const { pattern, name } of suspiciousPatterns) {
    if (pattern.test(text)) {
      indicators.push(name);
    }
  }

  const confidence = Math.min(1, indicators.length * 0.3);

  return {
    detected: indicators.length > 0,
    confidence,
    indicators,
  };
}

/**
 * Sanitize user input to prevent prompt injection
 */
export function sanitizeInput(text: string): string {
  // Remove or escape potentially dangerous patterns
  let sanitized = text;

  // Escape special instruction markers
  sanitized = sanitized.replace(/\[INST\]/gi, '[_INST_]');
  sanitized = sanitized.replace(/\[\/INST\]/gi, '[_/INST_]');
  sanitized = sanitized.replace(/<\|/g, '< |');
  sanitized = sanitized.replace(/\|>/g, '| >');

  // Remove system-like prompts
  sanitized = sanitized.replace(/^system\s*:/gim, 'user:');

  return sanitized;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  moderateContent,
  detectPII,
  redactPII,
  detectToxicity,
  checkAudienceSafety,
  filterHarmfulContent,
  detectPromptInjection,
  sanitizeInput,
};
