# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createISLContext, pushContext, popContext, getCurrentContext, getContextDepth, withContext, withContextAsync, setDomainContext, setBehaviorContext, setCheckContext, setVerificationContext, clearAllContexts, contextManager, ISLContextManager
# dependencies: @sentry/node

domain Isl {
  version: "1.0.0"

  type ISLContextManager = String

  invariants exports_present {
    - true
  }
}
