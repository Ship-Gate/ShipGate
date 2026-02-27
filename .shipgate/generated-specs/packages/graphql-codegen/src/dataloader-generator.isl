# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createDataLoaders, createRequestContext, clearLoadersForRequest, batch, prime, generateDataLoaders, DataLoaderOptions, DataLoaderGenerator, DataLoaders, DataSources, RequestContext
# dependencies: dataloader

domain DataloaderGenerator {
  version: "1.0.0"

  type DataLoaderOptions = String
  type DataLoaderGenerator = String
  type DataLoaders = String
  type DataSources = String
  type RequestContext = String

  invariants exports_present {
    - true
  }
}
