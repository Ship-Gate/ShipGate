# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: TestGenerationOptions, VitestTestGenerator
# dependencies: fs, vitest, ${options.handlerPath}, ${options.adapterPath}

domain VitestGenerator {
  version: "1.0.0"

  type TestGenerationOptions = String
  type VitestTestGenerator = String

  invariants exports_present {
    - true
  }
}
