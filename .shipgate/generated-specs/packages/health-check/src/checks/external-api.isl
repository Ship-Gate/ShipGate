# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createExternalApiCheck, createStripeCheck, createPayPalCheck, createTwilioCheck, createSendGridCheck, createS3Check, createServiceChecks, createInternalServiceCheck, createGraphQLCheck, createGrpcCheck, ServiceEndpoint
# dependencies: 

domain ExternalApi {
  version: "1.0.0"

  type ServiceEndpoint = String

  invariants exports_present {
    - true
  }
}
