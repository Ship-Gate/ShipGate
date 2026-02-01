/**
 * @intentos/api-versioning
 * 
 * API versioning system that integrates with ISL domain versions.
 */

// Main API
export { Versioning, createVersioning, getVersioning } from './versioning.js';

// Types
export * from './types.js';

// Migration
export { diffDomains } from './migration/differ.js';
export { 
  createRequestTransformer, 
  createResponseTransformer, 
  createTransformer,
} from './migration/transformer.js';
export { generateTransformers, transformerKey } from './migration/generator.js';

// Strategies
export { 
  extractVersionFromUrl, 
  buildVersionedUrl, 
  stripVersionFromUrl,
  urlStrategy,
} from './strategies/url.js';
export { 
  extractVersionFromHeader, 
  buildVersionedHeaders,
  buildVersionedAcceptHeader,
  headerStrategy,
} from './strategies/header.js';
export { 
  extractVersionFromQuery, 
  buildVersionedQueryUrl,
  stripVersionFromQuery,
  queryStrategy,
} from './strategies/query.js';

// Compatibility
export { 
  checkCompatibility, 
  isBreakingChangeType,
  suggestMigrationStrategy,
} from './compatibility/checker.js';
export { generateReport, generateSummary } from './compatibility/report.js';

// Middleware (re-export for convenience)
export { versioningMiddleware, versionRouter } from './middleware/express.js';
export { versioningPlugin } from './middleware/fastify.js';
