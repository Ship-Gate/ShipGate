// ============================================================================
// Soak Test Scenario (Endurance Test)
// Extended duration to find memory leaks, resource exhaustion
// ============================================================================

export interface SoakConfig {
  /** Number of virtual users */
  vus: number;
  /** Total test duration (long!) */
  duration: string;
  /** Ramp-up duration */
  rampUpDuration: string;
  /** Ramp-down duration */
  rampDownDuration: string;
}

export const DEFAULT_SOAK_CONFIG: SoakConfig = {
  vus: 50,
  duration: '4h',
  rampUpDuration: '5m',
  rampDownDuration: '5m',
};

/**
 * Generate k6 soak test scenario
 */
export function generateK6SoakScenario(config: SoakConfig = DEFAULT_SOAK_CONFIG): object {
  return {
    soak: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // Ramp up
        { duration: config.rampUpDuration, target: config.vus },
        // Long sustained load
        { duration: config.duration, target: config.vus },
        // Ramp down
        { duration: config.rampDownDuration, target: 0 },
      ],
      tags: { scenario: 'soak' },
    },
  };
}

/**
 * Generate Artillery soak test phases
 */
export function generateArtillerySoakPhases(config: SoakConfig = DEFAULT_SOAK_CONFIG): object[] {
  return [
    {
      duration: parseDuration(config.rampUpDuration),
      arrivalRate: 1,
      rampTo: config.vus,
      name: 'Ramp up',
    },
    {
      duration: parseDuration(config.duration),
      arrivalRate: config.vus,
      name: 'Sustained load (soak)',
    },
    {
      duration: parseDuration(config.rampDownDuration),
      arrivalRate: config.vus,
      rampTo: 0,
      name: 'Ramp down',
    },
  ];
}

/**
 * Generate Gatling soak test scenario
 */
export function generateGatlingSoakScenario(config: SoakConfig = DEFAULT_SOAK_CONFIG): string {
  const rampUpSeconds = parseDuration(config.rampUpDuration);
  const soakSeconds = parseDuration(config.duration);
  const rampDownSeconds = parseDuration(config.rampDownDuration);

  return `
  val soakTest = scenario("Soak Test")
    .exec(behaviorChain)
  
  setUp(
    soakTest.inject(
      rampUsersPerSec(1).to(${config.vus}).during(${rampUpSeconds}.seconds),
      constantUsersPerSec(${config.vus}).during(${soakSeconds}.seconds),
      rampUsersPerSec(${config.vus}).to(0).during(${rampDownSeconds}.seconds)
    )
  ).protocols(httpProtocol)`;
}

/**
 * Parse duration string to seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/(\d+)(s|m|h)/);
  if (!match) return 14400; // 4 hours default
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    default: return value;
  }
}
