# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: StripeConfig, PaypalConfig, MockGatewayConfig, CreateChargeRequest, CreateChargeResponse, CaptureRequest, VoidRequest, UpdatePaymentRequest, CreateRefundRequest, CreateCheckoutRequest, CheckoutLineItemRequest, WebhookEvent, WebhookVerification, GatewayCapabilities, GatewayMetadata, GatewayFactory, GatewayRegistry, GatewayMiddleware, GatewayContext, GatewayMetrics, GatewayMonitor
# dependencies: 

domain Types {
  version: "1.0.0"

  type StripeConfig = String
  type PaypalConfig = String
  type MockGatewayConfig = String
  type CreateChargeRequest = String
  type CreateChargeResponse = String
  type CaptureRequest = String
  type VoidRequest = String
  type UpdatePaymentRequest = String
  type CreateRefundRequest = String
  type CreateCheckoutRequest = String
  type CheckoutLineItemRequest = String
  type WebhookEvent = String
  type WebhookVerification = String
  type GatewayCapabilities = String
  type GatewayMetadata = String
  type GatewayFactory = String
  type GatewayRegistry = String
  type GatewayMiddleware = String
  type GatewayContext = String
  type GatewayMetrics = String
  type GatewayMonitor = String

  invariants exports_present {
    - true
  }
}
