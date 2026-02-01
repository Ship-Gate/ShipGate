// ============================================================================
// Edge Runtime - Public API
// ============================================================================

// Core runtime
export {
  ISLEdgeRuntime,
  createEdgeRuntime,
  defineBehavior,
} from './runtime';

// Types
export type {
  EdgePlatform,
  EdgeRuntimeOptions,
  EdgeTracer,
  EdgeSpan,
  SpanOptions,
  EdgeKVStore,
  KVPutOptions,
  KVListOptions,
  KVListResult,
  EdgeDurableObjectConfig,
  EdgeRequestContext,
  EdgeGeoInfo,
  CloudflareProperties,
  EdgeResponse,
  EdgeBehaviorDefinition,
  EdgeBehaviorHandler,
  EdgeVerificationResult,
  EdgeCheckResult,
} from './types';

export { DEFAULT_OPTIONS } from './types';

// Platform-specific exports are in separate entry points:
// - @intentos/edge-runtime/cloudflare
// - @intentos/edge-runtime/deno
// - @intentos/edge-runtime/vercel
