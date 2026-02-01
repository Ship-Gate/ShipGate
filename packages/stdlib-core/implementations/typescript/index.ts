// ============================================================================
// ISL Standard Library - TypeScript Entry Point
// @stdlib/core
// ============================================================================

// Re-export all modules
export * from './primitives';
export * from './validation';
export * from './time';
export * from './geo';
export * from './ids';

// Re-export default objects
export { default as Primitives } from './primitives';
export { default as Validation } from './validation';
export { default as Time } from './time';
export { default as Geo } from './geo';
export { default as Ids } from './ids';

// Convenience namespace export
import Primitives from './primitives';
import Validation from './validation';
import Time from './time';
import Geo from './geo';
import Ids from './ids';

export const StdLib = {
  Primitives,
  Validation,
  Time,
  Geo,
  Ids,
};

export default StdLib;
