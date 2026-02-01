// ============================================================================
// Load Test Scenario
// Normal expected load with ramp-up and ramp-down
// ============================================================================

export interface LoadConfig {
  /** Maximum number of virtual users */
  maxVUs: number;
  /** Ramp-up duration */
  rampUpDuration: string;
  /** Sustained load duration */
  sustainedDuration: string;
  /** Ramp-down duration */
  rampDownDuration: string;
  /** Intermediate stages */
  stages?: { target: number; duration: string }[];
}

export const DEFAULT_LOAD_CONFIG: LoadConfig = {
  maxVUs: 100,
  rampUpDuration: '2m',
  sustainedDuration: '5m',
  rampDownDuration: '2m',
};

/**
 * Generate k6 load test scenario
 */
export function generateK6LoadScenario(config: LoadConfig = DEFAULT_LOAD_CONFIG): object {
  const stages = config.stages || [
    { duration: config.rampUpDuration, target: Math.floor(config.maxVUs / 2) },
    { duration: config.sustainedDuration, target: Math.floor(config.maxVUs / 2) },
    { duration: config.rampUpDuration, target: config.maxVUs },
    { duration: config.sustainedDuration, target: config.maxVUs },
    { duration: config.rampDownDuration, target: 0 },
  ];

  return {
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: stages.map(s => ({
        duration: s.duration,
        target: s.target,
      })),
      tags: { scenario: 'load' },
    },
  };
}

/**
 * Generate Artillery load test phases
 */
export function generateArtilleryLoadPhases(config: LoadConfig = DEFAULT_LOAD_CONFIG): object[] {
  const halfVUs = Math.floor(config.maxVUs / 2);
  
  return [
    {
      duration: parseDuration(config.rampUpDuration),
      arrivalRate: 1,
      rampTo: halfVUs,
      name: 'Ramp up to 50%',
    },
    {
      duration: parseDuration(config.sustainedDuration),
      arrivalRate: halfVUs,
      name: 'Sustained at 50%',
    },
    {
      duration: parseDuration(config.rampUpDuration),
      arrivalRate: halfVUs,
      rampTo: config.maxVUs,
      name: 'Ramp up to 100%',
    },
    {
      duration: parseDuration(config.sustainedDuration),
      arrivalRate: config.maxVUs,
      name: 'Sustained at 100%',
    },
    {
      duration: parseDuration(config.rampDownDuration),
      arrivalRate: config.maxVUs,
      rampTo: 0,
      name: 'Ramp down',
    },
  ];
}

/**
 * Generate Gatling load test scenario
 */
export function generateGatlingLoadScenario(config: LoadConfig = DEFAULT_LOAD_CONFIG): string {
  const rampUpSeconds = parseDuration(config.rampUpDuration);
  const sustainedSeconds = parseDuration(config.sustainedDuration);
  const rampDownSeconds = parseDuration(config.rampDownDuration);
  const halfVUs = Math.floor(config.maxVUs / 2);

  return `
  val loadTest = scenario("Load Test")
    .exec(behaviorChain)
  
  setUp(
    loadTest.inject(
      rampUsersPerSec(1).to(${halfVUs}).during(${rampUpSeconds}.seconds),
      constantUsersPerSec(${halfVUs}).during(${sustainedSeconds}.seconds),
      rampUsersPerSec(${halfVUs}).to(${config.maxVUs}).during(${rampUpSeconds}.seconds),
      constantUsersPerSec(${config.maxVUs}).during(${sustainedSeconds}.seconds),
      rampUsersPerSec(${config.maxVUs}).to(0).during(${rampDownSeconds}.seconds)
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
