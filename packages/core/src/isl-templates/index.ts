/**
 * ISL Template Library
 *
 * A comprehensive collection of 30 production-ready ISL templates
 * for common software patterns.
 *
 * @module @intentos/core/isl-templates
 */

// Export registry and types
export {
  templateRegistry,
  getTemplateBySlug,
  getTemplatesByTag,
  getTemplatesByCategory,
  searchTemplates,
  getAllTags,
  getAllCategories,
  getTemplateCounts,
  type TemplateMetadata,
  type TemplateQuestion,
  type TemplateCategory,
} from './registry';

// Export template file references
export {
  templateFiles,
  templateSlugs,
  templatesByCategory,
  getTemplateFilename,
  isValidTemplateSlug,
  type TemplateSlug,
} from './templates';

/**
 * Template Library Summary
 *
 * Total Templates: 30
 *
 * Categories:
 * - Authentication (6): oauth, magic-link, social-login, password-reset, email-verification, 2fa
 * - Authorization (4): rbac, api-keys, sessions, jwt-tokens
 * - Payments (2): stripe-subscriptions, webhooks
 * - Data Management (5): file-uploads, search, pagination, data-export, caching
 * - User Management (5): user-profiles, teams, invitations, onboarding, account-deletion
 * - Operations (5): rate-limiting, audit-logs, feature-flags, ab-testing, multi-tenancy
 * - Support (3): notifications, feedback, content-moderation
 */
