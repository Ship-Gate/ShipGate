// ============================================================================
// Webhooks Domain Strategy
// Generates assertions for webhook handling behaviors
// ============================================================================

import type * as AST from '@isl-lang/parser';
import { BaseDomainStrategy } from './base';
import type {
  DomainType,
  GeneratedAssertion,
  StrategyContext,
} from '../types';

/**
 * Strategy for generating webhook domain tests
 * 
 * Supported patterns:
 * - Signature valid precondition
 * - Replay protection (scaffolds)
 * - Event type validation
 * - Delivery attempt handling
 */
export class WebhooksStrategy extends BaseDomainStrategy {
  domain: DomainType = 'webhooks';

  matches(behavior: AST.Behavior, domain: AST.Domain): boolean {
    // Check domain name
    if (this.domainNameMatches(domain, ['webhook', 'callback', 'event', 'notification'])) {
      return true;
    }

    // Check behavior name patterns
    if (this.behaviorNameMatches(behavior, [
      'webhook', 'callback', 'notify', 'event', 'hook',
      'receive', 'process', 'handle', 'deliver'
    ])) {
      return true;
    }

    // Check for webhook-related input fields
    const inputFields = behavior.input.fields.map(f => f.name.name.toLowerCase());
    return inputFields.some(f => 
      ['signature', 'payload', 'event_type', 'webhook_id', 'timestamp'].includes(f)
    );
  }

  generatePreconditionAssertions(
    precondition: AST.Expression,
    behavior: AST.Behavior,
    _context: StrategyContext
  ): GeneratedAssertion[] {
    const assertions: GeneratedAssertion[] = [];

    // Pattern: signature validation
    if (this.isSignatureValidation(precondition)) {
      assertions.push(this.supported(
        `// Verify webhook signature\nconst expectedSignature = computeHmacSignature(input.payload, webhookSecret);\nexpect(input.signature).toBeDefined();\nexpect(verifySignature(input.signature, expectedSignature)).toBe(true);`,
        'Webhook signature must be valid',
        'webhook.signature_valid'
      ));

      assertions.push(this.supported(
        `// Test invalid signature rejection\nconst invalidSignatureInput = { ...validInput, signature: 'invalid_signature' };\nconst result = await ${behavior.name.name}(invalidSignatureInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('INVALID_SIGNATURE');`,
        'Should reject invalid signatures',
        'webhook.signature_valid'
      ));

      assertions.push(this.supported(
        `// Test missing signature rejection\nconst noSignatureInput = { ...validInput, signature: undefined };\nconst result = await ${behavior.name.name}(noSignatureInput);\nexpect(result.success).toBe(false);`,
        'Should reject missing signatures',
        'webhook.signature_valid'
      ));
    }

    // Pattern: timestamp/replay protection
    if (this.isTimestampValidation(precondition)) {
      assertions.push(this.needsImpl(
        `// SCAFFOLD: Replay protection - verify timestamp is recent\nconst maxAge = 5 * 60 * 1000; // 5 minutes\nconst webhookTimestamp = new Date(input.timestamp).getTime();\nconst now = Date.now();\nexpect(now - webhookTimestamp).toBeLessThan(maxAge);`,
        'Webhook timestamp must be recent (replay protection)',
        'webhook.replay_protection',
        'Configure appropriate timestamp tolerance for your use case'
      ));

      assertions.push(this.needsImpl(
        `// SCAFFOLD: Test old timestamp rejection\nconst oldTimestampInput = { ...validInput, timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString() };\nconst result = await ${behavior.name.name}(oldTimestampInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('REPLAY_ATTACK');`,
        'Should reject old timestamps',
        'webhook.replay_protection',
        'Adjust timestamp tolerance based on your requirements'
      ));
    }

    // Pattern: event type validation
    if (this.isEventTypeValidation(precondition)) {
      assertions.push(this.supported(
        `const supportedEventTypes = ['payment.completed', 'payment.failed', 'subscription.created', 'subscription.cancelled'];\nexpect(supportedEventTypes).toContain(input.event_type);`,
        'Event type must be supported',
        'webhook.event_type'
      ));

      assertions.push(this.supported(
        `const unknownEventInput = { ...validInput, event_type: 'unknown.event' };\nconst result = await ${behavior.name.name}(unknownEventInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('UNSUPPORTED_EVENT_TYPE');`,
        'Should reject unknown event types',
        'webhook.event_type'
      ));
    }

    // Pattern: idempotency check (webhook_id)
    if (this.isIdempotencyCheck(precondition)) {
      assertions.push(this.needsImpl(
        `// SCAFFOLD: Check webhook hasn't been processed before\nconst existingWebhook = await WebhookLog.findByWebhookId(input.webhook_id);\nexpect(existingWebhook).toBeNull();`,
        'Webhook should not have been processed before',
        'webhook.replay_protection',
        'Implement WebhookLog.findByWebhookId in your test runtime'
      ));
    }

    // Pattern: payload structure validation
    if (this.isPayloadValidation(precondition)) {
      assertions.push(this.supported(
        `expect(input.payload).toBeDefined();\nexpect(typeof input.payload).toBe('object');`,
        'Payload must be valid object',
        'generic.precondition'
      ));
    }

    // Generic precondition if no specific pattern matched
    if (assertions.length === 0) {
      const exprStr = this.compileExpr(precondition);
      assertions.push(this.supported(
        `expect(${exprStr}).toBe(true);`,
        `Precondition: ${exprStr}`,
        'generic.precondition'
      ));
    }

    return assertions;
  }

  generatePostconditionAssertions(
    postcondition: AST.PostconditionBlock,
    _behavior: AST.Behavior,
    _context: StrategyContext
  ): GeneratedAssertion[] {
    const assertions: GeneratedAssertion[] = [];
    const condition = this.getConditionName(postcondition.condition);

    for (const predicate of postcondition.predicates) {
      // Pattern: webhook logged
      if (this.isWebhookLogged(predicate)) {
        assertions.push(this.supported(
          `const webhookLog = await WebhookLog.findByWebhookId(input.webhook_id);\nexpect(webhookLog).toBeDefined();\nexpect(webhookLog.processed).toBe(true);`,
          'Webhook should be logged as processed',
          'webhook.replay_protection'
        ));
      }

      // Pattern: event processed
      if (this.isEventProcessed(predicate)) {
        assertions.push(this.supported(
          `expect(result.processed).toBe(true);\nexpect(result.event_id).toEqual(input.webhook_id);`,
          'Event should be marked as processed',
          'webhook.event_type'
        ));
      }

      // Pattern: side effects triggered
      if (this.isSideEffectTriggered(predicate)) {
        const action = this.extractAction(predicate);
        assertions.push(this.supported(
          `// Verify the appropriate action was taken based on event type\nconst actionResult = await verifyActionTaken(input.event_type, input.payload);\nexpect(actionResult.success).toBe(true);`,
          `Side effect for ${action || 'event'} should be triggered`,
          'generic.postcondition'
        ));
      }

      // Pattern: delivery attempt recorded
      if (this.isDeliveryAttemptRecorded(predicate)) {
        assertions.push(this.needsImpl(
          `// SCAFFOLD: Verify delivery attempt was recorded\nconst attempts = await DeliveryAttempt.findByWebhookId(input.webhook_id);\nexpect(attempts.length).toBeGreaterThan(0);\nexpect(attempts[attempts.length - 1].status).toBe('SUCCESS');`,
          'Delivery attempt should be recorded',
          'webhook.delivery_attempt',
          'Implement DeliveryAttempt tracking in your webhook handler'
        ));
      }

      // Pattern: retry scheduled (for failures)
      if (condition !== 'success' && this.isRetryScheduled(predicate)) {
        assertions.push(this.needsImpl(
          `// SCAFFOLD: Verify retry was scheduled\nconst scheduledRetry = await RetryQueue.findByWebhookId(input.webhook_id);\nexpect(scheduledRetry).toBeDefined();\nexpect(scheduledRetry.nextAttemptAt).toBeDefined();`,
          'Retry should be scheduled on failure',
          'webhook.delivery_attempt',
          'Implement retry scheduling in your webhook handler'
        ));
      }

      // Pattern: acknowledgment returned
      if (this.isAcknowledgmentReturned(predicate)) {
        assertions.push(this.supported(
          `expect(result.acknowledged).toBe(true);\nexpect(result.status).toBe(200);`,
          'Webhook should be acknowledged',
          'generic.postcondition'
        ));
      }
    }

    // If no specific patterns matched, generate generic assertions
    if (assertions.length === 0) {
      for (const predicate of postcondition.predicates) {
        const exprStr = this.compileExpr(predicate);
        assertions.push(this.supported(
          `expect(${exprStr}).toBe(true);`,
          `Postcondition (${condition}): ${this.truncate(exprStr, 50)}`,
          'generic.postcondition'
        ));
      }
    }

    return assertions;
  }

  generateErrorAssertions(
    errorSpec: AST.ErrorSpec,
    behavior: AST.Behavior,
    _context: StrategyContext
  ): GeneratedAssertion[] {
    const assertions: GeneratedAssertion[] = [];
    const errorName = errorSpec.name.name;
    const when = errorSpec.when?.value || 'specific conditions';

    switch (errorName) {
      case 'INVALID_SIGNATURE':
        assertions.push(this.supported(
          `const tamperedPayloadInput = { ...validInput, payload: { ...validInput.payload, amount: 999999 } };\nconst result = await ${behavior.name.name}(tamperedPayloadInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('INVALID_SIGNATURE');\nexpect(result.retriable).toBe(false);`,
          'Should return INVALID_SIGNATURE for tampered payloads',
          'webhook.signature_valid'
        ));

        assertions.push(this.supported(
          `const wrongSecretSignature = computeHmacSignature(validInput.payload, 'wrong_secret');\nconst result = await ${behavior.name.name}({ ...validInput, signature: wrongSecretSignature });\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('INVALID_SIGNATURE');`,
          'Should return INVALID_SIGNATURE for wrong secret',
          'webhook.signature_valid'
        ));
        break;

      case 'REPLAY_ATTACK':
      case 'DUPLICATE_WEBHOOK':
        assertions.push(this.needsImpl(
          `// SCAFFOLD: First process the webhook\nawait ${behavior.name.name}(validInput);\n\n// Then try to process again\nconst result = await ${behavior.name.name}(validInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('${errorName}');`,
          `Should return ${errorName} for duplicate webhooks`,
          'webhook.replay_protection',
          'Ensure your implementation tracks processed webhook IDs'
        ));
        break;

      case 'TIMESTAMP_EXPIRED':
      case 'STALE_WEBHOOK':
        assertions.push(this.needsImpl(
          `// SCAFFOLD: Webhook with old timestamp\nconst oldTimestamp = new Date(Date.now() - 15 * 60 * 1000).toISOString();\nconst oldInput = { ...validInput, timestamp: oldTimestamp, signature: computeSignatureWithTimestamp(oldTimestamp) };\nconst result = await ${behavior.name.name}(oldInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('${errorName}');`,
          `Should return ${errorName} for old timestamps`,
          'webhook.replay_protection',
          'Configure appropriate timestamp tolerance'
        ));
        break;

      case 'UNSUPPORTED_EVENT_TYPE':
        assertions.push(this.supported(
          `const unknownEventInput = { ...validInput, event_type: 'unknown.event.type' };\nconst result = await ${behavior.name.name}(unknownEventInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('UNSUPPORTED_EVENT_TYPE');\nexpect(result.retriable).toBe(false);`,
          'Should return UNSUPPORTED_EVENT_TYPE for unknown events',
          'webhook.event_type'
        ));
        break;

      case 'PROCESSING_FAILED':
        assertions.push(this.supported(
          `// Mock internal processing to fail\nconst result = await ${behavior.name.name}(validInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('PROCESSING_FAILED');\nexpect(result.retriable).toBe(true);`,
          'Should return PROCESSING_FAILED for internal errors',
          'webhook.delivery_attempt'
        ));
        break;

      case 'RATE_LIMITED':
        assertions.push(this.supported(
          `// Send many webhooks rapidly\nconst results = await Promise.all(\n  Array(100).fill(null).map(() => ${behavior.name.name}(validInput))\n);\nconst rateLimited = results.filter(r => r.error === 'RATE_LIMITED');\nexpect(rateLimited.length).toBeGreaterThan(0);`,
          'Should return RATE_LIMITED when threshold exceeded',
          'generic.postcondition'
        ));
        break;

      default:
        assertions.push(this.supported(
          `const result = await ${behavior.name.name}(inputFor${errorName}());\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('${errorName}');\nexpect(result.retriable).toBe(${errorSpec.retriable});`,
          `Should return ${errorName} when ${when}`,
          'generic.postcondition'
        ));
    }

    return assertions;
  }

  // ============================================================================
  // PATTERN DETECTION HELPERS
  // ============================================================================

  private isSignatureValidation(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('signature') && (str.includes('valid') || str.includes('verify'));
  }

  private isTimestampValidation(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('timestamp') && (str.includes('<') || str.includes('recent') || str.includes('age'));
  }

  private isEventTypeValidation(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('event_type') || str.includes('event type');
  }

  private isIdempotencyCheck(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return (str.includes('webhook_id') || str.includes('idempotency')) && str.includes('exists');
  }

  private isPayloadValidation(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('payload') && (str.includes('valid') || str.includes('defined'));
  }

  private isWebhookLogged(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('webhook') && (str.includes('log') || str.includes('record'));
  }

  private isEventProcessed(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('processed') || (str.includes('event') && str.includes('handled'));
  }

  private isSideEffectTriggered(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('action') || str.includes('trigger') || str.includes('handler');
  }

  private extractAction(expr: AST.Expression): string | null {
    const str = this.compileExpr(expr);
    const match = str.match(/action:\s*['"](\w+)['"]/);
    return match?.[1] ?? null;
  }

  private isDeliveryAttemptRecorded(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('delivery') || str.includes('attempt');
  }

  private isRetryScheduled(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('retry') || str.includes('schedule');
  }

  private isAcknowledgmentReturned(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('acknowledge') || str.includes('ack') || str.includes('200');
  }

  private getConditionName(condition: AST.Identifier | 'success' | 'any_error'): string {
    if (condition === 'success') return 'success';
    if (condition === 'any_error') return 'any error';
    return condition.name;
  }

  private truncate(str: string, maxLen: number): string {
    return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str;
  }
}
