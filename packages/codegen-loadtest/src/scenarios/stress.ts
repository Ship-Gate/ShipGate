// ============================================================================
// Stress Test Scenario
// Push system beyond normal limits to find breaking point
// ============================================================================

export interface StressConfig {
  /** Starting VUs */
  startVUs: number;
  /** Maximum VUs (beyond expected capacity) */
  maxVUs: number;
  /** Duration at each stress level */
  stageDuration: string;
  /** Number of stress stages */
  stages: number;
}

export const DEFAULT_STRESS_CONFIG: StressConfig = {
  startVUs: 100,
  maxVUs: 300,
  stageDuration: '5m',
  stages: 3,
};

/**
 * Generate k6 stress test scenario
 */
export function generateK6StressScenario(config: StressConfig = DEFAULT_STRESS_CONFIG): object {
  const vusIncrement = Math.floor((config.maxVUs - config.startVUs) / config.stages);
  const stages: { duration: string; target: number }[] = [];

  // Build progressive stages
  let currentVUs = 0;
  for (let i = 0; i <= config.stages; i++) {
    const target = Math.min(config.startVUs + i * vusIncrement, config.maxVUs);
    
    // Ramp up
    stages.push({ duration: '2m', target });
    // Sustain
    stages.push({ duration: config.stageDuration, target });
    
    currentVUs = target;
  }

  // Ramp down
  stages.push({ duration: '5m', target: 0 });

  return {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages,
      tags: { scenario: 'stress' },
    },
  };
}

/**
 * Generate Artillery stress test phases
 */
export function generateArtilleryStressPhases(config: StressConfig = DEFAULT_STRESS_CONFIG): object[] {
  const phases: object[] = [];
  const vusIncrement = Math.floor((config.maxVUs - config.startVUs) / config.stages);
  const stageDurationSeconds = parseDuration(config.stageDuration);

  let currentVUs = 0;
  for (let i = 0; i <= config.stages; i++) {
    const target = Math.min(config.startVUs + i * vusIncrement, config.maxVUs);
    
    // Ramp up phase
    phases.push({
      duration: 120,
      arrivalRate: currentVUs || 1,
      rampTo: target,
      name: `Ramp to ${target} users`,
    });
    
    // Sustain phase
    phases.push({
      duration: stageDurationSeconds,
      arrivalRate: target,
      name: `Sustain at ${target} users`,
    });
    
    currentVUs = target;
  }

  // Ramp down
  phases.push({
    duration: 300,
    arrivalRate: currentVUs,
    rampTo: 0,
    name: 'Ramp down',
  });

  return phases;
}

/**
 * Generate Gatling stress test scenario
 */
export function generateGatlingStressScenario(config: StressConfig = DEFAULT_STRESS_CONFIG): string {
  const vusIncrement = Math.floor((config.maxVUs - config.startVUs) / config.stages);
  const stageDurationSeconds = parseDuration(config.stageDuration);
  const injectionSteps: string[] = [];

  let currentVUs = 0;
  for (let i = 0; i <= config.stages; i++) {
    const target = Math.min(config.startVUs + i * vusIncrement, config.maxVUs);
    
    // Ramp up
    injectionSteps.push(`rampUsersPerSec(${currentVUs || 1}).to(${target}).during(120.seconds)`);
    // Sustain
    injectionSteps.push(`constantUsersPerSec(${target}).during(${stageDurationSeconds}.seconds)`);
    
    currentVUs = target;
  }

  // Ramp down
  injectionSteps.push(`rampUsersPerSec(${currentVUs}).to(0).during(300.seconds)`);

  return `
  val stressTest = scenario("Stress Test")
    .exec(behaviorChain)
  
  setUp(
    stressTest.inject(
      ${injectionSteps.join(',\n      ')}
    )
  ).protocols(httpProtocol)`;
}

/**
 * Parse duration string to seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/(\d+)(s|m|h)/);
  if (!match) return 300;
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    default: return value;
  }
}
