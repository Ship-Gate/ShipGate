# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SHIPGATE_RULE_TO_SOC2, GATE_PHASES_FOR_CC8, SOC2_CONTROL_META, SOC2ControlStatus, SOC2ControlMapping, ContributingCheck, EvidenceRef
# dependencies: 

domain Soc2Mapping {
  version: "1.0.0"

  type SOC2ControlStatus = String
  type SOC2ControlMapping = String
  type ContributingCheck = String
  type EvidenceRef = String

  invariants exports_present {
    - true
  }
}
