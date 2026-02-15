# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: extractISLContextFromMetadata, injectISLContextToMetadata, traceUnaryCall, traceClientStreamingCall, traceServerStreamingCall, traceBidiStreamingCall, traceService, GrpcInstrumentationOptions, GrpcCall
# dependencies: @opentelemetry/api

domain Grpc {
  version: "1.0.0"

  type GrpcInstrumentationOptions = String
  type GrpcCall = String

  invariants exports_present {
    - true
  }
}
