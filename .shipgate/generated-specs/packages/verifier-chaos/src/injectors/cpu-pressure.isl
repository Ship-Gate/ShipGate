# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createCpuPressure, createModerateCpuPressure, createHeavyCpuPressure, CpuPressureConfig, CpuPressureState, CpuPressureInjector
# dependencies: 

domain CpuPressure {
  version: "1.0.0"

  type CpuPressureConfig = String
  type CpuPressureState = String
  type CpuPressureInjector = String

  invariants exports_present {
    - true
  }
}
