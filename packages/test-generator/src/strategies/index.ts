// ============================================================================
// Domain Strategies Index
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type { DomainStrategy, DomainType } from '../types';
import { AuthStrategy } from './auth';
import { PaymentsStrategy } from './payments';
import { UploadsStrategy } from './uploads';
import { WebhooksStrategy } from './webhooks';
import { GenericStrategy } from './generic';

// Re-export all strategies
export { BaseDomainStrategy } from './base';
export { AuthStrategy } from './auth';
export { PaymentsStrategy } from './payments';
export { UploadsStrategy } from './uploads';
export { WebhooksStrategy } from './webhooks';
export { GenericStrategy } from './generic';

/**
 * All available domain strategies in priority order
 * More specific strategies should come first
 */
const strategies: DomainStrategy[] = [
  new AuthStrategy(),
  new PaymentsStrategy(),
  new UploadsStrategy(),
  new WebhooksStrategy(),
  new GenericStrategy(), // Fallback
];

/**
 * Get the appropriate strategy for a behavior
 * 
 * @param behavior - The behavior to find a strategy for
 * @param domain - The domain containing the behavior
 * @param forceDomain - Optionally force a specific domain strategy
 */
export function getStrategy(
  behavior: AST.Behavior,
  domain: AST.Domain,
  forceDomain?: DomainType
): DomainStrategy {
  // If forced, find and return that strategy
  if (forceDomain) {
    const forced = strategies.find(s => s.domain === forceDomain);
    if (forced) return forced;
  }

  // Otherwise, find first matching strategy
  for (const strategy of strategies) {
    if (strategy.matches(behavior, domain)) {
      return strategy;
    }
  }

  // Should never reach here due to GenericStrategy fallback
  return strategies[strategies.length - 1]!;
}

/**
 * Get all available strategies
 */
export function getAllStrategies(): DomainStrategy[] {
  return [...strategies];
}

/**
 * Register a custom strategy (inserts before generic fallback)
 */
export function registerStrategy(strategy: DomainStrategy): void {
  // Insert before the generic fallback
  const genericIndex = strategies.findIndex(s => s.domain === 'generic');
  if (genericIndex !== -1) {
    strategies.splice(genericIndex, 0, strategy);
  } else {
    strategies.push(strategy);
  }
}

/**
 * Detect the domain type for a given behavior
 */
export function detectDomain(
  behavior: AST.Behavior,
  domain: AST.Domain
): DomainType {
  const strategy = getStrategy(behavior, domain);
  return strategy.domain;
}
