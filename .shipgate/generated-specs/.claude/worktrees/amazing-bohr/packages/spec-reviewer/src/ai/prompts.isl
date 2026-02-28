# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getPromptById, getPromptsByCategory, fillPromptTemplate, createCustomPrompt, SYSTEM_PROMPT_BASE, reviewPrompts, ReviewPrompt
# dependencies: 

domain Prompts {
  version: "1.0.0"

  type ReviewPrompt = String

  invariants exports_present {
    - true
  }
}
