/**
 * @packageDocumentation
 * @isl-lang/stdlib-core
 */

// ============================================================================
// RE-EXPORT ALL MODULES
// ============================================================================

// Core primitives - emails, phones, URLs, money, etc.
export * from './primitives.js';

// Identifier types - UUID, ULID, NanoID, etc.
export * from './ids.js';

// Geographic types - addresses, coordinates, distances
export * from './geo.js';

// Time types - durations, dates, timestamps
export * from './time.js';

// Validation framework
export * from './validation.js';

// ============================================================================
// CONVENIENCE NAMESPACE EXPORTS
// ============================================================================

import Primitives from './primitives.js';
import Ids from './ids.js';
import Geo from './geo.js';
import Time from './time.js';
import Validation from './validation.js';

// Export default objects for convenience
export { default as Primitives } from './primitives.js';
export { default as Ids } from './ids.js';
export { default as Geo } from './geo.js';
export { default as Time } from './time.js';
export { default as Validation } from './validation.js';

// Unified namespace
export const StdLib = {
  Primitives,
  Ids,
  Geo,
  Time,
  Validation,
};

export default StdLib;
