# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createCorpusFromSeeds, Corpus, SerializedCorpus, SerializedEntry
# dependencies: 

domain Corpus {
  version: "1.0.0"

  type Corpus = String
  type SerializedCorpus = String
  type SerializedEntry = String

  invariants exports_present {
    - true
  }
}
