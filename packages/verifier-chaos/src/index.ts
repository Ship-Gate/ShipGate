/**
 * @intentos/verifier-chaos
 * 
 * Chaos engineering verifier for ISL implementations.
 * Injects failures and verifies implementations handle them correctly.
 */

// Main exports
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

// Scenario exports
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

// Executor exports
export { createExecutor, ChaosExecutor } from './executor.js';
export type { 
  ExecutorConfig, 
  ScenarioResult, 
  InjectionResult,
  AssertionResult,
  BehaviorImplementation,
  BehaviorExecutionResult,
} from './executor.js';

// Timeline exports
export { createTimeline, Timeline } from './timeline.js';
export type { 
  TimelineEvent, 
  TimelineReport, 
  EventType,
} from './timeline.js';

// Injector exports
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
