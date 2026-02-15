/**
 * @isl-lang/spec-inference
 *
 * ISL Verify - Automatic behavioral spec inference from TypeScript/JavaScript codebases.
 * Reverse-engineers what the code SHOULD do, then verifies it actually does it.
 */

export { SpecInferenceEngine } from './SpecInferenceEngine.js';
export { detectFramework } from './detect-framework.js';
export { writeInferredSpec } from './spec-writer.js';
export { inferEntities } from './inferrers/entity/index.js';
export { inferEndpoints } from './inferrers/endpoint/index.js';
export { inferBehaviors } from './inferrers/behavior-inferrer.js';
export { inferActors } from './inferrers/actor-inferrer.js';

export type {
  InferredSpec,
  InferredEntity,
  InferredEnum,
  InferredEndpoint,
  InferredBehavior,
  InferredActor,
  InferredField,
  ConfidenceLevel,
  FrameworkDetection,
  WebFramework,
  OrmType,
  HttpMethod,
} from './types.js';

export type { SpecInferenceOptions, SpecInferenceResult } from './SpecInferenceEngine.js';
export type { OrmAdapter } from './inferrers/orm-adapter.js';
