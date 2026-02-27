/**
 * Truthpack v2 Schema
 *
 * Canonical "project reality snapshot" that every verifier/codegen uses.
 * Includes routes, env vars, db schema hints, auth model, deps graph, runtime probes,
 * and provenance information.
 */

import * as crypto from 'crypto';

// ── Core Fact Types ───────────────────────────────────────────────────────────

/**
 * Route definition with confidence scoring
 */
export interface TruthpackRoute {
  /** HTTP path pattern (e.g., "/api/users/:id") */
  path: string;
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** Handler function name or identifier */
  handler: string;
  /** Source file path (relative to repo root) */
  file: string;
  /** Line number where route is defined */
  line: number;
  /** Path parameters (e.g., ["id"]) */
  parameters: string[];
  /** Middleware names applied to this route */
  middleware: string[];
  /** Authentication requirements */
  auth?: {
    required: boolean;
    /** Auth method (e.g., "bearer", "session", "api-key") */
    method?: string;
    /** Required roles/permissions */
    roles?: string[];
  };
  /** Confidence score (0-1) for this extraction */
  confidence: number;
  /** Framework adapter that detected this route */
  adapter: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Environment variable definition
 */
export interface TruthpackEnvVar {
  /** Variable name */
  name: string;
  /** File where it's referenced */
  file: string;
  /** Line number */
  line: number;
  /** Whether a default value exists */
  hasDefault: boolean;
  /** Default value if present */
  defaultValue?: string;
  /** Whether this var is required */
  required: boolean;
  /** Whether this contains sensitive data */
  sensitive: boolean;
  /** Variable type hint (e.g., "string", "number", "boolean", "url") */
  typeHint?: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** How this was detected */
  source: 'process.env' | 'import.meta.env' | 'config-file' | 'dockerfile' | 'heuristic';
}

/**
 * Database schema hint
 */
export interface TruthpackDbSchema {
  /** Database type (e.g., "postgresql", "mysql", "sqlite", "mongodb") */
  type: string;
  /** Connection string pattern or env var name */
  connectionEnv?: string;
  /** Detected tables/collections */
  tables: TruthpackDbTable[];
  /** ORM hints (e.g., "prisma", "typeorm", "sequelize") */
  orm?: string;
  /** Schema file path if detected */
  schemaFile?: string;
  /** Confidence score */
  confidence: number;
}

export interface TruthpackDbTable {
  /** Table/collection name */
  name: string;
  /** Detected columns/fields */
  columns: TruthpackDbColumn[];
  /** Source file where detected */
  sourceFile?: string;
}

export interface TruthpackDbColumn {
  /** Column/field name */
  name: string;
  /** Type hint */
  type?: string;
  /** Whether nullable */
  nullable?: boolean;
  /** Whether primary key */
  primaryKey?: boolean;
}

/**
 * Auth model definition
 */
export interface TruthpackAuthModel {
  /** Auth provider (e.g., "jwt", "session", "oauth", "api-key", "clerk") */
  provider: string;
  /** Middleware names */
  middleware: string[];
  /** Auth routes (login, logout, etc.) */
  routes: {
    login?: string;
    logout?: string;
    register?: string;
    refresh?: string;
    callback?: string;
  };
  /** Config file paths */
  configFiles: string[];
  /** Confidence score */
  confidence: number;
}

/**
 * Dependency graph node
 */
export interface TruthpackDependency {
  /** Package name */
  name: string;
  /** Version constraint */
  version: string;
  /** Dependency type */
  type: 'production' | 'development' | 'peer' | 'optional';
  /** Where this dependency is used (files) */
  usedIn: string[];
  /** Whether this is a workspace dependency */
  workspace?: boolean;
}

/**
 * Runtime probe configuration
 */
export interface TruthpackRuntimeProbe {
  /** Probe type */
  type: 'http' | 'grpc' | 'graphql' | 'websocket' | 'queue';
  /** Target endpoint */
  endpoint: string;
  /** Expected response schema */
  expectedSchema?: Record<string, unknown>;
  /** Health check path */
  healthCheck?: string;
  /** Confidence score */
  confidence: number;
}

// ── Provenance ───────────────────────────────────────────────────────────────

/**
 * Provenance information for reproducibility
 */
export interface TruthpackProvenance {
  /** Git commit hash */
  commitHash: string;
  /** Git commit message (first line) */
  commitMessage?: string;
  /** Node.js version */
  nodeVersion: string;
  /** Package manager version (pnpm/npm/yarn) */
  packageManager: {
    name: 'pnpm' | 'npm' | 'yarn';
    version: string;
  };
  /** Timestamp when truthpack was generated */
  timestamp: string;
  /** Truthpack generator version */
  generatorVersion: string;
  /** Repository root path */
  repoRoot: string;
}

// ── Main Truthpack Schema ─────────────────────────────────────────────────────

/**
 * Truthpack v2 - Complete project reality snapshot
 */
export interface TruthpackV2 {
  /** Schema version */
  version: '2.0.0';
  /** Provenance information */
  provenance: TruthpackProvenance;
  /** Detected routes */
  routes: TruthpackRoute[];
  /** Environment variables */
  envVars: TruthpackEnvVar[];
  /** Database schema hints */
  dbSchema?: TruthpackDbSchema;
  /** Auth model */
  auth?: TruthpackAuthModel;
  /** Dependency graph */
  dependencies: TruthpackDependency[];
  /** Runtime probes */
  runtimeProbes: TruthpackRuntimeProbe[];
  /** Summary statistics */
  summary: {
    routes: number;
    envVars: number;
    dbTables: number;
    dependencies: number;
    runtimeProbes: number;
    /** Average confidence across all facts */
    avgConfidence: number;
  };
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Compute deterministic hash of truthpack content
 */
export function computeTruthpackHash(truthpack: TruthpackV2): string {
  // Sort arrays for deterministic hashing
  const normalized = {
    version: truthpack.version,
    provenance: truthpack.provenance,
    routes: [...truthpack.routes].sort((a, b) => 
      `${a.method}:${a.path}`.localeCompare(`${b.method}:${b.path}`)
    ),
    envVars: [...truthpack.envVars].sort((a, b) => a.name.localeCompare(b.name)),
    dbSchema: truthpack.dbSchema,
    auth: truthpack.auth,
    dependencies: [...truthpack.dependencies].sort((a, b) => a.name.localeCompare(b.name)),
    runtimeProbes: [...truthpack.runtimeProbes].sort((a, b) => 
      `${a.type}:${a.endpoint}`.localeCompare(`${b.type}:${b.endpoint}`)
    ),
  };

  const json = JSON.stringify(normalized, null, 0);
  return crypto.createHash('sha256').update(json).digest('hex').substring(0, 16);
}

/**
 * Create empty truthpack with provenance
 */
export function createEmptyTruthpack(
  provenance: TruthpackProvenance
): TruthpackV2 {
  return {
    version: '2.0.0',
    provenance,
    routes: [],
    envVars: [],
    dependencies: [],
    runtimeProbes: [],
    summary: {
      routes: 0,
      envVars: 0,
      dbTables: 0,
      dependencies: 0,
      runtimeProbes: 0,
      avgConfidence: 0,
    },
  };
}
