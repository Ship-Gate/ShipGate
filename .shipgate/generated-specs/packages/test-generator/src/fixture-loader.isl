# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: detectFixtureVersion, upgradeFixtureToCurrent, normalizeParseResult, parseISL, loadFixture, loadFixtureFromPath, loadFixtures, FixtureVersion, NormalizedParseResult, LoadedFixture, FixtureLoadOptions, CURRENT_VERSION
# dependencies: @isl-lang/parser, fs, path

domain FixtureLoader {
  version: "1.0.0"

  type FixtureVersion = String
  type NormalizedParseResult = String
  type LoadedFixture = String
  type FixtureLoadOptions = String

  invariants exports_present {
    - true
  }
}
