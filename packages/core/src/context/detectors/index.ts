/**
 * Context Detectors
 * 
 * Export all detection utilities for repository context extraction.
 */

export { detectStack, type StackDetectionResult } from './stackDetector.js';
export { detectFrameworks, type FrameworkDetection } from './frameworkDetector.js';
export { 
  detectDatabases, 
  extractEntities,
  extractPrismaEntities,
  extractMongooseEntities,
  extractTypeORMEntities,
  type DatabaseDetection,
} from './databaseDetector.js';
export { detectAuth, scanForAuthPatterns, type AuthDetection } from './authDetector.js';
export { detectKeyFiles, prioritizeKeyFiles } from './keyFilesDetector.js';
