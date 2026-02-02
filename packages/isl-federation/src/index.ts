// ============================================================================
// ISL Federation
// Federated specification management for microservices architectures
// ============================================================================

export { FederationRegistry, type RegistryOptions } from './registry';
export { compose, type CompositionOptions } from './composer';
export { validate, type FederationValidation } from './validator';
export { resolveReferences, type ReferenceResolver } from './resolver';
export { generateGateway, type GatewayConfig } from './gateway';
export * from './types';
export type * as AST from './ast';
