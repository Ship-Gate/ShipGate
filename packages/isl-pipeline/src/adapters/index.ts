/**
 * Framework Adapters
 *
 * Adapters for detecting and patching different web frameworks.
 * Includes codegen adapters for Next.js and Express.
 *
 * @module @isl-lang/pipeline/adapters
 */

// Codegen framework adapters
export { NextJSAdapter } from './nextjs-adapter.js';
export { ExpressAdapter } from './express-adapter.js';
export { FastifyAdapter } from './fastify-adapter.js';
export type {
  FrameworkAdapter as CodegenFrameworkAdapter,
  ISLSpec,
  ISLEndpoint,
  FileMap,
  GeneratedFile as CodegenGeneratedFile,
  CodegenContext,
} from './codegen-framework-adapter.js';

export {
  NextJSAppRouterAdapter,
  detect as detectNextJSAppRouter,
  isRouteFile,
  locateHandlers,
  extractRoutePath,
  parseHandlers,
  findInjectionPoints,
  checkEnforcementOrder,
  generateRateLimitWrapper,
  generateAuditWrapper,
  generateValidationWrapper,
  createEarlyGuardPatch,
  createImportPatch,
  createBeforeReturnPatch,
  applyPatches,
  analyzeRouteFile,
  generateHandlerPatches,
  createFixPatches,
} from './nextjs-app-router.js';

export type {
  HttpMethod,
  HandlerLocation,
  RouteFile,
  InjectionPoint,
  EnforcementViolation,
  ASTNode,
  InjectionOptions,
  PatchPrimitive,
  FrameworkAdapter as NextJSFrameworkAdapter,
  Patch as NextJSPatch,
  Violation as NextJSViolation,
} from './nextjs-app-router.js';
