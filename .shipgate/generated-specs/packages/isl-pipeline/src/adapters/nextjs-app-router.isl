# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: detect, isRouteFile, parseHandlers, locateHandlers, extractRoutePath, findInjectionPoints, checkEnforcementOrder, generateRateLimitWrapper, generateAuditWrapper, generateValidationWrapper, createEarlyGuardPatch, createImportPatch, createBeforeReturnPatch, applyPatches, analyzeRouteFile, generateHandlerPatches, createFixPatches, NextJSAppRouterAdapter, __isl_intents, FrameworkAdapter, Patch, Violation, HttpMethod, HandlerLocation, RouteFile, InjectionPoint, EnforcementViolation, ASTNode, InjectionOptions, PatchPrimitive
# dependencies: fs/promises, path, @/lib/rate-limit, @/lib/audit, zod, @/lib/validation

domain NextjsAppRouter {
  version: "1.0.0"

  type FrameworkAdapter = String
  type Patch = String
  type Violation = String
  type HttpMethod = String
  type HandlerLocation = String
  type RouteFile = String
  type InjectionPoint = String
  type EnforcementViolation = String
  type ASTNode = String
  type InjectionOptions = String
  type PatchPrimitive = String

  invariants exports_present {
    - true
  }
}
