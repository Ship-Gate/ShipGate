# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateDataLoaders, createLoaders, generateBatchLoader, generateRelationshipLoaders, DataLoaderConfig, Loaders
# dependencies: dataloader

domain Dataloader {
  version: "1.0.0"

  type DataLoaderConfig = String
  type Loaders = String

  invariants exports_present {
    - true
  }
}
