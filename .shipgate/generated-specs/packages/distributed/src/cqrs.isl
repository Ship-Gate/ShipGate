# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createCommand, createQuery, commandHandler, queryHandler, commandToISL, queryToISL, loggingCommandMiddleware, loggingQueryMiddleware, CommandBus, CommandMiddleware, QueryBus, QueryMiddleware
# dependencies: 

domain Cqrs {
  version: "1.0.0"

  type CommandBus = String
  type CommandMiddleware = String
  type QueryBus = String
  type QueryMiddleware = String

  invariants exports_present {
    - true
  }
}
