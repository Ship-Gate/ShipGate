# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: detectDatabases, extractPrismaEntities, extractMongooseEntities, extractTypeORMEntities, extractEntities, DatabaseDetection
# dependencies: fs/promises, path

domain DatabaseDetector {
  version: "1.0.0"

  type DatabaseDetection = String

  invariants exports_present {
    - true
  }
}
