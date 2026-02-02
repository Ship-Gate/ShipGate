// ============================================================================
// Policy: Webhook Signature Required
// ============================================================================

import type { PolicyRule, Finding, RuleContext, Behavior, ASTFix } from '../types.js';

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
];

/**
 * Check if behavior is a webhook handler
 */
function isWebhookBehavior(behavior: Behavior): boolean {
  const name = behavior.name.name;
  return WEBHOOK_PATTERNS.some(pattern => pattern.test(name));
}

/**
 * Check if behavior has signature verification
 */
function hasSignatureVerification(behavior: Behavior): boolean {
  // Check security specs
  const hasSecuritySpec = behavior.security.some(
    spec => spec.type === 'webhook_signature' || 
            spec.type === 'requires' && JSON.stringify(spec.details).includes('signature')
  );
  if (hasSecuritySpec) return true;

  // Check preconditions for signature validation
  const preconditionStr = behavior.preconditions
    .map(p => JSON.stringify(p))
    .join(' ');
  
  return preconditionStr.includes('signature') && 
         (preconditionStr.includes('valid') || preconditionStr.includes('verify'));
}

/**
 * Check if behavior has signature input field
 */
function hasSignatureInput(behavior: Behavior): boolean {
  return behavior.input.fields.some(
    f => /signature/i.test(f.name.name) || /hmac/i.test(f.name.name)
  );
}

/**
 * Generate autofix for adding signature verification
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
    security {
      webhook_signature required
    }
    
    preconditions {
      verify_webhook_signature(input.signature, input.payload)
    }`,
    },
  };
}

/**
 * Generate autofix for adding signature input field
 */
function generateSignatureInputFix(behavior: Behavior): ASTFix {
  return {
    description: `Add signature field to '${behavior.name.name}' input`,
    operation: 'add',
    targetKind: 'Field',
    location: behavior.input.location,
    patch: {
      position: 'inside',
      text: `signature: String`,
      insert: {
        kind: 'Field',
        name: { kind: 'Identifier', name: 'signature' },
      },
    },
  };
}

/**
 * Webhook Signature Required Rule
 */
export const webhookSignatureRequiredRule: PolicyRule = {
  id: 'SEC-WEBHOOK-001',
  name: 'Webhook Signature Required',
  category: 'webhook-security',
  severity: 'error',
  description: 'Webhook handlers must verify request signatures',
  
  check: (context: RuleContext): Finding[] => {
    const findings: Finding[] = [];
    const { domain, behavior } = context;

    const behaviorsToCheck = behavior ? [behavior] : domain.behaviors;

    for (const b of behaviorsToCheck) {
      if (isWebhookBehavior(b)) {
        if (!hasSignatureVerification(b)) {
          findings.push({
            id: 'SEC-WEBHOOK-001',
            category: 'webhook-security',
            severity: 'error',
            title: 'Missing Webhook Signature Verification',
            message: `Webhook behavior '${b.name.name}' does not verify request signatures`,
            location: b.location,
            behaviorName: b.name.name,
            suggestion: 'Add signature verification in security block or preconditions',
            autofix: generateSignatureVerificationFix(b),
          });
        }

        if (!hasSignatureInput(b)) {
          findings.push({
            id: 'SEC-WEBHOOK-001',
            category: 'webhook-security',
            severity: 'warning',
            title: 'Missing Signature Input Field',
            message: `Webhook behavior '${b.name.name}' should have a signature input field`,
            location: b.input.location,
            behaviorName: b.name.name,
            suggestion: 'Add signature: String field to input',
            autofix: generateSignatureInputFix(b),
          });
        }
      }
    }

    return findings;
  },
};

/**
 * Webhook Must Have Idempotency Rule
 */
export const webhookIdempotencyRule: PolicyRule = {
  id: 'SEC-WEBHOOK-002',
  name: 'Webhook Must Be Idempotent',
  category: 'webhook-security',
  severity: 'warning',
  description: 'Webhook handlers should be idempotent to handle retries safely',
  
  check: (context: RuleContext): Finding[] => {
    const findings: Finding[] = [];
    const { domain, behavior } = context;

    const behaviorsToCheck = behavior ? [behavior] : domain.behaviors;

    for (const b of behaviorsToCheck) {
      if (isWebhookBehavior(b)) {
        // Check for idempotency key in input
        const hasIdempotencyKey = b.input.fields.some(
          f => /idempotency/i.test(f.name.name) || 
               /event[_-]?id/i.test(f.name.name) ||
               /request[_-]?id/i.test(f.name.name) ||
               /delivery[_-]?id/i.test(f.name.name)
        );

        // Check for idempotency in preconditions
        const preconditionStr = b.preconditions
          .map(p => JSON.stringify(p))
          .join(' ');
        const hasIdempotencyCheck = preconditionStr.includes('idempoten') ||
                                    preconditionStr.includes('already_processed') ||
                                    preconditionStr.includes('duplicate');

        if (!hasIdempotencyKey && !hasIdempotencyCheck) {
          findings.push({
            id: 'SEC-WEBHOOK-002',
            category: 'webhook-security',
            severity: 'warning',
            title: 'Webhook Missing Idempotency',
            message: `Webhook behavior '${b.name.name}' should implement idempotency for safe retry handling`,
            location: b.location,
            behaviorName: b.name.name,
            suggestion: 'Add event_id field and check for duplicate processing',
            autofix: {
              description: `Add idempotency to '${b.name.name}'`,
              operation: 'add',
              targetKind: 'Field',
              location: b.input.location,
              patch: {
                position: 'inside',
                text: `event_id: String [unique]
    
    preconditions {
      not already_processed(input.event_id)
    }`,
              },
            },
          });
        }
      }
    }

    return findings;
  },
};

/**
 * Webhook Replay Protection Rule
 */
export const webhookReplayProtectionRule: PolicyRule = {
  id: 'SEC-WEBHOOK-003',
  name: 'Webhook Replay Protection',
  category: 'webhook-security',
  severity: 'warning',
  description: 'Webhook handlers should validate timestamp to prevent replay attacks',
  
  check: (context: RuleContext): Finding[] => {
    const findings: Finding[] = [];
    const { domain, behavior } = context;

    const behaviorsToCheck = behavior ? [behavior] : domain.behaviors;

    for (const b of behaviorsToCheck) {
      if (isWebhookBehavior(b)) {
        // Check for timestamp validation
        const hasTimestampField = b.input.fields.some(
          f => /timestamp/i.test(f.name.name) || /time/i.test(f.name.name)
        );

        const preconditionStr = b.preconditions
          .map(p => JSON.stringify(p))
          .join(' ');
        const hasTimestampValidation = preconditionStr.includes('timestamp') &&
                                       (preconditionStr.includes('within') ||
                                        preconditionStr.includes('fresh') ||
                                        preconditionStr.includes('valid'));

        if (!hasTimestampField || !hasTimestampValidation) {
          findings.push({
            id: 'SEC-WEBHOOK-003',
            category: 'webhook-security',
            severity: 'warning',
            title: 'Webhook Missing Replay Protection',
            message: `Webhook behavior '${b.name.name}' should validate timestamp to prevent replay attacks`,
            location: b.location,
            behaviorName: b.name.name,
            suggestion: 'Add timestamp field and validate it is within acceptable window (e.g., 5 minutes)',
            autofix: {
              description: `Add replay protection to '${b.name.name}'`,
              operation: 'add',
              targetKind: 'Field',
              location: b.input.location,
              patch: {
                position: 'inside',
                text: `timestamp: Timestamp
    
    preconditions {
      input.timestamp within 5.minutes of now()
    }`,
              },
            },
          });
        }
      }
    }

    return findings;
  },
};

export const webhookSecurityPolicies: PolicyRule[] = [
  webhookSignatureRequiredRule,
  webhookIdempotencyRule,
  webhookReplayProtectionRule,
];
