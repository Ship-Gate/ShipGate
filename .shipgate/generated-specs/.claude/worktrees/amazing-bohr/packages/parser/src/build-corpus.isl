# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: buildCorpusFromDir, saveCorpus, loadCorpus, CorpusEntry
# dependencies: fs/promises, path

domain BuildCorpus {
  version: "1.0.0"

  type CorpusEntry = String

  invariants exports_present {
    - true
  }
}
