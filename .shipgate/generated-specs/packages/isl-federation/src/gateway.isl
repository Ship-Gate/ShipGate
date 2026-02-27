# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateGateway, GatewayConfig, GeneratedGateway
# dependencies: http-proxy-middleware

domain Gateway {
  version: "1.0.0"

  type GatewayConfig = String
  type GeneratedGateway = String

  invariants exports_present {
    - true
  }
}
