/**
 * ISL Template Registry
 *
 * Complete registry of 30 production-ready ISL templates with metadata,
 * tags, and required questions for customization.
 */

export interface TemplateQuestion {
  id: string;
  question: string;
  type: 'text' | 'select' | 'multiselect' | 'boolean' | 'number';
  required: boolean;
  default?: string | number | boolean;
  options?: string[];
  placeholder?: string;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
}

export interface TemplateMetadata {
  slug: string;
  name: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  questions: TemplateQuestion[];
  dependencies?: string[];
  version: string;
  author?: string;
}

export type TemplateCategory =
  | 'authentication'
  | 'authorization'
  | 'payments'
  | 'data-management'
  | 'user-management'
  | 'operations'
  | 'support'
  | 'infrastructure';

/**
 * Complete template registry with all 30 templates
 */
export const templateRegistry: TemplateMetadata[] = [
  // ============================================
  // Authentication Templates
  // ============================================
  {
    slug: 'oauth',
    name: 'OAuth 2.0 Authorization',
    description: 'Complete OAuth 2.0 implementation with Authorization Code, PKCE, and Refresh Token flows',
    category: 'authentication',
    tags: ['auth', 'oauth', 'authorization', 'tokens', 'pkce'],
    version: '1.0.0',
    questions: [
      {
        id: 'token_expiry',
        question: 'Access token expiry time (in seconds)',
        type: 'number',
        required: false,
        default: 3600,
        validation: { min: 60, max: 86400 },
      },
      {
        id: 'refresh_token_enabled',
        question: 'Enable refresh tokens?',
        type: 'boolean',
        required: false,
        default: true,
      },
      {
        id: 'pkce_required',
        question: 'Require PKCE for public clients?',
        type: 'boolean',
        required: false,
        default: true,
      },
    ],
  },
  {
    slug: 'magic-link',
    name: 'Magic Link Authentication',
    description: 'Passwordless authentication via email magic links',
    category: 'authentication',
    tags: ['auth', 'passwordless', 'magic-link', 'email'],
    version: '1.0.0',
    questions: [
      {
        id: 'link_expiry_minutes',
        question: 'Magic link expiry time (in minutes)',
        type: 'number',
        required: false,
        default: 15,
        validation: { min: 5, max: 60 },
      },
      {
        id: 'allow_registration',
        question: 'Allow new user registration via magic link?',
        type: 'boolean',
        required: false,
        default: true,
      },
    ],
  },
  {
    slug: 'social-login',
    name: 'Social Login (SSO)',
    description: 'OAuth-based social login with multiple providers (Google, GitHub, Apple, etc.)',
    category: 'authentication',
    tags: ['auth', 'sso', 'social', 'oauth', 'google', 'github', 'apple'],
    version: '1.0.0',
    questions: [
      {
        id: 'providers',
        question: 'Which social providers do you want to support?',
        type: 'multiselect',
        required: true,
        options: ['google', 'github', 'apple', 'facebook', 'microsoft', 'twitter', 'linkedin', 'discord', 'slack'],
      },
      {
        id: 'allow_account_linking',
        question: 'Allow linking social accounts to existing users?',
        type: 'boolean',
        required: false,
        default: true,
      },
    ],
  },
  {
    slug: 'password-reset',
    name: 'Password Reset',
    description: 'Secure password reset flow with token management',
    category: 'authentication',
    tags: ['auth', 'password', 'reset', 'security'],
    version: '1.0.0',
    questions: [
      {
        id: 'token_expiry_hours',
        question: 'Reset token expiry time (in hours)',
        type: 'number',
        required: false,
        default: 1,
        validation: { min: 1, max: 24 },
      },
      {
        id: 'password_history_count',
        question: 'Number of previous passwords to check against',
        type: 'number',
        required: false,
        default: 5,
        validation: { min: 0, max: 20 },
      },
    ],
  },
  {
    slug: 'email-verification',
    name: 'Email Verification',
    description: 'Complete email verification flow with token management',
    category: 'authentication',
    tags: ['auth', 'email', 'verification', 'onboarding'],
    version: '1.0.0',
    questions: [
      {
        id: 'verification_expiry_hours',
        question: 'Verification token expiry (in hours)',
        type: 'number',
        required: false,
        default: 24,
        validation: { min: 1, max: 168 },
      },
      {
        id: 'use_6_digit_code',
        question: 'Use 6-digit code instead of link?',
        type: 'boolean',
        required: false,
        default: false,
      },
    ],
  },
  {
    slug: 'two-factor-auth',
    name: 'Two-Factor Authentication (2FA)',
    description: 'Complete 2FA implementation with TOTP, SMS, and backup codes',
    category: 'authentication',
    tags: ['auth', '2fa', 'mfa', 'totp', 'security'],
    version: '1.0.0',
    questions: [
      {
        id: 'methods',
        question: 'Which 2FA methods do you want to support?',
        type: 'multiselect',
        required: true,
        options: ['totp', 'sms', 'email', 'push', 'hardware'],
      },
      {
        id: 'backup_codes_count',
        question: 'Number of backup codes to generate',
        type: 'number',
        required: false,
        default: 10,
        validation: { min: 5, max: 20 },
      },
    ],
  },

  // ============================================
  // Authorization Templates
  // ============================================
  {
    slug: 'rbac',
    name: 'Role-Based Access Control',
    description: 'Complete RBAC implementation with roles, permissions, and resource-level access',
    category: 'authorization',
    tags: ['auth', 'rbac', 'permissions', 'roles', 'access-control'],
    version: '1.0.0',
    questions: [
      {
        id: 'default_roles',
        question: 'What default roles do you need?',
        type: 'multiselect',
        required: true,
        options: ['admin', 'editor', 'viewer', 'member', 'guest', 'billing'],
      },
      {
        id: 'resource_scoped',
        question: 'Enable resource-scoped permissions?',
        type: 'boolean',
        required: false,
        default: true,
      },
    ],
  },
  {
    slug: 'api-keys',
    name: 'API Key Management',
    description: 'Complete API key lifecycle with scopes and usage tracking',
    category: 'authorization',
    tags: ['api', 'keys', 'authentication', 'tokens', 'access'],
    version: '1.0.0',
    questions: [
      {
        id: 'key_prefix',
        question: 'API key prefix (e.g., "sk_")',
        type: 'text',
        required: false,
        default: 'sk_',
        placeholder: 'sk_',
      },
      {
        id: 'max_keys_per_user',
        question: 'Maximum API keys per user',
        type: 'number',
        required: false,
        default: 10,
        validation: { min: 1, max: 100 },
      },
      {
        id: 'track_usage',
        question: 'Track API key usage statistics?',
        type: 'boolean',
        required: false,
        default: true,
      },
    ],
  },
  {
    slug: 'sessions',
    name: 'Session Management',
    description: 'Complete session management with device tracking and security',
    category: 'authorization',
    tags: ['auth', 'sessions', 'security', 'devices'],
    version: '1.0.0',
    questions: [
      {
        id: 'session_duration_hours',
        question: 'Session duration (in hours)',
        type: 'number',
        required: false,
        default: 24,
        validation: { min: 1, max: 720 },
      },
      {
        id: 'max_concurrent_sessions',
        question: 'Maximum concurrent sessions per user',
        type: 'number',
        required: false,
        default: 5,
        validation: { min: 1, max: 20 },
      },
    ],
  },
  {
    slug: 'jwt-tokens',
    name: 'JWT Token Management',
    description: 'Complete JWT handling with refresh tokens and blacklisting',
    category: 'authorization',
    tags: ['auth', 'jwt', 'tokens', 'security'],
    version: '1.0.0',
    questions: [
      {
        id: 'algorithm',
        question: 'JWT signing algorithm',
        type: 'select',
        required: true,
        options: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'],
        default: 'RS256',
      },
      {
        id: 'access_token_ttl',
        question: 'Access token TTL (in seconds)',
        type: 'number',
        required: false,
        default: 900,
        validation: { min: 60, max: 3600 },
      },
    ],
  },

  // ============================================
  // Payments Templates
  // ============================================
  {
    slug: 'stripe-subscriptions',
    name: 'Stripe Subscriptions',
    description: 'Complete subscription management with Stripe integration',
    category: 'payments',
    tags: ['payments', 'stripe', 'subscriptions', 'billing', 'saas'],
    version: '1.0.0',
    questions: [
      {
        id: 'stripe_api_key',
        question: 'Stripe API key (starts with sk_)',
        type: 'text',
        required: true,
        placeholder: 'sk_live_...',
      },
      {
        id: 'webhook_secret',
        question: 'Stripe webhook secret',
        type: 'text',
        required: true,
        placeholder: 'whsec_...',
      },
      {
        id: 'trial_days',
        question: 'Default trial period (in days)',
        type: 'number',
        required: false,
        default: 14,
        validation: { min: 0, max: 90 },
      },
    ],
  },
  {
    slug: 'webhooks',
    name: 'Webhooks',
    description: 'Complete webhook management with delivery, retry, and verification',
    category: 'payments',
    tags: ['webhooks', 'events', 'integration', 'api'],
    version: '1.0.0',
    questions: [
      {
        id: 'max_retries',
        question: 'Maximum delivery retry attempts',
        type: 'number',
        required: false,
        default: 5,
        validation: { min: 1, max: 10 },
      },
      {
        id: 'retry_backoff',
        question: 'Retry backoff strategy',
        type: 'select',
        required: false,
        options: ['exponential', 'linear', 'fixed'],
        default: 'exponential',
      },
    ],
  },

  // ============================================
  // Data Management Templates
  // ============================================
  {
    slug: 'file-uploads',
    name: 'File Uploads',
    description: 'Complete file upload management with validation, storage, and processing',
    category: 'data-management',
    tags: ['files', 'uploads', 'storage', 's3', 'media'],
    version: '1.0.0',
    questions: [
      {
        id: 'storage_provider',
        question: 'Storage provider',
        type: 'select',
        required: true,
        options: ['s3', 'gcs', 'azure_blob', 'local'],
        default: 's3',
      },
      {
        id: 'max_file_size_mb',
        question: 'Maximum file size (in MB)',
        type: 'number',
        required: false,
        default: 100,
        validation: { min: 1, max: 5000 },
      },
      {
        id: 'allowed_mime_types',
        question: 'Allowed file types',
        type: 'multiselect',
        required: true,
        options: ['image/*', 'video/*', 'audio/*', 'application/pdf', 'text/*', 'application/*'],
      },
    ],
  },
  {
    slug: 'search',
    name: 'Full-Text Search',
    description: 'Full-text search with filters, facets, and suggestions',
    category: 'data-management',
    tags: ['search', 'elasticsearch', 'full-text', 'facets'],
    version: '1.0.0',
    questions: [
      {
        id: 'search_provider',
        question: 'Search provider',
        type: 'select',
        required: true,
        options: ['elasticsearch', 'opensearch', 'algolia', 'meilisearch', 'typesense'],
        default: 'elasticsearch',
      },
      {
        id: 'enable_autocomplete',
        question: 'Enable autocomplete/suggestions?',
        type: 'boolean',
        required: false,
        default: true,
      },
    ],
  },
  {
    slug: 'pagination',
    name: 'Pagination',
    description: 'Cursor-based and offset-based pagination patterns',
    category: 'data-management',
    tags: ['pagination', 'cursor', 'offset', 'api'],
    version: '1.0.0',
    questions: [
      {
        id: 'default_page_size',
        question: 'Default page size',
        type: 'number',
        required: false,
        default: 20,
        validation: { min: 5, max: 100 },
      },
      {
        id: 'max_page_size',
        question: 'Maximum page size',
        type: 'number',
        required: false,
        default: 100,
        validation: { min: 20, max: 500 },
      },
    ],
  },
  {
    slug: 'data-export',
    name: 'Data Export (GDPR)',
    description: 'User data export and portability for GDPR compliance',
    category: 'data-management',
    tags: ['gdpr', 'export', 'compliance', 'privacy', 'data-portability'],
    version: '1.0.0',
    questions: [
      {
        id: 'export_formats',
        question: 'Supported export formats',
        type: 'multiselect',
        required: true,
        options: ['json', 'csv', 'xml'],
        default: 'json',
      },
      {
        id: 'cooldown_hours',
        question: 'Cooldown between export requests (hours)',
        type: 'number',
        required: false,
        default: 24,
        validation: { min: 1, max: 168 },
      },
    ],
  },
  {
    slug: 'caching',
    name: 'Caching',
    description: 'Cache management with TTL, invalidation, and warming strategies',
    category: 'data-management',
    tags: ['cache', 'redis', 'performance', 'ttl'],
    version: '1.0.0',
    questions: [
      {
        id: 'cache_provider',
        question: 'Cache provider',
        type: 'select',
        required: true,
        options: ['redis', 'memcached', 'in-memory'],
        default: 'redis',
      },
      {
        id: 'default_ttl_seconds',
        question: 'Default TTL (in seconds)',
        type: 'number',
        required: false,
        default: 3600,
        validation: { min: 60, max: 86400 },
      },
    ],
  },

  // ============================================
  // User Management Templates
  // ============================================
  {
    slug: 'user-profiles',
    name: 'User Profiles',
    description: 'Complete user profile with settings, preferences, and account management',
    category: 'user-management',
    tags: ['users', 'profiles', 'settings', 'preferences'],
    version: '1.0.0',
    questions: [
      {
        id: 'username_required',
        question: 'Require unique username?',
        type: 'boolean',
        required: false,
        default: true,
      },
      {
        id: 'allow_username_change',
        question: 'Allow username changes?',
        type: 'boolean',
        required: false,
        default: true,
      },
    ],
  },
  {
    slug: 'teams',
    name: 'Teams/Organizations',
    description: 'Complete team management with memberships, roles, and billing',
    category: 'user-management',
    tags: ['teams', 'organizations', 'memberships', 'collaboration'],
    version: '1.0.0',
    questions: [
      {
        id: 'max_members_free',
        question: 'Maximum members on free plan',
        type: 'number',
        required: false,
        default: 5,
        validation: { min: 1, max: 100 },
      },
      {
        id: 'team_roles',
        question: 'Available team roles',
        type: 'multiselect',
        required: true,
        options: ['owner', 'admin', 'member', 'viewer', 'billing'],
      },
    ],
  },
  {
    slug: 'invitations',
    name: 'Invitation System',
    description: 'Generic invitation system for various use cases',
    category: 'user-management',
    tags: ['invitations', 'onboarding', 'teams', 'referrals'],
    version: '1.0.0',
    questions: [
      {
        id: 'invitation_expiry_days',
        question: 'Invitation expiry (in days)',
        type: 'number',
        required: false,
        default: 7,
        validation: { min: 1, max: 30 },
      },
      {
        id: 'daily_invite_limit',
        question: 'Daily invitation limit per user',
        type: 'number',
        required: false,
        default: 10,
        validation: { min: 1, max: 100 },
      },
    ],
  },
  {
    slug: 'onboarding',
    name: 'User Onboarding',
    description: 'Progressive onboarding flow with step tracking and personalization',
    category: 'user-management',
    tags: ['onboarding', 'wizard', 'setup', 'ux'],
    version: '1.0.0',
    questions: [
      {
        id: 'onboarding_steps',
        question: 'Onboarding steps to include',
        type: 'multiselect',
        required: true,
        options: ['profile', 'team', 'integrations', 'tutorial', 'preferences', 'verification'],
      },
      {
        id: 'allow_skip',
        question: 'Allow skipping optional steps?',
        type: 'boolean',
        required: false,
        default: true,
      },
    ],
  },
  {
    slug: 'account-deletion',
    name: 'Account Deletion',
    description: 'Secure account deletion with grace period and data removal',
    category: 'user-management',
    tags: ['gdpr', 'deletion', 'privacy', 'compliance'],
    version: '1.0.0',
    questions: [
      {
        id: 'grace_period_days',
        question: 'Grace period before deletion (in days)',
        type: 'number',
        required: false,
        default: 30,
        validation: { min: 7, max: 90 },
      },
      {
        id: 'require_confirmation',
        question: 'Require email confirmation?',
        type: 'boolean',
        required: false,
        default: true,
      },
    ],
  },

  // ============================================
  // Operations Templates
  // ============================================
  {
    slug: 'rate-limiting',
    name: 'Rate Limiting',
    description: 'Complete rate limiting with multiple strategies and quota management',
    category: 'operations',
    tags: ['rate-limiting', 'throttling', 'api', 'security'],
    version: '1.0.0',
    questions: [
      {
        id: 'strategy',
        question: 'Rate limiting strategy',
        type: 'select',
        required: true,
        options: ['fixed_window', 'sliding_window', 'token_bucket', 'leaky_bucket'],
        default: 'sliding_window',
      },
      {
        id: 'default_limit',
        question: 'Default requests per minute',
        type: 'number',
        required: false,
        default: 100,
        validation: { min: 1, max: 10000 },
      },
    ],
  },
  {
    slug: 'audit-logs',
    name: 'Audit Logs',
    description: 'Complete audit logging with retention, search, and compliance',
    category: 'operations',
    tags: ['audit', 'logging', 'compliance', 'security', 'soc2'],
    version: '1.0.0',
    questions: [
      {
        id: 'retention_days',
        question: 'Log retention period (in days)',
        type: 'number',
        required: false,
        default: 90,
        validation: { min: 30, max: 2555 },
      },
      {
        id: 'compliance_frameworks',
        question: 'Compliance frameworks',
        type: 'multiselect',
        required: false,
        options: ['soc2', 'gdpr', 'hipaa', 'pci'],
      },
    ],
  },
  {
    slug: 'feature-flags',
    name: 'Feature Flags',
    description: 'Feature flag management with targeting and gradual rollouts',
    category: 'operations',
    tags: ['feature-flags', 'toggles', 'rollouts', 'ab-testing'],
    version: '1.0.0',
    questions: [
      {
        id: 'default_environment',
        question: 'Default environment',
        type: 'select',
        required: true,
        options: ['development', 'staging', 'production'],
        default: 'production',
      },
      {
        id: 'enable_percentage_rollouts',
        question: 'Enable percentage-based rollouts?',
        type: 'boolean',
        required: false,
        default: true,
      },
    ],
  },
  {
    slug: 'ab-testing',
    name: 'A/B Testing',
    description: 'Complete A/B testing with experiments, variants, and statistical analysis',
    category: 'operations',
    tags: ['ab-testing', 'experiments', 'analytics', 'optimization'],
    version: '1.0.0',
    questions: [
      {
        id: 'default_confidence_level',
        question: 'Default confidence level (%)',
        type: 'select',
        required: false,
        options: ['90', '95', '99'],
        default: '95',
      },
      {
        id: 'auto_stop_experiments',
        question: 'Auto-stop experiments at significance?',
        type: 'boolean',
        required: false,
        default: false,
      },
    ],
  },
  {
    slug: 'multi-tenancy',
    name: 'Multi-Tenancy',
    description: 'Tenant isolation, configuration, and resource management',
    category: 'operations',
    tags: ['multi-tenant', 'saas', 'isolation', 'b2b'],
    version: '1.0.0',
    questions: [
      {
        id: 'isolation_level',
        question: 'Data isolation level',
        type: 'select',
        required: true,
        options: ['shared_schema', 'separate_schema', 'separate_db'],
        default: 'shared_schema',
      },
      {
        id: 'custom_domains',
        question: 'Allow custom domains?',
        type: 'boolean',
        required: false,
        default: true,
      },
    ],
  },

  // ============================================
  // Support Templates
  // ============================================
  {
    slug: 'notifications',
    name: 'Notifications',
    description: 'Multi-channel notification system with preferences and delivery tracking',
    category: 'support',
    tags: ['notifications', 'email', 'push', 'sms', 'alerts'],
    version: '1.0.0',
    questions: [
      {
        id: 'channels',
        question: 'Notification channels',
        type: 'multiselect',
        required: true,
        options: ['email', 'push', 'sms', 'in_app', 'webhook', 'slack'],
      },
      {
        id: 'enable_quiet_hours',
        question: 'Enable quiet hours feature?',
        type: 'boolean',
        required: false,
        default: true,
      },
    ],
  },
  {
    slug: 'feedback',
    name: 'User Feedback & Support',
    description: 'Feedback collection, support tickets, and user satisfaction (NPS)',
    category: 'support',
    tags: ['feedback', 'support', 'tickets', 'nps', 'customer-service'],
    version: '1.0.0',
    questions: [
      {
        id: 'enable_nps',
        question: 'Enable NPS surveys?',
        type: 'boolean',
        required: false,
        default: true,
      },
      {
        id: 'ticket_priorities',
        question: 'Ticket priority levels',
        type: 'multiselect',
        required: true,
        options: ['low', 'medium', 'high', 'urgent'],
      },
    ],
  },
  {
    slug: 'content-moderation',
    name: 'Content Moderation',
    description: 'Content review, reporting, and moderation workflows',
    category: 'support',
    tags: ['moderation', 'content', 'safety', 'reporting', 'ugc'],
    version: '1.0.0',
    questions: [
      {
        id: 'auto_moderation',
        question: 'Enable AI-powered auto-moderation?',
        type: 'boolean',
        required: false,
        default: true,
      },
      {
        id: 'report_threshold',
        question: 'Reports needed to auto-flag content',
        type: 'number',
        required: false,
        default: 3,
        validation: { min: 1, max: 10 },
      },
    ],
  },
];

/**
 * Get a template by slug
 */
export function getTemplateBySlug(slug: string): TemplateMetadata | undefined {
  return templateRegistry.find((t) => t.slug === slug);
}

/**
 * Get all templates with a specific tag
 */
export function getTemplatesByTag(tag: string): TemplateMetadata[] {
  return templateRegistry.filter((t) => t.tags.includes(tag));
}

/**
 * Get all templates in a category
 */
export function getTemplatesByCategory(category: TemplateCategory): TemplateMetadata[] {
  return templateRegistry.filter((t) => t.category === category);
}

/**
 * Search templates by name or description
 */
export function searchTemplates(query: string): TemplateMetadata[] {
  const lowerQuery = query.toLowerCase();
  return templateRegistry.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.includes(lowerQuery))
  );
}

/**
 * Get all unique tags across all templates
 */
export function getAllTags(): string[] {
  const tags = new Set<string>();
  templateRegistry.forEach((t) => t.tags.forEach((tag) => tags.add(tag)));
  return Array.from(tags).sort();
}

/**
 * Get all categories
 */
export function getAllCategories(): TemplateCategory[] {
  return [
    'authentication',
    'authorization',
    'payments',
    'data-management',
    'user-management',
    'operations',
    'support',
    'infrastructure',
  ];
}

/**
 * Get template count by category
 */
export function getTemplateCounts(): Record<TemplateCategory, number> {
  const counts: Record<string, number> = {};
  getAllCategories().forEach((cat) => {
    counts[cat] = templateRegistry.filter((t) => t.category === cat).length;
  });
  return counts as Record<TemplateCategory, number>;
}
