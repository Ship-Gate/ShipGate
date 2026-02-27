// ============================================================================
// Spec Federation - Entry Point
// ============================================================================

export {
  SpecFederation,
  createFederation,
  federate,
  fileSource,
  urlSource,
  inlineSource,
} from './federation';

export type {
  FederatedSource,
  FederatedSpec,
  FederationOptions,
  FederationResult,
  CombinedSchema,
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  Conflict,
  Warning,
  FederationStatistics,
  SpecAST,
  DomainAST,
  EntityAST,
  PropertyAST,
  BehaviorAST,
  TypeAST,
  ImportAST,
  ConstraintAST,
  SpecExport,
  SpecMetadata,
  CacheOptions,
  RetryOptions,
  Transform,
  SpecRegistry,
  SearchOptions,
  RegistryEntry,
  PublishOptions,
} from './types';

export { DEFAULT_OPTIONS } from './types';
