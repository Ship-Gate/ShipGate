// ============================================================================
// Scenario Exports
// ============================================================================

export {
  generateK6SmokeScenario,
  generateArtillerySmokePhases,
  generateGatlingSmokeScenario,
  DEFAULT_SMOKE_CONFIG,
  type SmokeConfig,
} from './smoke';

export {
  generateK6LoadScenario,
  generateArtilleryLoadPhases,
  generateGatlingLoadScenario,
  DEFAULT_LOAD_CONFIG,
  type LoadConfig,
} from './load';

export {
  generateK6StressScenario,
  generateArtilleryStressPhases,
  generateGatlingStressScenario,
  DEFAULT_STRESS_CONFIG,
  type StressConfig,
} from './stress';

export {
  generateK6SpikeScenario,
  generateArtillerySpikePhases,
  generateGatlingSpikeScenario,
  DEFAULT_SPIKE_CONFIG,
  type SpikeConfig,
} from './spike';

export {
  generateK6SoakScenario,
  generateArtillerySoakPhases,
  generateGatlingSoakScenario,
  DEFAULT_SOAK_CONFIG,
  type SoakConfig,
} from './soak';

export type ScenarioType = 'smoke' | 'load' | 'stress' | 'spike' | 'soak';

export const ALL_SCENARIOS: ScenarioType[] = ['smoke', 'load', 'stress', 'spike', 'soak'];
