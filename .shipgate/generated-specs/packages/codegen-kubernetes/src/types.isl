# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_OPTIONS, K8sResourceType, K8sGeneratorOptions, Domain, ServiceConfig, VolumeConfig, Behavior, Entity, GeneratedFile
# dependencies: 

domain Types {
  version: "1.0.0"

  type K8sResourceType = String
  type K8sGeneratorOptions = String
  type Domain = String
  type ServiceConfig = String
  type VolumeConfig = String
  type Behavior = String
  type Entity = String
  type GeneratedFile = String

  invariants exports_present {
    - true
  }
}
