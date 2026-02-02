/**
 * ISL → Code Generator
 * 
 * Generates code from ISL specifications.
 * 
 * KEY RULES:
 * 1. Only accepts ISL AST as input
 * 2. Generates from templates + conventions
 * 3. Refuses to invent dependencies/APIs
 * 4. Produces diffs, never writes blindly
 * 
 * @module @isl-lang/generator
 */

export {
  ISLGenerator,
  createGenerator,
} from './generator.js';

export type {
  GenerationRequest,
  GenerationOptions,
  GenerationPlan,
  GenerationResult,
  PlannedFile,
  PlannedModification,
  PlannedChange,
  PlannedDependency,
  RefusedAction,
  FileDiff,
  DiffHunk,
  ProofLink,
} from './generator.js';
