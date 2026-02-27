/**
 * Fix Strategies
 * 
 * Different strategies for fixing various types of verification failures.
 */

export {
  generatePreconditionPatches,
  generateValidationBlock,
  type PreconditionFix,
} from './precondition.js';

export {
  generatePostconditionPatches,
  suggestPostconditionFix,
  type PostconditionFix,
} from './postcondition.js';

export {
  generateInvariantPatches,
  generateDefensiveMutation,
  type InvariantFix,
  type InvariantConstraint,
} from './invariant.js';

export {
  generateErrorPatches,
  generateTryCatchWrapper,
  suggestErrorHandlers,
  type ErrorFix,
} from './error.js';

export {
  generateTemporalPatches,
  generateTemporalWrapper,
  type TemporalFix,
} from './temporal.js';
