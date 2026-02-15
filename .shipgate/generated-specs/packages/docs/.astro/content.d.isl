# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getEntryBySlug, getDataEntryById, getCollection, getLiveCollection, getEntry, getLiveEntry, getEntries, render, reference, RenderResult, RenderedContent, CollectionKey, CollectionEntry, ContentCollectionKey, DataCollectionKey, ReferenceDataEntry, ReferenceContentEntry, ReferenceLiveEntry, ContentConfig, LiveContentConfig
# dependencies: 

domain ContentD {
  version: "1.0.0"

  type RenderResult = String
  type RenderedContent = String
  type CollectionKey = String
  type CollectionEntry = String
  type ContentCollectionKey = String
  type DataCollectionKey = String
  type ReferenceDataEntry = String
  type ReferenceContentEntry = String
  type ReferenceLiveEntry = String
  type ContentConfig = String
  type LiveContentConfig = String

  invariants exports_present {
    - true
  }
}
