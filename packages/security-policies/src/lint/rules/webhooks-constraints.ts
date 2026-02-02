// ============================================================================
// Lint Rule: Webhook Behavior Constraints
// ============================================================================

import type { LintRule, Finding, RuleContext, Behavior, ASTFix, RequiredConstraint } from '../../types.js';

/**
 * Webhook behavior patterns
 */
const WEBHOOK_PATTERNS = [
  /webhook/i,
  /callback/i,
  /hook/i,
  /notify/i,
  /event[_-]?handler/i,
  /inbound/i,
  /receive[_-]?event/i,
  /handle[_-]?event/i,
  /process[_-]?event/i,
  /on[_-]?event/i,
  /stripe[_-]?webhook/i,
  /payment[_-]?webhook/i,
  /github[_-]?webhook/i,
  /slack[_-]?event/i,
  /sns[_-]?handler/i,
  /sqs[_-]?handler/i,
];

/**
 * Required constraints for webhook behaviors
 */
const WEBHOOK_REQUIRED_CONSTRAINTS: RequiredConstraint[] = [
  {
    type: 'webhook_signature',
    description: 'Signature verification to prevent spoofing',
    severity: 'error',
  },
  {
    type: 'validation',
    description: 'Payload validation and schema checking',
    severity: 'warning',
  },
  {
    type: 'rate_limit',
    description: 'Rate limiting for DDoS protection',
    severity: 'warning',
  },
];

/**
 * Check if behavior has signature verification
 */
function hasSignatureVerification(behavior: Behavior): boolean {
  // Check security specs
  const hasSecuritySpec = behavior.security.some(
    spec => spec.type === 'webhook_signature' || 
            (spec.type === 'requires' && JSON.stringify(spec.details).includes('signature'))
  );
  if (hasSecuritySpec) return true;

  // Check for signature in preconditions
  const preStr = behavior.preconditions
    .map(p => JSON.stringify(p))
    .join(' ');
  
  return preStr.includes('signature') && 
         (preStr.includes('valid') || preStr.includes('verify'));
}

/**
 * Check if behavior has idempotency handling
 */
function hasIdempotency(behavior: Behavior): boolean {
  // Check for idempotency key
  const hasKey = behavior.input.fields.some(
    f => /idempotency|event[_-]?id|request[_-]?id|delivery[_-]?id/i.test(f.name.name)
  );
  
  // Check for duplicate check in preconditions
  const preStr = behavior.preconditions
    .map(p => JSON.stringify(p))
    .join(' ');
  
  return hasKey && (
    preStr.includes('already_processed') ||
    preStr.includes('duplicate') ||
    preStr.includes('idempoten')
  );
}

/**
 * Check if behavior has replay protection
 */
function hasReplayProtection(behavior: Behavior): boolean {
  const hasTimestamp = behavior.input.fields.some(
    f => /timestamp|time/i.test(f.name.name)
  );
  
  const preStr = behavior.preconditions
    .map(p => JSON.stringify(p))
    .join(' ');
  
  return hasTimestamp && (
    preStr.includes('within') ||
    preStr.includes('fresh') ||
    preStr.includes('timestamp')
  );
}

/**
 * Check if behavior has proper error handling
 */
function hasProperErrorHandling(behavior: Behavior): boolean {
  // Webhooks should have specific errors defined
  return behavior.output.errors.length > 0 &&
         behavior.output.errors.some(e => 
           /invalid|unauthorized|expired|duplicate/i.test(e.name.name)
         );
}

/**
 * Check if behavior is async/non-blocking
 */
function isAsyncProcessing(behavior: Behavior): boolean {
  // Check temporal specs for response time hints
  const hasQuickResponse = behavior.temporal.some(
    t => t.operator === 'response' || t.operator === 'within'
  );
  
  // Check for async patterns in postconditions
  const postStr = behavior.postconditions
    .map(p => JSON.stringify(p))
    .join(' ');
  
  return hasQuickResponse || 
         postStr.includes('eventually') ||
         postStr.includes('async') ||
         postStr.includes('queue');
}

/**
 * Generate signature verification autofix
 */
function generateSignatureVerificationFix(behavior: Behavior): ASTFix {
  return {
    description: `Add webhook signature verification to '${behavior.name.name}'`,
    operation: 'add',
    targetKind: 'SecuritySpec',
    location: behavior.location,
    patch: {
      position: 'inside',
      text: `
    input {
      signature: String
      timestamp: Timestamp
    }
    
    security {
      webhook_signature required
    }
    
    preconditions {
      verify_webhook_signature(input.signature, input.payload)
      input.timestamp within 5.minutes of now()
    }`,
    },
  };
}

/**
 * Generate idempotency autofix
 */
function generateIdempotencyFix(behavior: Behavior): ASTFix {
  return {
    description: `Add idempotency handling to '${behavior.name.name}'`,
    operation: 'add',
    targetKind: 'Field',
    location: behavior.input.location,
    patch: {
      position: 'inside',
      text: `
    input {
      event_id: String [unique]
    }
    
    preconditions {
      not already_processed(input.event_id)
    }
    
    postconditions {
      success implies {
        mark_processed(input.event_id)
      }
    }`,
    },
  };
}

/**
 * Generate replay protection autofix
 */
function generateReplayProtectionFix(behavior: Behavior): ASTFix {
  return {
    description: `Add replay protection to '${behavior.name.name}'`,
    operation: 'add',
    targetKind: 'Field',
    location: behavior.input.location,
    patch: {
      position: 'inside',
      text: `
    input {
      timestamp: Timestamp
    }
    
    preconditions {
      input.timestamp within 5.minutes of now()
    }`,
    },
  };
}

/**
 * Webhook Constraints Lint Rule
 */
export const webhookConstraintsRule: LintRule = {
  id: 'LINT-WEBHOOK-001',
  name: 'Webhook Behavior Minimum Constraints',
  category: 'webhook-security',
  severity: 'error',
  description: 'Webhook behaviors must have signature verification, idempotency, and replay protection',
  matchPatterns: WEBHOOK_PATTERNS,
  requiredConstraints: WEBHOOK_REQUIRED_CONSTRAINTS,
  
  check: (context: RuleContext): Finding[] => {
    const findings: Finding[] = [];
    const { domain, behavior } = context;

    const behaviorsToCheck = behavior ? [behavior] : domain.behaviors;

    for (const b of behaviorsToCheck) {
      // Check if this is a webhook behavior
      const isWebhook = WEBHOOK_PATTERNS.some(pattern => pattern.test(b.name.name));
      if (!isWebhook) continue;

      // Check signature verification
      if (!hasSignatureVerification(b)) {
        findings.push({
          id: 'LINT-WEBHOOK-001',
          category: 'webhook-security',
          severity: 'error',
          title: 'Webhook Missing Signature Verification',
          message: `Webhook behavior '${b.name.name}' must verify request signatures`,
          location: b.location,
          behaviorName: b.name.name,
          suggestion: 'Add signature field and verification precondition',
          autofix: generateSignatureVerificationFix(b),
        });
      }

      // Check idempotency
      if (!hasIdempotency(b)) {
        findings.push({
          id: 'LINT-WEBHOOK-001',
          category: 'webhook-security',
          severity: 'warning',
          title: 'Webhook Missing Idempotency',
          message: `Webhook behavior '${b.name.name}' should implement idempotency for retry safety`,
          location: b.location,
          behaviorName: b.name.name,
          suggestion: 'Add event_id field and duplicate processing check',
          autofix: generateIdempotencyFix(b),
        });
      }

      // Check replay protection
      if (!hasReplayProtection(b)) {
        findings.push({
          id: 'LINT-WEBHOOK-001',
          category: 'webhook-security',
          severity: 'warning',
          title: 'Webhook Missing Replay Protection',
          message: `Webhook behavior '${b.name.name}' should validate timestamp to prevent replay attacks`,
          location: b.location,
          behaviorName: b.name.name,
          suggestion: 'Add timestamp validation within acceptable window',
          autofix: generateReplayProtectionFix(b),
        });
      }
    }

    return findings;
  },
};

/**
 * Webhook Error Handling Rule
 */
export const webhookErrorHandlingRule: LintRule = {
  id: 'LINT-WEBHOOK-002',
  name: 'Webhook Error Handling',
  category: 'webhook-security',
  severity: 'warning',
  description: 'Webhooks should define specific error types for proper retry handling',
  matchPatterns: WEBHOOK_PATTERNS,
  requiredConstraints: [],
  
  check: (context: RuleContext): Finding[] => {
    const findings: Finding[] = [];
    const { domain, behavior } = context;

    const behaviorsToCheck = behavior ? [behavior] : domain.behaviors;

    for (const b of behaviorsToCheck) {
      const isWebhook = WEBHOOK_PATTERNS.some(pattern => pattern.test(b.name.name));
      if (!isWebhook) continue;

      if (!hasProperErrorHandling(b)) {
        findings.push({
          id: 'LINT-WEBHOOK-002',
          category: 'webhook-security',
          severity: 'warning',
          title: 'Webhook Missing Error Definitions',
          message: `Webhook behavior '${b.name.name}' should define specific error types`,
          location: b.output.location,
          behaviorName: b.name.name,
          suggestion: 'Define errors for INVALID_SIGNATURE, EXPIRED_TIMESTAMP, DUPLICATE_EVENT',
          autofix: {
            description: `Add error definitions to '${b.name.name}'`,
            operation: 'add',
            targetKind: 'ErrorSpec',
            location: b.output.location,
            patch: {
              position: 'inside',
              text: `
      errors {
        INVALID_SIGNATURE {
          when: "Signature verification failed"
          retriable: false
        }
        EXPIRED_TIMESTAMP {
          when: "Request timestamp too old"
          retriable: false
        }
        DUPLICATE_EVENT {
          when: "Event already processed"
          retriable: false
        }
      }`,
            },
          },
        });
      }
    }

    return findings;
  },
};

/**
 * Webhook Response Time Rule
 */
export const webhookResponseTimeRule: LintRule = {
  id: 'LINT-WEBHOOK-003',
  name: 'Webhook Response Time',
  category: 'webhook-security',
  severity: 'info',
  description: 'Webhooks should respond quickly and process asynchronously if needed',
  matchPatterns: WEBHOOK_PATTERNS,
  requiredConstraints: [],
  
  check: (context: RuleContext): Finding[] => {
    const findings: Finding[] = [];
    const { domain, behavior } = context;

    const behaviorsToCheck = behavior ? [behavior] : domain.behaviors;

    for (const b of behaviorsToCheck) {
      const isWebhook = WEBHOOK_PATTERNS.some(pattern => pattern.test(b.name.name));
      if (!isWebhook) continue;

      if (!isAsyncProcessing(b)) {
        findings.push({
          id: 'LINT-WEBHOOK-003',
          category: 'webhook-security',
          severity: 'info',
          title: 'Consider Async Processing',
          message: `Webhook behavior '${b.name.name}' should respond quickly - consider async processing`,
          location: b.location,
          behaviorName: b.name.name,
          suggestion: 'Add temporal spec: response within 1.seconds, or use async queue processing',
          autofix: {
            description: `Add response time constraint to '${b.name.name}'`,
            operation: 'add',
            targetKind: 'TemporalSpec',
            location: b.location,
            patch: {
              position: 'inside',
              text: `
    temporal {
      response within 1.seconds
    }`,
            },
          },
        });
      }
    }

    return findings;
  },
};

export const webhookLintRules: LintRule[] = [
  webhookConstraintsRule,
  webhookErrorHandlingRule,
  webhookResponseTimeRule,
];
