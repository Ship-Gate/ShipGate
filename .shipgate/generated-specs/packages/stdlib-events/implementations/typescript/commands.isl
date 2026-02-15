# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createCommand, validateCommand, Command, CommandSuccess, CommandError, CommandResult, CommandHandler, ICommandDispatcher, InMemoryCommandDispatcher
# dependencies: 

domain Commands {
  version: "1.0.0"

  type Command = String
  type CommandSuccess = String
  type CommandError = String
  type CommandResult = String
  type CommandHandler = String
  type ICommandDispatcher = String
  type InMemoryCommandDispatcher = String

  invariants exports_present {
    - true
  }
}
