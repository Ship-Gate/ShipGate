/**
 * Subscription lifecycle state machine.
 * Prevents invalid transitions at runtime.
 */

import { SubscriptionStatus } from '../types.js';
import { InvalidTransitionError } from '../errors.js';

// ============================================================================
// VALID TRANSITIONS MAP
// ============================================================================

const VALID_TRANSITIONS: ReadonlyMap<SubscriptionStatus, ReadonlySet<SubscriptionStatus>> = new Map([
  [SubscriptionStatus.INCOMPLETE, new Set([
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.CANCELED,
  ])],
  [SubscriptionStatus.TRIALING, new Set([
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.PAST_DUE,
    SubscriptionStatus.CANCELED,
  ])],
  [SubscriptionStatus.ACTIVE, new Set([
    SubscriptionStatus.PAST_DUE,
    SubscriptionStatus.CANCELED,
    SubscriptionStatus.PAUSED,
  ])],
  [SubscriptionStatus.PAST_DUE, new Set([
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.CANCELED,
    SubscriptionStatus.UNPAID,
  ])],
  [SubscriptionStatus.UNPAID, new Set([
    SubscriptionStatus.CANCELED,
  ])],
  [SubscriptionStatus.PAUSED, new Set([
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.CANCELED,
  ])],
  [SubscriptionStatus.CANCELED, new Set<SubscriptionStatus>()],
]);

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Returns true if transitioning from `from` to `to` is allowed.
 */
export function canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  const allowed = VALID_TRANSITIONS.get(from);
  return allowed !== undefined && allowed.has(to);
}

/**
 * Assert a transition is valid. Throws InvalidTransitionError if not.
 */
export function assertTransition(from: SubscriptionStatus, to: SubscriptionStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to, 'Subscription');
  }
}

/**
 * Get all statuses reachable from the given status.
 */
export function allowedTransitions(from: SubscriptionStatus): SubscriptionStatus[] {
  const allowed = VALID_TRANSITIONS.get(from);
  return allowed ? Array.from(allowed) : [];
}

/**
 * Returns true if the status is a terminal (no outgoing transitions).
 */
export function isTerminal(status: SubscriptionStatus): boolean {
  return allowedTransitions(status).length === 0;
}

/**
 * Returns true if the subscription is considered "active" for access purposes.
 */
export function isActiveStatus(status: SubscriptionStatus): boolean {
  return (
    status === SubscriptionStatus.ACTIVE ||
    status === SubscriptionStatus.TRIALING ||
    status === SubscriptionStatus.PAST_DUE
  );
}
