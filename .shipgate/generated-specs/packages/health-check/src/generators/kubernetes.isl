# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateProbeYaml, createKubernetesProbes, livenessProbe, readinessProbe, ProbeResponse, ProbeBody, ProbeHandlers, KubernetesProbeGenerator, ProbeYamlConfig
# dependencies: 

domain Kubernetes {
  version: "1.0.0"

  type ProbeResponse = String
  type ProbeBody = String
  type ProbeHandlers = String
  type KubernetesProbeGenerator = String
  type ProbeYamlConfig = String

  invariants exports_present {
    - true
  }
}
