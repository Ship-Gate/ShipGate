// ============================================================================
// ISL Discovery Engine - Public API
// ============================================================================

export { discover } from './discovery-engine.js';
export { extractISLSymbols } from './isl-extractor.js';
export { scanCodebase } from './code-scanner.js';
export { matchSymbols } from './matcher.js';
export { toBindingsFile, writeBindingsFile, readBindingsFile } from './bindings-format.js';

export type {
  ISLSymbol,
  CodeSymbol,
  Binding,
  Evidence,
  DiscoveryStrategy,
  DiscoveryResult,
  DiscoveryOptions,
  BindingsFile,
  BindingEntry,
} from './types.js';
