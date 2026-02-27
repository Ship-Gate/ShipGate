/**
 * Suggestion Templates
 * 
 * Pre-defined templates for common improvement suggestions.
 */

export interface SuggestionTemplate {
  id: string;
  category: string;
  title: string;
  description: string;
  applicability: (context: TemplateContext) => boolean;
  generateCode?: (context: TemplateContext) => string;
  confidence: number;
}

export interface TemplateContext {
  entityName?: string;
  behaviorName?: string;
  fieldName?: string;
  fieldType?: string;
  errorCode?: string;
  existingCode?: string;
}

// ============================================================================
// ENTITY TEMPLATES
// ============================================================================

export const entityTemplates: SuggestionTemplate[] = [
  {
    id: 'add-timestamps',
    category: 'entity',
    title: 'Add timestamp fields',
    description: 'Add created_at and updated_at timestamps for auditing.',
    applicability: (ctx) => !!ctx.entityName,
    generateCode: (ctx) => `
  // Add to entity ${ctx.entityName}
  created_at: Timestamp [immutable]
  updated_at: Timestamp`,
    confidence: 0.9,
  },
  {
    id: 'add-soft-delete',
    category: 'entity',
    title: 'Add soft delete support',
    description: 'Use deleted_at instead of hard deletes for data recovery.',
    applicability: (ctx) => !!ctx.entityName,
    generateCode: (ctx) => `
  // Add to entity ${ctx.entityName}
  deleted_at: Timestamp?

  invariants {
    // Soft deleted records are not returned by default
    deleted_at == null  // Add to query filters
  }`,
    confidence: 0.7,
  },
  {
    id: 'add-version-field',
    category: 'entity',
    title: 'Add version field for optimistic locking',
    description: 'Prevent concurrent update conflicts with versioning.',
    applicability: (ctx) => !!ctx.entityName,
    generateCode: (ctx) => `
  // Add to entity ${ctx.entityName}
  version: Int { default: 1 }

  // Add to update behaviors
  preconditions {
    input.version == Entity.lookup(input.id).version
  }`,
    confidence: 0.75,
  },
  {
    id: 'add-id-field',
    category: 'entity',
    title: 'Add proper ID field',
    description: 'Entities should have an immutable, unique identifier.',
    applicability: (ctx) => !!ctx.entityName,
    generateCode: (ctx) => `
  // Add to entity ${ctx.entityName}
  id: UUID [immutable, unique, indexed]`,
    confidence: 0.95,
  },
];

// ============================================================================
// BEHAVIOR TEMPLATES
// ============================================================================

export const behaviorTemplates: SuggestionTemplate[] = [
  {
    id: 'add-rate-limit',
    category: 'behavior',
    title: 'Add rate limiting',
    description: 'Protect against abuse with rate limiting.',
    applicability: (ctx) => !!ctx.behaviorName,
    generateCode: (ctx) => `
  // Add to behavior ${ctx.behaviorName}
  security {
    rate_limit: 100.per_minute per user
    rate_limit: 1000.per_minute per ip
  }`,
    confidence: 0.8,
  },
  {
    id: 'add-pagination',
    category: 'behavior',
    title: 'Add pagination support',
    description: 'List operations should support pagination for large datasets.',
    applicability: (ctx) => 
      !!ctx.behaviorName && 
      (ctx.behaviorName.toLowerCase().includes('list') ||
       ctx.behaviorName.toLowerCase().includes('search')),
    generateCode: (ctx) => `
  // Add to input of ${ctx.behaviorName}
  input {
    limit: Int { default: 50, max: 200 }
    cursor: String?  // Cursor-based pagination
  }

  // Add to output
  output {
    success: {
      items: List<...>
      next_cursor: String?
      has_more: Boolean
    }
  }`,
    confidence: 0.85,
  },
  {
    id: 'add-idempotency',
    category: 'behavior',
    title: 'Add idempotency key',
    description: 'Support safe retries with idempotency.',
    applicability: (ctx) =>
      !!ctx.behaviorName &&
      (ctx.behaviorName.toLowerCase().includes('create') ||
       ctx.behaviorName.toLowerCase().includes('send')),
    generateCode: (ctx) => `
  // Add to input of ${ctx.behaviorName}
  idempotency_key: String?

  // Add to invariants
  invariants {
    same(idempotency_key) implies same(result)
  }`,
    confidence: 0.85,
  },
  {
    id: 'add-temporal',
    category: 'behavior',
    title: 'Add temporal requirements',
    description: 'Define response time SLAs.',
    applicability: (ctx) => !!ctx.behaviorName,
    generateCode: (ctx) => `
  // Add to behavior ${ctx.behaviorName}
  temporal {
    response within 500.ms (p99)
    response within 100.ms (p50)
  }`,
    confidence: 0.7,
  },
  {
    id: 'add-observability',
    category: 'behavior',
    title: 'Add observability configuration',
    description: 'Define metrics, traces, and logs.',
    applicability: (ctx) => !!ctx.behaviorName,
    generateCode: (ctx) => `
  // Add to behavior ${ctx.behaviorName}
  observability {
    metrics {
      counter ${ctx.behaviorName?.toLowerCase()}_total { labels: [status] }
      histogram ${ctx.behaviorName?.toLowerCase()}_duration { labels: [status] }
    }
    traces {
      span: "${ctx.behaviorName?.toLowerCase()}"
    }
    logs {
      on_error: warn { include: [error_code] }
    }
  }`,
    confidence: 0.65,
  },
];

// ============================================================================
// ERROR TEMPLATES
// ============================================================================

export const errorTemplates: SuggestionTemplate[] = [
  {
    id: 'add-not-found-error',
    category: 'error',
    title: 'Add NOT_FOUND error',
    description: 'Handle case when entity is not found.',
    applicability: (ctx) => !!ctx.behaviorName,
    generateCode: (_ctx) => `
  NOT_FOUND {
    when: "Resource not found"
  }`,
    confidence: 0.9,
  },
  {
    id: 'add-validation-error',
    category: 'error',
    title: 'Add VALIDATION_ERROR',
    description: 'Handle input validation failures.',
    applicability: (ctx) => !!ctx.behaviorName,
    generateCode: (_ctx) => `
  VALIDATION_ERROR {
    when: "Input validation failed"
    returns: { field: String, message: String }
  }`,
    confidence: 0.85,
  },
  {
    id: 'add-conflict-error',
    category: 'error',
    title: 'Add CONFLICT error',
    description: 'Handle concurrent modification conflicts.',
    applicability: (ctx) => 
      !!ctx.behaviorName &&
      ctx.behaviorName.toLowerCase().includes('update'),
    generateCode: (_ctx) => `
  CONFLICT {
    when: "Resource was modified by another request"
    retriable: true
    retry_after: 1.second
  }`,
    confidence: 0.8,
  },
  {
    id: 'add-rate-limit-error',
    category: 'error',
    title: 'Add RATE_LIMITED error',
    description: 'Handle rate limit exceeded.',
    applicability: (ctx) => !!ctx.behaviorName,
    generateCode: (_ctx) => `
  RATE_LIMITED {
    when: "Too many requests"
    retriable: true
    retry_after: 1.minute
  }`,
    confidence: 0.75,
  },
];

// ============================================================================
// SECURITY TEMPLATES
// ============================================================================

export const securityTemplates: SuggestionTemplate[] = [
  {
    id: 'add-pii-annotation',
    category: 'security',
    title: 'Add PII annotation',
    description: 'Mark personally identifiable information.',
    applicability: (ctx) => !!ctx.fieldName,
    generateCode: (ctx) => `
  ${ctx.fieldName}: ${ctx.fieldType} [pii]`,
    confidence: 0.9,
  },
  {
    id: 'add-secret-annotation',
    category: 'security',
    title: 'Add secret annotation',
    description: 'Mark sensitive data that should not be logged.',
    applicability: (ctx) => !!ctx.fieldName,
    generateCode: (ctx) => `
  ${ctx.fieldName}: ${ctx.fieldType} [secret]`,
    confidence: 0.95,
  },
  {
    id: 'add-auth-requirement',
    category: 'security',
    title: 'Add authentication requirement',
    description: 'Require authentication for this behavior.',
    applicability: (ctx) => !!ctx.behaviorName,
    generateCode: (ctx) => `
  // Add to behavior ${ctx.behaviorName}
  actors {
    user: {
      must: authenticated
    }
  }

  security {
    requires: authentication
  }`,
    confidence: 0.85,
  },
  {
    id: 'add-permission-requirement',
    category: 'security',
    title: 'Add permission requirement',
    description: 'Require specific permission for this behavior.',
    applicability: (ctx) => !!ctx.behaviorName,
    generateCode: (ctx) => {
      const permission = ctx.behaviorName?.toLowerCase().replace(/([A-Z])/g, ':$1').slice(1);
      return `
  // Add to behavior ${ctx.behaviorName}
  security {
    requires: permission("${permission}")
  }`;
    },
    confidence: 0.8,
  },
];

// ============================================================================
// VALIDATION TEMPLATES
// ============================================================================

export const validationTemplates: SuggestionTemplate[] = [
  {
    id: 'add-string-constraints',
    category: 'validation',
    title: 'Add string constraints',
    description: 'Add length and pattern constraints to string fields.',
    applicability: (ctx) => ctx.fieldType === 'String',
    generateCode: (ctx) => `
  ${ctx.fieldName}: String {
    min_length: 1
    max_length: 255
    // pattern: /^[a-zA-Z0-9]+$/  // Optional regex validation
  }`,
    confidence: 0.7,
  },
  {
    id: 'add-number-constraints',
    category: 'validation',
    title: 'Add number constraints',
    description: 'Add min/max constraints to numeric fields.',
    applicability: (ctx) => 
      ctx.fieldType === 'Int' || 
      ctx.fieldType === 'Decimal',
    generateCode: (ctx) => `
  ${ctx.fieldName}: ${ctx.fieldType} {
    min: 0
    // max: 1000000
  }`,
    confidence: 0.65,
  },
  {
    id: 'add-email-type',
    category: 'validation',
    title: 'Use Email type',
    description: 'Use the Email type for email validation.',
    applicability: (ctx) => 
      ctx.fieldName?.toLowerCase().includes('email') ?? false,
    generateCode: (ctx) => `
  // Define type if not exists
  type Email = String {
    pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/
    max_length: 254
  }

  // Use in field
  ${ctx.fieldName}: Email`,
    confidence: 0.9,
  },
];

// ============================================================================
// ALL TEMPLATES
// ============================================================================

export const allTemplates: SuggestionTemplate[] = [
  ...entityTemplates,
  ...behaviorTemplates,
  ...errorTemplates,
  ...securityTemplates,
  ...validationTemplates,
];

/**
 * Find applicable templates for a given context
 */
export function findApplicableTemplates(context: TemplateContext): SuggestionTemplate[] {
  return allTemplates.filter(t => t.applicability(context));
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): SuggestionTemplate | undefined {
  return allTemplates.find(t => t.id === id);
}
