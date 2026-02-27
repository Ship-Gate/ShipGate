# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: BaseWebSocketConnection, ServerWebSocketConnection, WebSocketConnectionFactory, WebSocketConnectionPool
# dependencies: 

domain Connection {
  version: "1.0.0"

  type BaseWebSocketConnection = String
  type ServerWebSocketConnection = String
  type WebSocketConnectionFactory = String
  type WebSocketConnectionPool = String

  invariants exports_present {
    - true
  }
}
