# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createCommandBus, CommandMiddleware, Command, CommandMetadata, CommandResult, CommandHandler, CommandBusOptions, CommandBus
# dependencies: uuid

domain CommandBus {
  version: "1.0.0"

  type Command = String
  type CommandMetadata = String
  type CommandResult = String
  type CommandHandler = String
  type CommandBusOptions = String
  type CommandBus = String

  invariants exports_present {
    - true
  }
}
