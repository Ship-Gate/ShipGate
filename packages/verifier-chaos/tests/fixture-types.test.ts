/**
 * Fixture test to verify that types compile correctly
 * This ensures that the exported types from @isl-lang/verifier-chaos are correct
 */

import {
  ChaosEngine,
  createEngine,
  type EngineConfig,
  type EngineResult,
  verify,
  createVerifier,
  type VerifyResult,
  type BehaviorImplementation,
  type BehaviorExecutionResult,
} from '../src/index.js';

/**
 * Test that we can create an engine with proper types
 */
function testEngineCreation(): void {
  const config: EngineConfig = {
    timeoutMs: 5000,
    continueOnFailure: true,
    verbose: false,
  };

  const engine = createEngine(config);
  const engine2 = new ChaosEngine(config);

  // Verify engine has the run method with correct signature
  const domain = {
    behaviors: [],
  } as Parameters<typeof engine.run>[0];

  const implementation: BehaviorImplementation = {
    async execute(input: Record<string, unknown>): Promise<BehaviorExecutionResult> {
      return { success: true, data: input };
    },
  };

  // Type check: engine.run should return Promise<EngineResult>
  const resultPromise: Promise<EngineResult> = engine.run(domain, implementation);

  // Verify result structure
  resultPromise.then((result) => {
    const _success: boolean = result.success;
    const _verdict: 'verified' | 'risky' | 'unsafe' = result.verdict;
    const _score: number = result.score;
    const _scenarios = result.scenarios;
    const _timeline = result.timeline;
    const _report = result.report;
    const _proof = result.proof;
    const _durationMs: number = result.durationMs;
  });
}

/**
 * Test that verify function has correct types
 */
async function testVerifyFunction(): Promise<void> {
  const implementation: BehaviorImplementation = {
    async execute(input: Record<string, unknown>): Promise<BehaviorExecutionResult> {
      return { success: true, data: input };
    },
  };

  const domain = {
    behaviors: [],
  } as Parameters<typeof verify>[1];

  // Type check: verify should return Promise<VerifyResult>
  const result: Promise<VerifyResult> = verify(
    'implementation',
    domain,
    'behaviorName',
    [],
    {}
  );

  await result.then((r) => {
    const _success: boolean = r.success;
    const _verdict: 'verified' | 'risky' | 'unsafe' = r.verdict;
    const _score: number = r.score;
  });
}

/**
 * Test BehaviorExecutionResult types
 */
function testBehaviorExecutionResult(): void {
  const successResult: BehaviorExecutionResult = {
    success: true,
    data: { foo: 'bar' },
  };

  const errorResult: BehaviorExecutionResult = {
    success: false,
    error: new Error('Test error'),
  };

  const timeoutResult: BehaviorExecutionResult = {
    success: false,
    timedOut: true,
  };

  const concurrentResult: BehaviorExecutionResult = {
    success: true,
    concurrentResults: [
      { success: true, result: {} },
      { success: false, error: new Error('Failed') },
    ],
  };
}

// Run type checks (these will fail at compile time if types are wrong)
testEngineCreation();
testVerifyFunction();
testBehaviorExecutionResult();

export {};
