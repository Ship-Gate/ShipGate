/**
 * Fixers Index
 * 
 * Registers all fixers with the registry.
 */

import { registerFixer } from '../shipgate-fixes.js';
import { fixMissingEnvVar } from './env-var-fixer.js';
import { fixDeadRoute } from './route-fixer.js';
import { fixPhantomDependency } from './dependency-fixer.js';

// Register all fixers
registerFixer(
  'missing-env-var',
  'Adds missing environment variables to .env.example and schema files',
  fixMissingEnvVar,
  0.7
);

registerFixer(
  'dead-route',
  'Replaces dead route references with closest match or adds TODO annotation',
  fixDeadRoute,
  0.6
);

registerFixer(
  'phantom-dependency',
  'Removes unused dependencies or adds missing dependencies to package.json',
  fixPhantomDependency,
  0.7
);

// Export fixers for direct use
export { fixMissingEnvVar } from './env-var-fixer.js';
export { fixDeadRoute } from './route-fixer.js';
export { fixPhantomDependency } from './dependency-fixer.js';
