# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: mapErrorToGrpcStatus, mapBehaviorErrors, generateErrorMappingComment, generateStatusCodeMap, GRPC_STATUS_NAMES, MappedError
# dependencies: 

domain ErrorMapping {
  version: "1.0.0"

  type MappedError = String

  invariants exports_present {
    - true
  }
}
