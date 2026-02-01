// ============================================================================
// Spike Test Scenario
// Sudden burst of traffic to test system resilience
// ============================================================================

export interface SpikeConfig {
  /** Normal traffic level */
  normalVUs: number;
  /** Spike traffic level */
  spikeVUs: number;
  /** Duration before spike */
  preSpikeDuration: string;
  /** Spike ramp time */
  spikeRampTime: string;
  /** Duration of spike */
  spikeDuration: string;
  /** Duration after spike */
  postSpikeDuration: string;
}

export const DEFAULT_SPIKE_CONFIG: SpikeConfig = {
  normalVUs: 100,
  spikeVUs: 1000,
  preSpikeDuration: '1m',
  spikeRampTime: '10s',
  spikeDuration: '3m',
  postSpikeDuration: '3m',
};

/**
 * Generate k6 spike test scenario
 */
export function generateK6SpikeScenario(config: SpikeConfig = DEFAULT_SPIKE_CONFIG): object {
  return {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // Ramp to normal
        { duration: config.spikeRampTime, target: config.normalVUs },
        // Hold at normal
        { duration: config.preSpikeDuration, target: config.normalVUs },
        // SPIKE!
        { duration: config.spikeRampTime, target: config.spikeVUs },
        // Hold spike
        { duration: config.spikeDuration, target: config.spikeVUs },
        // Drop back to normal
        { duration: config.spikeRampTime, target: config.normalVUs },
        // Hold at normal
        { duration: config.postSpikeDuration, target: config.normalVUs },
        // Ramp down
        { duration: config.spikeRampTime, target: 0 },
      ],
      tags: { scenario: 'spike' },
    },
  };
}

/**
 * Generate Artillery spike test phases
 */
export function generateArtillerySpikePhases(config: SpikeConfig = DEFAULT_SPIKE_CONFIG): object[] {
  return [
    {
      duration: parseDuration(config.spikeRampTime),
      arrivalRate: 1,
      rampTo: config.normalVUs,
      name: 'Ramp to normal',
    },
    {
      duration: parseDuration(config.preSpikeDuration),
      arrivalRate: config.normalVUs,
      name: 'Pre-spike normal load',
    },
    {
      duration: parseDuration(config.spikeRampTime),
      arrivalRate: config.normalVUs,
      rampTo: config.spikeVUs,
      name: 'SPIKE!',
    },
    {
      duration: parseDuration(config.spikeDuration),
      arrivalRate: config.spikeVUs,
      name: 'Spike sustained',
    },
    {
      duration: parseDuration(config.spikeRampTime),
      arrivalRate: config.spikeVUs,
      rampTo: config.normalVUs,
      name: 'Recovery',
    },
    {
      duration: parseDuration(config.postSpikeDuration),
      arrivalRate: config.normalVUs,
      name: 'Post-spike normal load',
    },
    {
      duration: parseDuration(config.spikeRampTime),
      arrivalRate: config.normalVUs,
      rampTo: 0,
      name: 'Ramp down',
    },
  ];
}

/**
 * Generate Gatling spike test scenario
 */
export function generateGatlingSpikeScenario(config: SpikeConfig = DEFAULT_SPIKE_CONFIG): string {
  const spikeRampSeconds = parseDuration(config.spikeRampTime);
  const preSpikeSeconds = parseDuration(config.preSpikeDuration);
  const spikeSeconds = parseDuration(config.spikeDuration);
  const postSpikeSeconds = parseDuration(config.postSpikeDuration);

  return `
  val spikeTest = scenario("Spike Test")
    .exec(behaviorChain)
  
  setUp(
    spikeTest.inject(
      // Ramp to normal
      rampUsersPerSec(1).to(${config.normalVUs}).during(${spikeRampSeconds}.seconds),
      // Pre-spike normal
      constantUsersPerSec(${config.normalVUs}).during(${preSpikeSeconds}.seconds),
      // SPIKE!
      rampUsersPerSec(${config.normalVUs}).to(${config.spikeVUs}).during(${spikeRampSeconds}.seconds),
      // Hold spike
      constantUsersPerSec(${config.spikeVUs}).during(${spikeSeconds}.seconds),
      // Recovery
      rampUsersPerSec(${config.spikeVUs}).to(${config.normalVUs}).during(${spikeRampSeconds}.seconds),
      // Post-spike
      constantUsersPerSec(${config.normalVUs}).during(${postSpikeSeconds}.seconds),
      // Ramp down
      rampUsersPerSec(${config.normalVUs}).to(0).during(${spikeRampSeconds}.seconds)
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
