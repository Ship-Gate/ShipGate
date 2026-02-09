/**
 * ShipGate Configuration Module
 *
 * Provides loading, validation, and glob matching for .shipgate.yml.
 *
 * Usage:
 *   import { loadShipGateConfig, shouldVerify } from './config/index.js';
 *
 *   const { config } = await loadShipGateConfig();
 *   const result = shouldVerify('src/auth/login.ts', config);
 */

export {
  loadShipGateConfig,
  loadShipGateConfigFromFile,
  ShipGateConfigError,
} from './loader.js';
export type { LoadConfigResult } from './loader.js';

export {
  shouldVerify,
  filterVerifiableFiles,
  findMissingRequiredSpecs,
} from './glob-matcher.js';
export type { ShouldVerifyResult } from './glob-matcher.js';

export {
  validateConfig,
  formatValidationErrors,
} from './validator.js';
export type { ValidationError, ValidationResult } from './validator.js';

export {
  applyDefaults,
  DEFAULT_SHIPGATE_CONFIG,
  DEFAULT_CI_CONFIG,
  DEFAULT_SCANNING_CONFIG,
  DEFAULT_GENERATE_CONFIG,
} from './schema.js';
export type {
  ShipGateConfig,
  ShipGateCIConfig,
  ShipGateScanningConfig,
  ShipGateGenerateConfig,
  FailOnLevel,
  SpeclessMode,
} from './schema.js';

export { generateStarterConfig } from './init-template.js';
