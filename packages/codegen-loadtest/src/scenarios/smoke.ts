// ============================================================================
// Smoke Test Scenario
// Basic test to verify system is working
// ============================================================================

export interface SmokeConfig {
  /** Number of virtual users */
  vus: number;
  /** Duration of test */
  duration: string;
}

export const DEFAULT_SMOKE_CONFIG: SmokeConfig = {
  vus: 1,
  duration: '1m',
};

/**
 * Generate k6 smoke test scenario
 */
export function generateK6SmokeScenario(config: SmokeConfig = DEFAULT_SMOKE_CONFIG): object {
  return {
    smoke: {
      executor: 'constant-vus',
      vus: config.vus,
      duration: config.duration,
      tags: { scenario: 'smoke' },
    },
  };
}

/**
 * Generate Artillery smoke test phases
 */
export function generateArtillerySmokePhases(config: SmokeConfig = DEFAULT_SMOKE_CONFIG): object[] {
  const durationSeconds = parseDuration(config.duration);
  
  return [
    {
      duration: durationSeconds,
      arrivalRate: config.vus,
      name: 'Smoke test',
    },
  ];
}

/**
 * Generate Gatling smoke test scenario
 */
export function generateGatlingSmokeScenario(config: SmokeConfig = DEFAULT_SMOKE_CONFIG): string {
  const durationSeconds = parseDuration(config.duration);
  
  return `
  val smokeTest = scenario("Smoke Test")
    .exec(behaviorChain)
  
  setUp(
    smokeTest.inject(
      constantUsersPerSec(${config.vus}).during(${durationSeconds}.seconds)
    )
  ).protocols(httpProtocol)`;
}

/**
 * Parse duration string to seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/(\d+)(s|m|h)/);
  if (!match) return 60;
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    default: return value;
  }
}
