/**
 * Context Extractor Module
 * 
 * Provides utilities for extracting context from a repository
 * to provide relevant information to the ISL translator.
 */

// Main extraction function
export { extractContext, extractContextQuick } from './extractContext.js';

// Types
export type {
  ContextPack,
  ExtractContextOptions,
  StackInfo,
  StackLanguage,
  Runtime,
  WebFramework,
  DatabaseTech,
  AuthApproach,
  DetectedEntity,
  DetectedField,
  KeyFile,
  PolicySuggestion,
  Confidence,
} from './contextTypes.js';

export { DEFAULT_EXTRACT_OPTIONS } from './contextTypes.js';

// Individual detectors (for advanced usage)
export {
  detectStack,
  detectFrameworks,
  detectDatabases,
  detectAuth,
  detectKeyFiles,
  extractEntities,
  extractPrismaEntities,
  extractMongooseEntities,
  extractTypeORMEntities,
  prioritizeKeyFiles,
} from './detectors/index.js';
