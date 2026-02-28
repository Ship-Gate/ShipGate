# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createGateway, GatewayOptions, UpstreamConfig, GatewayConfig, TLSConfig, GatewayRequest, GatewayResponse, ISLGateway, GatewayHealth
# dependencies: @isl-lang/isl-core

domain Gateway {
  version: "1.0.0"

  type GatewayOptions = String
  type UpstreamConfig = String
  type GatewayConfig = String
  type TLSConfig = String
  type GatewayRequest = String
  type GatewayResponse = String
  type ISLGateway = String
  type GatewayHealth = String

  invariants exports_present {
    - true
  }
}
