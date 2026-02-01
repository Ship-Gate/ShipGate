/**
 * Test Generation Strategies
 * 
 * Domain-specific test generation strategies for common patterns.
 */

export { oauthStrategy } from './oauth.js';
export { paymentsStrategy } from './payments.js';
export { uploadsStrategy } from './uploads.js';

import { oauthStrategy } from './oauth.js';
import { paymentsStrategy } from './payments.js';
import { uploadsStrategy } from './uploads.js';
import type { TestGenerationStrategy } from '../testGenTypes.js';

/**
 * All available strategies
 */
export const allStrategies: TestGenerationStrategy[] = [
  oauthStrategy,
  paymentsStrategy,
  uploadsStrategy,
];

/**
 * Get a strategy by ID
 */
export function getStrategy(id: string): TestGenerationStrategy | undefined {
  return allStrategies.find(s => s.id === id);
}

/**
 * Get strategies that apply to a domain
 */
export function getStrategiesForDomain(domainName: string): TestGenerationStrategy[] {
  return allStrategies.filter(s => 
    s.appliesTo.some(pattern => 
      domainName.toLowerCase().includes(pattern.toLowerCase()) ||
      pattern.toLowerCase().includes(domainName.toLowerCase())
    )
  );
}
