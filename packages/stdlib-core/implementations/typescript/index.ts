// ============================================================================
// ISL Standard Library - TypeScript Entry Point
// @stdlib/core
// ============================================================================

// Re-export all modules
export * from './primitives.js';
export * from './validation.js';
export * from './time.js';
export * from './geo.js';
// Re-export ids module excluding duplicates from primitives
// Types need separate export for isolatedModules compatibility
export type {
  UUIDv7,
  CompactUUID,
  KSUID,
  NanoID,
  ObjectId,
  SnowflakeId,
  Cursor,
} from './ids.js';
// Values
export {
  ID_PATTERNS,
  isValidUUIDAny,
  isValidCompactUUID,
  isValidKSUID,
  isValidNanoID,
  isValidHumanCode,
  isValidObjectId,
  isValidSnowflakeId,
  isValidEAN13,
  isValidUPCA,
  isValidISBN13,
  isValidISBN10,
  isValidDOI,
  isValidORCID,
  isValidStripeCustomerId,
  isValidStripePaymentIntentId,
  isValidStripeSubscriptionId,
  isValidARN,
  isValidGitHubRepo,
  isValidK8sName,
  isValidAPIKey,
  generateUUID,
  generateULID,
  generateShortId,
  generateHumanCode,
  uuidToCompact,
  compactToUUID,
  uuidToBytes,
  bytesToUUID,
  ulidToTimestamp,
  ulidToDate,
  snowflakeToTimestamp,
  snowflakeToDate,
} from './ids.js';

// Re-export default objects
export { default as Primitives } from './primitives.js';
export { default as Validation } from './validation.js';
export { default as Time } from './time.js';
export { default as Geo } from './geo.js';
export { default as Ids } from './ids.js';

// Convenience namespace export
import Primitives from './primitives.js';
import Validation from './validation.js';
import Time from './time.js';
import Geo from './geo.js';
import Ids from './ids.js';

export const StdLib = {
  Primitives,
  Validation,
  Time,
  Geo,
  Ids,
};

export default StdLib;
