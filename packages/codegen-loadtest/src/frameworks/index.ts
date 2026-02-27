// ============================================================================
// Framework Exports
// ============================================================================

export { generateK6Script, type K6Options } from './k6';
export {
  generateArtilleryConfig,
  generateArtilleryHelpers,
  type ArtilleryOptions,
} from './artillery';
export {
  generateGatlingSimulation,
  generateGatlingBuildSbt,
  generateGatlingPluginsSbt,
  type GatlingOptions,
} from './gatling';

export type Framework = 'k6' | 'artillery' | 'gatling';
