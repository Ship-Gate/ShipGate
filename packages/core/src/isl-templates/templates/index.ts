/**
 * ISL Template Content Exports
 *
 * This file exports the raw ISL template content for each template.
 * Use these with the registry metadata for complete template handling.
 */

// Template file paths (relative to templates directory)
export const templateFiles = {
  // Authentication
  oauth: 'oauth.isl',
  'magic-link': 'magic-link.isl',
  'social-login': 'social-login.isl',
  'password-reset': 'password-reset.isl',
  'email-verification': 'email-verification.isl',
  'two-factor-auth': 'two-factor-auth.isl',

  // Authorization
  rbac: 'rbac.isl',
  'api-keys': 'api-keys.isl',
  sessions: 'sessions.isl',
  'jwt-tokens': 'jwt-tokens.isl',

  // Payments
  'stripe-subscriptions': 'stripe-subscriptions.isl',
  webhooks: 'webhooks.isl',

  // Data Management
  'file-uploads': 'file-uploads.isl',
  search: 'search.isl',
  pagination: 'pagination.isl',
  'data-export': 'data-export.isl',
  caching: 'caching.isl',

  // User Management
  'user-profiles': 'user-profiles.isl',
  teams: 'teams.isl',
  invitations: 'invitations.isl',
  onboarding: 'onboarding.isl',
  'account-deletion': 'account-deletion.isl',

  // Operations
  'rate-limiting': 'rate-limiting.isl',
  'audit-logs': 'audit-logs.isl',
  'feature-flags': 'feature-flags.isl',
  'ab-testing': 'ab-testing.isl',
  'multi-tenancy': 'multi-tenancy.isl',

  // Support
  notifications: 'notifications.isl',
  feedback: 'feedback.isl',
  'content-moderation': 'content-moderation.isl',
} as const;

export type TemplateSlug = keyof typeof templateFiles;

/**
 * List of all template slugs
 */
export const templateSlugs: TemplateSlug[] = Object.keys(templateFiles) as TemplateSlug[];

/**
 * Template categories with their slugs
 */
export const templatesByCategory = {
  authentication: [
    'oauth',
    'magic-link',
    'social-login',
    'password-reset',
    'email-verification',
    'two-factor-auth',
  ],
  authorization: ['rbac', 'api-keys', 'sessions', 'jwt-tokens'],
  payments: ['stripe-subscriptions', 'webhooks'],
  'data-management': ['file-uploads', 'search', 'pagination', 'data-export', 'caching'],
  'user-management': ['user-profiles', 'teams', 'invitations', 'onboarding', 'account-deletion'],
  operations: ['rate-limiting', 'audit-logs', 'feature-flags', 'ab-testing', 'multi-tenancy'],
  support: ['notifications', 'feedback', 'content-moderation'],
} as const;

/**
 * Get the filename for a template
 */
export function getTemplateFilename(slug: TemplateSlug): string {
  return templateFiles[slug];
}

/**
 * Check if a slug is a valid template
 */
export function isValidTemplateSlug(slug: string): slug is TemplateSlug {
  return slug in templateFiles;
}
