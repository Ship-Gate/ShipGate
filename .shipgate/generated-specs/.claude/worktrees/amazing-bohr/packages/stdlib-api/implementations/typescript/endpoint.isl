# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: validateEndpoint, extractPathParams, buildUrl, generateCrudEndpoints, createApiDefinition, RelationType, RoutePattern, EndpointId, Endpoint, ResourceRelation, ResourceOperation, Resource, ApiDefinition
# dependencies: 

domain Endpoint {
  version: "1.0.0"

  type RoutePattern = String
  type EndpointId = String
  type Endpoint = String
  type ResourceRelation = String
  type ResourceOperation = String
  type Resource = String
  type ApiDefinition = String

  invariants exports_present {
    - true
  }
}
