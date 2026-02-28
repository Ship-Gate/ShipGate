# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: profile, profileAsync, getProfileData, clearProfileData, ProfileEntry, ProfileReport, Hotspot, PerformanceProfiler
# dependencies: 

domain Profiler {
  version: "1.0.0"

  type ProfileEntry = String
  type ProfileReport = String
  type Hotspot = String
  type PerformanceProfiler = String

  invariants exports_present {
    - true
  }
}
