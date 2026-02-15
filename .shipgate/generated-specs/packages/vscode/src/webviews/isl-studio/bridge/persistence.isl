# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createDefaultState, getStudioPersistence, resetStudioPersistence, MAX_RECENT_PROMPTS, STATE_VERSION, StoredPrompt, PersistedStudioState, StudioPersistenceOptions, StudioPersistence
# dependencies: 

domain Persistence {
  version: "1.0.0"

  type StoredPrompt = String
  type PersistedStudioState = String
  type StudioPersistenceOptions = String
  type StudioPersistence = String

  invariants exports_present {
    - true
  }
}
