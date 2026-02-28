# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: findSimilarCommand, metaCommands, islCommands, CommandResult, MetaCommand, ISLCommand
# dependencies: fs, path, @isl-lang/parser

domain Commands {
  version: "1.0.0"

  type CommandResult = String
  type MetaCommand = String
  type ISLCommand = String

  invariants exports_present {
    - true
  }
}
