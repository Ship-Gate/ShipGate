/**
 * Framework Adapters
 * 
 * Adapters for detecting and patching different web frameworks.
 * 
 * @module @isl-lang/pipeline/adapters
 */

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
