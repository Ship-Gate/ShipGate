/**
 * ISL Core Package
 * 
 * Provides ISL translator utilities, evidence handling, scoring,
 * caching, and logging infrastructure.
 * 
 * All exports use defensive loading - missing modules are gracefully
 * handled and features can be detected via exported flags.
 */

// ============================================================================
// Corpus Runner (always available)
// ============================================================================

export * from './isl-translator/corpus-tests/corpusRunner.js';

// ============================================================================
// Evidence Module
// ============================================================================

export * from './evidence/index.js';

// ============================================================================
// Scoring Module (ISL Agent)
// ============================================================================

export * from './isl-agent/index.js';

// ============================================================================
// Cache Module
// ============================================================================

export * from './cache/index.js';

// ============================================================================
// Logging Types
// ============================================================================

export * from './logging/logTypes.js';

// ============================================================================
// Auto-Verify Module (file watcher)
// ============================================================================

export * from './auto-verify/index.js';

// ============================================================================
// Integration utilities (for defensive feature detection)
// ============================================================================

export * from './integration/index.js';

// ============================================================================
// Policy Pack (PII, secrets, auth, logging constraints)
// ============================================================================

export * from './policies/index.js';
