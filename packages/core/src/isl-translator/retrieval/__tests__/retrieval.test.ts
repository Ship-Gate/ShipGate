/**
 * Tests for ISL Template Retrieval
 */

import { describe, it, expect } from 'vitest';
import {
  retrieveTemplates,
  findBestTemplate,
  hasHighConfidenceMatch,
  filterTemplatesByTags,
  explainSelection,
  extractKeywords,
  identifyTags,
  calculateKeywordScore,
  calculateTagScore,
} from '../index.js';
import type { ISLTemplate, RetrievalContext } from '../retrievalTypes.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const mockTemplates: ISLTemplate[] = [
  {
    slug: 'oauth',
    name: 'OAuth Integration',
    description: 'OAuth2 social login with Google and GitHub providers',
    tags: ['auth', 'oauth', 'social', 'security'],
    keywords: ['authentication', 'login', 'social-login', 'google', 'github'],
    content: 'domain OAuth { ... }',
    complexity: 'moderate',
  },
  {
    slug: 'password-reset',
    name: 'Password Reset Flow',
    description: 'Secure password reset with email verification',
    tags: ['auth', 'password', 'email', 'security'],
    keywords: ['reset', 'forgot-password', 'verification'],
    content: 'domain PasswordReset { ... }',
    complexity: 'simple',
  },
  {
    slug: 'stripe-subscriptions',
    name: 'Stripe Subscriptions',
    description: 'Recurring billing and subscription management with Stripe',
    tags: ['payments', 'stripe', 'billing', 'subscriptions'],
    keywords: ['payment', 'recurring', 'checkout', 'plans'],
    content: 'domain StripeSubscriptions { ... }',
    complexity: 'complex',
  },
  {
    slug: 'user-profiles',
    name: 'User Profiles',
    description: 'User profile management with settings and preferences',
    tags: ['user-management', 'profiles', 'settings'],
    keywords: ['user', 'profile', 'account', 'preferences'],
    content: 'domain UserProfiles { ... }',
    complexity: 'moderate',
  },
  {
    slug: 'rbac',
    name: 'Role-Based Access Control',
    description: 'RBAC authorization with roles and permissions',
    tags: ['authorization', 'rbac', 'security', 'permissions'],
    keywords: ['role', 'permission', 'access', 'admin'],
    content: 'domain RBAC { ... }',
    complexity: 'complex',
  },
  {
    slug: 'rate-limiting',
    name: 'Rate Limiting',
    description: 'API rate limiting and throttling',
    tags: ['rate-limiting', 'security', 'api'],
    keywords: ['throttle', 'limit', 'requests'],
    content: 'domain RateLimiting { ... }',
    complexity: 'simple',
  },
];

// ============================================================================
// KEYWORD EXTRACTION TESTS
// ============================================================================

describe('extractKeywords', () => {
  it('extracts meaningful keywords from prompt', () => {
    const keywords = extractKeywords('Create a user authentication system');
    expect(keywords).toContain('authentication');
    expect(keywords).toContain('auth');
  });

  it('removes stop words', () => {
    const keywords = extractKeywords('I want to create a system with authentication');
    expect(keywords).not.toContain('want');
    expect(keywords).not.toContain('with');
    expect(keywords).not.toContain('create');
  });

  it('expands synonyms', () => {
    const keywords = extractKeywords('Implement login functionality');
    expect(keywords).toContain('login');
    expect(keywords).toContain('auth');
    expect(keywords).toContain('authentication');
  });

  it('handles payment-related keywords', () => {
    const keywords = extractKeywords('Add stripe billing');
    expect(keywords).toContain('stripe');
    expect(keywords).toContain('billing');
    expect(keywords).toContain('payment');
  });

  it('returns empty array for stop-word-only prompt', () => {
    const keywords = extractKeywords('a the is');
    expect(keywords).toHaveLength(0);
  });
});

// ============================================================================
// TAG IDENTIFICATION TESTS
// ============================================================================

describe('identifyTags', () => {
  it('identifies authentication tag from auth keywords', () => {
    const tags = identifyTags(['auth', 'login', 'password']);
    expect(tags).toContain('authentication');
  });

  it('identifies payment tags from billing keywords', () => {
    const tags = identifyTags(['payment', 'billing', 'subscription']);
    expect(tags).toContain('payments');
  });

  it('identifies security tag', () => {
    const tags = identifyTags(['auth', 'mfa', 'secure']);
    expect(tags).toContain('security');
  });

  it('returns empty for unrecognized keywords', () => {
    const tags = identifyTags(['xyz123', 'foobar']);
    expect(tags).toHaveLength(0);
  });
});

// ============================================================================
// KEYWORD SCORING TESTS
// ============================================================================

describe('calculateKeywordScore', () => {
  it('returns high score for exact keyword match', () => {
    const result = calculateKeywordScore(['oauth', 'login'], mockTemplates[0]!);
    expect(result.score).toBeGreaterThan(0.5);
    expect(result.matches).toContain('oauth');
  });

  it('returns zero for no matches', () => {
    const result = calculateKeywordScore(['xyz', 'foobar'], mockTemplates[0]!);
    expect(result.score).toBe(0);
    expect(result.matches).toHaveLength(0);
  });

  it('returns zero for empty keywords', () => {
    const result = calculateKeywordScore([], mockTemplates[0]!);
    expect(result.score).toBe(0);
  });
});

// ============================================================================
// TAG SCORING TESTS
// ============================================================================

describe('calculateTagScore', () => {
  it('returns high score for matching tags', () => {
    const result = calculateTagScore(['auth', 'security'], mockTemplates[0]!);
    expect(result.score).toBeGreaterThan(0.5);
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('returns neutral score for empty tags', () => {
    const result = calculateTagScore([], mockTemplates[0]!);
    expect(result.score).toBe(0.5);
  });

  it('returns low score for non-matching tags', () => {
    const result = calculateTagScore(['payments', 'billing'], mockTemplates[0]!);
    expect(result.score).toBeLessThan(0.5);
  });
});

// ============================================================================
// MAIN RETRIEVAL TESTS
// ============================================================================

describe('retrieveTemplates', () => {
  it('returns templates sorted by confidence', () => {
    const result = retrieveTemplates({
      prompt: 'Create OAuth login with Google',
      templates: mockTemplates,
    });

    expect(result.selected.length).toBeGreaterThan(0);
    expect(result.selected[0]!.template.slug).toBe('oauth');
  });

  it('respects maxResults limit', () => {
    const result = retrieveTemplates({
      prompt: 'Create authentication system',
      templates: mockTemplates,
      maxResults: 2,
    });

    expect(result.selected.length).toBeLessThanOrEqual(2);
  });

  it('respects minConfidence threshold', () => {
    const result = retrieveTemplates({
      prompt: 'Create authentication system',
      templates: mockTemplates,
      minConfidence: 0.5,
    });

    result.selected.forEach(s => {
      expect(s.confidence).toBeGreaterThanOrEqual(0.5);
    });
  });

  it('finds payment templates for billing prompts', () => {
    const result = retrieveTemplates({
      prompt: 'Add Stripe payment processing and subscriptions',
      templates: mockTemplates,
    });

    const topTemplate = result.selected[0];
    expect(topTemplate?.template.slug).toBe('stripe-subscriptions');
  });

  it('finds RBAC for permission prompts', () => {
    const result = retrieveTemplates({
      prompt: 'Implement role-based permissions for admin users',
      templates: mockTemplates,
    });

    const topTemplate = result.selected[0];
    expect(topTemplate?.template.slug).toBe('rbac');
  });

  it('handles empty prompt gracefully', () => {
    const result = retrieveTemplates({
      prompt: '',
      templates: mockTemplates,
    });

    expect(result.selected).toHaveLength(0);
    expect(result.metadata.warnings).toContain('Empty prompt provided');
  });

  it('handles empty templates gracefully', () => {
    const result = retrieveTemplates({
      prompt: 'Create something',
      templates: [],
    });

    expect(result.selected).toHaveLength(0);
    expect(result.metadata.warnings).toContain('No templates provided');
  });

  it('includes metadata in result', () => {
    const result = retrieveTemplates({
      prompt: 'Create OAuth login',
      templates: mockTemplates,
    });

    expect(result.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.metadata.extractedKeywords.length).toBeGreaterThan(0);
    expect(result.totalEvaluated).toBe(mockTemplates.length);
  });

  it('includes reasons for selection', () => {
    const result = retrieveTemplates({
      prompt: 'Create OAuth login',
      templates: mockTemplates,
    });

    const topResult = result.selected[0];
    expect(topResult?.reasons.length).toBeGreaterThan(0);
    expect(topResult?.reasons.some(r => r.type === 'keyword')).toBe(true);
  });
});

// ============================================================================
// CONTEXT-AWARE RETRIEVAL TESTS
// ============================================================================

describe('retrieveTemplates with context', () => {
  it('boosts payment templates when Stripe is in stack', () => {
    const context: RetrievalContext = {
      stack: {
        paymentProvider: 'stripe',
      },
    };

    const result = retrieveTemplates({
      prompt: 'Add payment processing',
      context,
      templates: mockTemplates,
    });

    const topTemplate = result.selected[0];
    expect(topTemplate?.template.slug).toBe('stripe-subscriptions');
    expect(topTemplate?.reasons.some(r => r.description.includes('Stripe'))).toBe(true);
  });

  it('considers user preferences for complexity', () => {
    const context: RetrievalContext = {
      preferences: {
        preferredComplexity: 'simple',
      },
    };

    const result = retrieveTemplates({
      prompt: 'Add password reset',
      context,
      templates: mockTemplates,
    });

    const topTemplate = result.selected[0];
    expect(topTemplate?.template.complexity).toBe('simple');
  });

  it('handles missing context gracefully', () => {
    const result = retrieveTemplates({
      prompt: 'Create authentication',
      context: undefined,
      templates: mockTemplates,
    });

    expect(result.selected.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// CONVENIENCE FUNCTION TESTS
// ============================================================================

describe('findBestTemplate', () => {
  it('returns single best matching template', () => {
    const result = findBestTemplate({
      prompt: 'Create OAuth login',
      templates: mockTemplates,
    });

    expect(result).not.toBeNull();
    expect(result?.template.slug).toBe('oauth');
  });

  it('returns null when no templates match', () => {
    const result = findBestTemplate({
      prompt: 'xyz foobar baz',
      templates: mockTemplates,
      minConfidence: 0.9,
    });

    expect(result).toBeNull();
  });
});

describe('hasHighConfidenceMatch', () => {
  it('returns true for good match', () => {
    const result = hasHighConfidenceMatch(
      {
        prompt: 'OAuth login with Google authentication',
        templates: mockTemplates,
      },
      0.4
    );

    expect(result).toBe(true);
  });

  it('returns false for poor match with high threshold', () => {
    const result = hasHighConfidenceMatch(
      {
        prompt: 'something unrelated xyz',
        templates: mockTemplates,
      },
      0.9
    );

    expect(result).toBe(false);
  });
});

describe('filterTemplatesByTags', () => {
  it('filters templates by required tags', () => {
    const filtered = filterTemplatesByTags(mockTemplates, ['auth']);
    
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(t => t.tags.includes('auth'))).toBe(true);
  });

  it('returns all templates for empty tags', () => {
    const filtered = filterTemplatesByTags(mockTemplates, []);
    expect(filtered).toEqual(mockTemplates);
  });

  it('returns empty for non-matching tags', () => {
    const filtered = filterTemplatesByTags(mockTemplates, ['nonexistent-tag']);
    expect(filtered).toHaveLength(0);
  });
});

describe('explainSelection', () => {
  it('generates human-readable explanation', () => {
    const result = retrieveTemplates({
      prompt: 'Create OAuth login',
      templates: mockTemplates,
    });

    const explanation = explainSelection(result.selected[0]!);

    expect(explanation).toContain('OAuth');
    expect(explanation).toContain('Confidence:');
    expect(explanation).toContain('Reasons:');
    expect(explanation).toContain('Score Breakdown:');
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('edge cases', () => {
  it('handles special characters in prompt', () => {
    const result = retrieveTemplates({
      prompt: 'Create @#$% OAuth!!! login???',
      templates: mockTemplates,
    });

    expect(result.selected.length).toBeGreaterThan(0);
    expect(result.selected[0]?.template.slug).toBe('oauth');
  });

  it('handles very long prompts', () => {
    const longPrompt = 'Create ' + 'OAuth login '.repeat(100);
    const result = retrieveTemplates({
      prompt: longPrompt,
      templates: mockTemplates,
    });

    expect(result.selected.length).toBeGreaterThan(0);
  });

  it('handles templates with missing optional fields', () => {
    const minimalTemplate: ISLTemplate = {
      slug: 'minimal',
      name: 'Minimal',
      description: 'A minimal template',
      tags: [],
      content: 'domain Minimal {}',
    };

    const result = retrieveTemplates({
      prompt: 'Create something',
      templates: [minimalTemplate],
    });

    expect(result.totalEvaluated).toBe(1);
  });
});
