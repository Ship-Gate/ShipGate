# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: islMiddleware, router, TRPCMiddlewareOptions, TRPCContext
# dependencies: @trpc/server, @isl-lang/runtime-sdk/trpc

domain Trpc {
  version: "1.0.0"

  type TRPCMiddlewareOptions = String
  type TRPCContext = String

  invariants exports_present {
    - true
  }
}
