// ============================================================================
// Spec Federation Types
// ============================================================================

/**
 * Federated spec source
 */
export interface FederatedSource {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Source type */
  type: 'file' | 'url' | 'git' | 'registry' | 'inline';

  /** Location (file path, URL, git repo, etc.) */
  location: string;

  /** Version constraint (semver) */
  version?: string;

  /** Branch/tag for git sources */
  ref?: string;

  /** Namespace to import under */
  namespace?: string;

  /** Owner team/org */
  owner?: string;

  /** Authentication token */
  token?: string;

  /** Caching options */
  cache?: CacheOptions;
}

/**
 * Cache options
 */
export interface CacheOptions {
  /** Enable caching */
  enabled: boolean;

  /** TTL in seconds */
  ttl: number;

  /** Cache directory */
  directory?: string;
}

/**
 * Federation options
 */
export interface FederationOptions {
  /** Conflict resolution strategy */
  conflictResolution: 'error' | 'first' | 'last' | 'merge' | 'rename';

  /** Enable strict type checking across boundaries */
  strictTypes: boolean;

  /** Allow circular dependencies */
  allowCircular: boolean;

  /** Maximum depth for transitive dependencies */
  maxDepth: number;

  /** Enable parallel fetching */
  parallelFetch: boolean;

  /** Retry options */
  retry: RetryOptions;

  /** Transform specs on import */
  transforms?: Transform[];

  /** Validation level */
  validationLevel: 'none' | 'warn' | 'error';

  /** Generate combined schema */
  generateCombinedSchema: boolean;

  /** Output directory */
  outputDir: string;
}

/**
 * Retry options
 */
export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Transform function
 */
export interface Transform {
  name: string;
  pattern?: string;
  transform: (spec: FederatedSpec) => FederatedSpec;
}

/**
 * Default options
 */
export const DEFAULT_OPTIONS: FederationOptions = {
  conflictResolution: 'error',
  strictTypes: true,
  allowCircular: false,
  maxDepth: 10,
  parallelFetch: true,
  retry: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },
  validationLevel: 'error',
  generateCombinedSchema: true,
  outputDir: './federated',
};

/**
 * Federated spec
 */
export interface FederatedSpec {
  /** Source information */
  source: FederatedSource;

  /** Parsed AST */
  ast: SpecAST;

  /** Version */
  version: string;

  /** Hash of content */
  hash: string;

  /** Dependencies */
  dependencies: string[];

  /** Exported entities */
  exports: SpecExport[];

  /** Metadata */
  metadata: SpecMetadata;

  /** Raw content */
  raw: string;
}

/**
 * Spec AST (simplified)
 */
export interface SpecAST {
  domains: DomainAST[];
  types: TypeAST[];
  imports: ImportAST[];
}

/**
 * Domain AST
 */
export interface DomainAST {
  name: string;
  entities: EntityAST[];
  behaviors: BehaviorAST[];
  invariants: string[];
  description?: string;
}

/**
 * Entity AST
 */
export interface EntityAST {
  name: string;
  properties: PropertyAST[];
  behaviors?: BehaviorAST[];
  invariants?: string[];
}

/**
 * Property AST
 */
export interface PropertyAST {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  constraints?: ConstraintAST[];
}

/**
 * Behavior AST
 */
export interface BehaviorAST {
  name: string;
  input?: PropertyAST[];
  output?: string;
  preconditions?: string[];
  postconditions?: string[];
  description?: string;
}

/**
 * Type AST
 */
export interface TypeAST {
  name: string;
  kind: 'alias' | 'enum' | 'union' | 'struct';
  definition: unknown;
}

/**
 * Import AST
 */
export interface ImportAST {
  source: string;
  names: string[];
  alias?: string;
}

/**
 * Constraint AST
 */
export interface ConstraintAST {
  type: string;
  value: unknown;
  message?: string;
}

/**
 * Spec export
 */
export interface SpecExport {
  name: string;
  kind: 'domain' | 'entity' | 'behavior' | 'type';
  path: string;
}

/**
 * Spec metadata
 */
export interface SpecMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  repository?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
}

/**
 * Federation result
 */
export interface FederationResult {
  /** All loaded specs */
  specs: FederatedSpec[];

  /** Combined schema */
  combinedSchema: CombinedSchema;

  /** Dependency graph */
  dependencyGraph: DependencyGraph;

  /** Conflicts found */
  conflicts: Conflict[];

  /** Warnings */
  warnings: Warning[];

  /** Statistics */
  statistics: FederationStatistics;
}

/**
 * Combined schema
 */
export interface CombinedSchema {
  domains: DomainAST[];
  types: TypeAST[];
  exports: Map<string, SpecExport>;
}

/**
 * Dependency graph
 */
export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: DependencyEdge[];
}

/**
 * Dependency node
 */
export interface DependencyNode {
  id: string;
  spec: FederatedSpec;
  depth: number;
}

/**
 * Dependency edge
 */
export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'extend' | 'implement';
}

/**
 * Conflict
 */
export interface Conflict {
  type: 'name' | 'type' | 'behavior' | 'version';
  message: string;
  sources: string[];
  resolution?: string;
}

/**
 * Warning
 */
export interface Warning {
  code: string;
  message: string;
  source?: string;
  location?: string;
}

/**
 * Federation statistics
 */
export interface FederationStatistics {
  totalSpecs: number;
  totalDomains: number;
  totalEntities: number;
  totalBehaviors: number;
  totalTypes: number;
  fetchTime: number;
  parseTime: number;
  validationTime: number;
}

/**
 * Registry client interface
 */
export interface SpecRegistry {
  search(query: string, options?: SearchOptions): Promise<RegistryEntry[]>;
  get(name: string, version?: string): Promise<FederatedSpec>;
  publish(spec: FederatedSpec, options?: PublishOptions): Promise<void>;
  unpublish(name: string, version: string): Promise<void>;
  versions(name: string): Promise<string[]>;
}

/**
 * Search options
 */
export interface SearchOptions {
  limit?: number;
  offset?: number;
  tags?: string[];
  author?: string;
}

/**
 * Registry entry
 */
export interface RegistryEntry {
  name: string;
  version: string;
  description?: string;
  author?: string;
  downloads: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Publish options
 */
export interface PublishOptions {
  access: 'public' | 'private';
  tags?: string[];
}
