# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: CloudProvider, InfraFeature, GenerateOptions, GeneratedFile, TerraformBlock, TerraformValue, TerraformObject, TerraformReference, TerraformExpression, InfrastructureRequirements, DatabaseRequirements, QueueRequirements, StorageRequirements, CacheRequirements, ComputeRequirements, NetworkRequirements, SecurityRequirements, RateLimitConfig, MonitoringRequirements, AlarmConfig, VariableDefinition, OutputDefinition
# dependencies: 

domain Types {
  version: "1.0.0"

  type CloudProvider = String
  type InfraFeature = String
  type GenerateOptions = String
  type GeneratedFile = String
  type TerraformBlock = String
  type TerraformValue = String
  type TerraformObject = String
  type TerraformReference = String
  type TerraformExpression = String
  type InfrastructureRequirements = String
  type DatabaseRequirements = String
  type QueueRequirements = String
  type StorageRequirements = String
  type CacheRequirements = String
  type ComputeRequirements = String
  type NetworkRequirements = String
  type SecurityRequirements = String
  type RateLimitConfig = String
  type MonitoringRequirements = String
  type AlarmConfig = String
  type VariableDefinition = String
  type OutputDefinition = String

  invariants exports_present {
    - true
  }
}
