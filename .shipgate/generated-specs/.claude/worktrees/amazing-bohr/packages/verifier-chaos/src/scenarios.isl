# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parseChaosScenarios, parseScenarioNames, createChaosScenario, validateScenario, getSupportedInjectionTypes, InjectionType, ChaosInjection, ChaosAssertion, ParsedChaosScenario, ChaosStep, ScenarioParseResult, ScenarioError
# dependencies: 

domain Scenarios {
  version: "1.0.0"

  type InjectionType = String
  type ChaosInjection = String
  type ChaosAssertion = String
  type ParsedChaosScenario = String
  type ChaosStep = String
  type ScenarioParseResult = String
  type ScenarioError = String

  invariants exports_present {
    - true
  }
}
