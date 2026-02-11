# Case Study: [Short Title]

**Date:** YYYY-MM-DD  
**Rule(s):** e.g. `ghost-route`, `auth/bypass-detected`  
**Severity:** critical | high | medium  
**Verdict:** NO_SHIP (blocked)

## Summary

One-sentence description of what was caught.

## Context

- **Scenario:** What the AI was asked to do
- **File(s):** Path(s) to affected code
- **Gate:** firewall | spec-gate | unified

## What Was Caught

Describe the violation. Include:
- Exact code snippet (redacted if sensitive)
- Why it would have been dangerous in production
- Evidence (route not in truthpack, env var undefined, etc.)

## Fix Applied

- **Manual fix:** What the developer did
- **Healer:** Did `isl heal` resolve it? (yes/no)

## Evidence

- Truthpack state at time of gate
- Firewall/spec gate output (redacted)

## Conclusion

What this case study proves about Shipgate's value.
