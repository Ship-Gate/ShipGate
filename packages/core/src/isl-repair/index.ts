/**
 * ISL Repair Engine
 *
 * Deterministic AST repair system for fixing common ISL AST issues.
 *
 * @packageDocumentation
 */

// Main API
export { repairAst, createRepairPipeline, formatRepairReport } from './repair.js';

// Types
export type {
  RepairResult,
  RepairOptions,
  Repair,
  RepairCategory,
  RepairConfidence,
  RepairStats,
  ValidationError,
  UnrepairedError,
  RepairStrategy,
  RepairContext,
  RepairStrategyResult,
} from './types.js';

// Strategies
export {
  defaultStrategies,
  missingFieldsStrategy,
  normalizeOrderStrategy,
  schemaFixStrategy,
} from './strategies/index.js';
