/**
 * ISL Agent Scoring Module
 *
 * Exports tri-state scoring functionality for clause evaluation
 */

// Types
export type {
  ClauseResult,
  ClauseState,
  ScoreBreakdown,
  ScoringResult,
  ScoringWeights,
  ShipDecision,
  ShipThresholds,
} from './scoringTypes.js';

// Functions and constants
export {
  computeScore,
  createClauseResult,
  canShip,
  DEFAULT_WEIGHTS,
  DEFAULT_THRESHOLDS,
} from './scoring.js';
