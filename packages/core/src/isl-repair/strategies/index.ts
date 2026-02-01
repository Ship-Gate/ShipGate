/**
 * ISL Repair Strategies Index
 *
 * Exports all available repair strategies.
 */

export { missingFieldsStrategy } from './missingFields.js';
export { normalizeOrderStrategy } from './normalizeOrder.js';
export { schemaFixStrategy } from './schemaFix.js';

import { missingFieldsStrategy } from './missingFields.js';
import { normalizeOrderStrategy } from './normalizeOrder.js';
import { schemaFixStrategy } from './schemaFix.js';
import type { RepairStrategy } from '../types.js';

/**
 * All available repair strategies in recommended execution order.
 *
 * Order matters:
 * 1. Missing fields first - ensures structure is complete
 * 2. Schema fixes - corrects types and values
 * 3. Normalize order last - final cleanup
 */
export const defaultStrategies: RepairStrategy[] = [
  missingFieldsStrategy,
  schemaFixStrategy,
  normalizeOrderStrategy,
];
