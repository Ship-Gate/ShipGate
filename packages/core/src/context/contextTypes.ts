/**
 * Context Types for Repository Context Extraction
 * 
 * Types for the context pack returned by extractContext().
 * Used to provide relevant project information to the ISL translator.
 */

/**
 * Detected technology stack
 */
export type StackLanguage = 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'java' | 'csharp' | 'unknown';

/**
 * Detected runtime environment
 */
export type Runtime = 'node' | 'deno' | 'bun' | 'browser' | 'unknown';

/**
 * Detected web framework
 */
export type WebFramework = 
  | 'next'
  | 'express'
  | 'fastify'
  | 'koa'
  | 'hono'
  | 'nestjs'
  | 'remix'
  | 'nuxt'
  | 'sveltekit'
  | 'django'
  | 'flask'
  | 'fastapi'
  | 'gin'
  | 'fiber'
  | 'spring'
  | 'aspnet'
  | 'unknown';

/**
 * Detected database technology
 */
export type DatabaseTech = 
  | 'prisma'
  | 'drizzle'
  | 'typeorm'
  | 'sequelize'
  | 'mongoose'
  | 'knex'
  | 'sqlalchemy'
  | 'gorm'
  | 'postgres'
  | 'mysql'
  | 'mongodb'
  | 'sqlite'
  | 'redis'
  | 'unknown';

/**
 * Detected authentication approach
 */
export type AuthApproach =
  | 'nextauth'
  | 'clerk'
  | 'auth0'
  | 'supabase'
  | 'firebase'
  | 'passport'
  | 'lucia'
  | 'jwt'
  | 'session'
  | 'oauth'
  | 'unknown';

/**
 * Confidence level for detections
 */
export type Confidence = 'high' | 'medium' | 'low';

/**
 * A detected entity from the codebase (e.g., from Prisma schema)
 */
export interface DetectedEntity {
  /** Entity name (e.g., "User", "Session", "Order") */
  name: string;
  /** Source of detection (e.g., "prisma", "mongoose", "typeorm") */
  source: string;
  /** File where the entity was found */
  sourceFile: string;
  /** Detected fields (if available) */
  fields?: DetectedField[];
  /** Confidence of detection */
  confidence: Confidence;
}

/**
 * A detected field within an entity
 */
export interface DetectedField {
  /** Field name */
  name: string;
  /** Field type (as string, may be ORM-specific) */
  type: string;
  /** Whether the field appears to be an ID */
  isId?: boolean;
  /** Whether the field appears to be a timestamp */
  isTimestamp?: boolean;
  /** Whether the field is optional */
  isOptional?: boolean;
  /** Whether the field is unique */
  isUnique?: boolean;
}

/**
 * A key file detected in the repository
 */
export interface KeyFile {
  /** Relative path from workspace root */
  path: string;
  /** Category of the file */
  category: 'route' | 'auth' | 'database' | 'config' | 'schema' | 'middleware' | 'model' | 'other';
  /** Why this file is considered key */
  reason: string;
  /** Confidence of categorization */
  confidence: Confidence;
}

/**
 * Suggested policy defaults based on detected stack
 */
export interface PolicySuggestion {
  /** Policy ID from policy pack */
  policyId: string;
  /** Whether to enable by default */
  enabled: boolean;
  /** Reason for the suggestion */
  reason: string;
}

/**
 * Stack detection result
 */
export interface StackInfo {
  /** Primary language */
  language: StackLanguage;
  /** Runtime environment */
  runtime: Runtime;
  /** Detected web frameworks */
  frameworks: WebFramework[];
  /** Detected database technologies */
  databases: DatabaseTech[];
  /** Detected auth approaches */
  auth: AuthApproach[];
  /** Package manager used */
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';
  /** TypeScript config present */
  hasTypeScript: boolean;
  /** Monorepo detected */
  isMonorepo: boolean;
}

/**
 * The full context pack returned by extractContext()
 */
export interface ContextPack {
  /** Workspace root path */
  workspacePath: string;
  /** When the context was extracted */
  extractedAt: string;
  /** Detected technology stack */
  stack: StackInfo;
  /** Detected entities from schemas/models */
  detectedEntities: DetectedEntity[];
  /** Suggested policy defaults */
  policySuggestions: PolicySuggestion[];
  /** Key files in the repository */
  keyFiles: KeyFile[];
  /** Any warnings or notes from extraction */
  warnings: string[];
  /** Extraction metadata */
  metadata: {
    /** Duration of extraction in ms */
    durationMs: number;
    /** Number of files scanned */
    filesScanned: number;
    /** Version of the extractor */
    extractorVersion: string;
  };
}

/**
 * Options for context extraction
 */
export interface ExtractContextOptions {
  /** Maximum depth to scan */
  maxDepth?: number;
  /** Directories to ignore */
  ignoreDirs?: string[];
  /** File patterns to ignore */
  ignorePatterns?: string[];
  /** Whether to extract entity fields (slower) */
  extractFields?: boolean;
  /** Timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Default extraction options
 */
export const DEFAULT_EXTRACT_OPTIONS: Required<ExtractContextOptions> = {
  maxDepth: 10,
  ignoreDirs: ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'venv', '.venv', 'target'],
  ignorePatterns: ['*.min.js', '*.map', '*.lock'],
  extractFields: true,
  timeoutMs: 30000,
};
