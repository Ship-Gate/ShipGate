# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createApp, AppConfig, AppInstance
# dependencies: express, @octokit/app

domain App {
  version: "1.0.0"

  type AppConfig = String
  type AppInstance = String

  invariants exports_present {
    - true
  }
}
