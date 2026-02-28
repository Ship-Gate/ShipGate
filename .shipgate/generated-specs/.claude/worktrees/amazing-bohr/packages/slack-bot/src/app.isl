# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createApp, startApp, BotConfig
# dependencies: @slack/bolt

domain App {
  version: "1.0.0"

  type BotConfig = String

  invariants exports_present {
    - true
  }
}
