/**
 * Types for test infrastructure generation.
 */

export interface TestInfrastructureContext {
  /** Source directory (default: src) */
  srcDir?: string;
  /** Tests directory (default: tests) */
  testsDir?: string;
  /** Output root directory */
  outDir?: string;
  /** Whether project uses Prisma */
  hasPrisma?: boolean;
  /** Whether routes require auth (JWT) */
  hasAuth?: boolean;
}
