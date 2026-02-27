/**
 * @isl-lang/isl-ship
 *
 * ISL full-stack application generator.
 * One spec, one command, running app.
 *
 * @example
 * ```ts
 * import { ship } from '@isl-lang/isl-ship';
 *
 * const result = ship(islSource, {
 *   specPath: 'domain.isl',
 *   outputDir: './output',
 *   stack: { backend: 'express', database: 'postgres', orm: 'prisma' },
 * });
 *
 * for (const file of result.files) {
 *   await writeFile(join(outputDir, file.path), file.content);
 * }
 * ```
 */

export { ship, shipFromDomain } from './ship.js';

export type {
  ShipOptions,
  ShipResult,
  ShipStats,
  ShipStack,
  GeneratedFile,
  BackendFramework,
  DatabaseEngine,
  ORM,
  FrontendFramework,
  CSSFramework,
} from './types.js';

export {
  DEFAULT_STACK,
  resolveStack,
  toSnakeCase,
  toKebabCase,
  toCamelCase,
  islTypeToTS,
  islTypeToPrisma,
} from './types.js';

export { generatePrismaSchema } from './generators/prisma.js';
export { generateSeed } from './generators/seed.js';
export { generateBackend } from './generators/backend.js';
export { generateContracts } from './generators/contracts.js';
export { generateScaffold } from './generators/scaffold.js';
export type { DatabaseAdapter, DatabaseAdapterId } from './adapters/database-adapter.js';
export { getDatabaseAdapter, getAdapterIds, SQLiteAdapter, PostgresAdapter } from './adapters/index.js';export type { DeploymentAdapter, ISLSpec, DeploymentPlatform } from './deployments/types.js';
export {
  getDeploymentAdapter,
  getDeploymentPlatforms,
  buildDeploymentSpec,
  VercelAdapter,
  DockerAdapter,
  RailwayAdapter,
  FlyAdapter,
} from './deployments/index.js';