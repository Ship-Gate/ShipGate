/**
 * @isl-lang/verifier-chaos
 *
 * Chaos engineering verifier for ISL implementations.
 * Injects failures and verifies implementations handle them correctly.
 *
 * @example
 * ```ts
 * import { createEngine } from '@isl-lang/verifier-chaos';
 *
 * const engine = createEngine({ continueOnFailure: true });
 * const result = await engine.run(domain, implementation);
 *
 * console.log(result.report);  // structured report
 * console.log(result.proof);   // proof bundle
 * ```
 */

// ── Engine (top-level entry point) ────────────────────────────────────
export { ChaosEngine, createEngine } from './engine.js';
export type { EngineConfig, EngineResult } from './engine.js';

// ── Verifier (legacy / convenience) ──────────────────────────────────
export { verify, createVerifier, ChaosVerifier } from './verifier.js';
export type {
  VerifyResult,
  VerifyOptions,
  ChaosTestResult,
  ChaosTestError,
  ChaosCoverageReport,
  ChaosTimingReport,
  CoverageMetric,
  ImplementationAdapter,
} from './verifier.js';

// ── Scenarios ────────────────────────────────────────────────────────
export {
  parseChaosScenarios,
  parseScenarioNames,
  createChaosScenario,
  validateScenario,
  getSupportedInjectionTypes,
} from './scenarios.js';
export type {
  ParsedChaosScenario,
  ChaosInjection,
  ChaosAssertion,
  ChaosStep,
  InjectionType,
  ScenarioParseResult,
  ScenarioError,
} from './scenarios.js';

// ── Executor ─────────────────────────────────────────────────────────
export { createExecutor, ChaosExecutor } from './executor.js';
export type {
  ExecutorConfig,
  ScenarioResult,
  InjectionResult,
  AssertionResult,
  BehaviorImplementation,
  BehaviorExecutionResult,
} from './executor.js';

// ── Timeline ─────────────────────────────────────────────────────────
export { createTimeline, Timeline } from './timeline.js';
export type { TimelineEvent, TimelineReport, EventType } from './timeline.js';

// ── Report ───────────────────────────────────────────────────────────
export { generateChaosReport } from './report.js';
export type {
  ChaosReport,
  ChaosReportSummary,
  ChaosScenarioReport,
  ChaosReportCoverage,
  InjectionTypeStats,
  ChaosReportTiming,
} from './report.js';

// ── Proof Bundle ─────────────────────────────────────────────────────
export {
  buildProofBundle,
  serialiseProofBundle,
  verifyProofIntegrity,
} from './proof.js';
export type {
  ChaosProofBundle,
  ChaosProofVerdict,
  ChaosProofEvidence,
  ChaosProofAssertion,
  ChaosProofTimeline,
  ChaosProofCoverage,
} from './proof.js';

// ── Pipeline Integration ─────────────────────────────────────────────
export { runChaosStep, createChaosStep } from './pipeline.js';
export type { ChaosStepInput, ChaosStepResult } from './pipeline.js';

// ── CLI ──────────────────────────────────────────────────────────────
export { main as runCli } from './cli.js';

// ── Injectors ────────────────────────────────────────────────────────

// Network
export {
  NetworkInjector,
  createNetworkTimeout,
  createConnectionRefused,
  createRetryableNetworkFailure,
} from './injectors/network.js';
export type {
  NetworkInjectorConfig,
  NetworkInjectorState,
} from './injectors/network.js';

// Database
export {
  DatabaseInjector,
  createDatabaseConnectionLost,
  createDatabaseTimeout,
  createDeadlock,
  createRecoverableDatabaseFailure,
  createDatabaseUnavailable,
} from './injectors/database.js';
export type {
  DatabaseInjectorConfig,
  DatabaseInjectorState,
  DatabaseFailureType,
  DatabaseOperation,
  DatabaseHandler,
} from './injectors/database.js';

// Latency
export {
  LatencyInjector,
  createFixedLatency,
  createVariableLatency,
  createJitteryLatency,
  createSpikeLatency,
} from './injectors/latency.js';
export type {
  LatencyInjectorConfig,
  LatencyInjectorState,
  LatencyDistribution,
} from './injectors/latency.js';

// Concurrent
export {
  ConcurrentInjector,
  createConcurrentRequests,
  createStaggeredRequests,
  createBurstRequests,
} from './injectors/concurrent.js';
export type {
  ConcurrentInjectorConfig,
  ConcurrentInjectorState,
  ConcurrentResult,
  RaceConditionResult,
} from './injectors/concurrent.js';

// Rate Limit
export {
  RateLimitInjector,
  RateLimitError,
  createRateLimitStorm,
  createThrottler,
  createStrictRateLimiter,
  createBurstTolerantRateLimiter,
} from './injectors/rate-limit.js';
export type {
  RateLimitInjectorConfig,
  RateLimitInjectorState,
  RateLimitAction,
  RateLimitResult,
} from './injectors/rate-limit.js';

// Idempotency
export {
  IdempotencyTracker,
  IdempotencyError,
  createIdempotencyTracker,
  createConcurrentIdempotencyTracker,
  createStrictIdempotencyTracker,
} from './injectors/idempotency.js';
export type {
  IdempotencyConfig,
  IdempotencyState,
  IdempotentRequest,
  IdempotencyCheckResult,
} from './injectors/idempotency.js';

// CPU Pressure
export {
  CpuPressureInjector,
  createCpuPressure,
  createModerateCpuPressure,
  createHeavyCpuPressure,
} from './injectors/cpu-pressure.js';
export type {
  CpuPressureConfig,
  CpuPressureState,
} from './injectors/cpu-pressure.js';

// Memory Pressure
export {
  MemoryPressureInjector,
  createMemoryPressure,
  createModerateMemoryPressure,
  createHeavyMemoryPressure,
} from './injectors/memory-pressure.js';
export type {
  MemoryPressureConfig,
  MemoryPressureState,
} from './injectors/memory-pressure.js';

// Clock Skew
export {
  ClockSkewInjector,
  createFixedClockSkew,
  createDriftingClock,
  createClockJump,
  createOscillatingClock,
} from './injectors/clock-skew.js';
export type {
  ClockSkewConfig,
  ClockSkewState,
  ClockSkewMode,
} from './injectors/clock-skew.js';
