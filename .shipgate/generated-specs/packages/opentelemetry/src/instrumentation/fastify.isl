# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: registerISLPlugin, createBehaviorHook, createVerificationHook, completeBehaviorOnSend, completeVerificationOnSend, getISLContextFromRequest, runInRequestContext, islFastifyPlugin, FastifyInstrumentationOptions
# dependencies: @opentelemetry/api

domain Fastify {
  version: "1.0.0"

  type FastifyInstrumentationOptions = String

  invariants exports_present {
    - true
  }
}
