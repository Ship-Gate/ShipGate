# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ElasticsearchClient, ElasticsearchAuditStorageOptions, ElasticsearchAuditStorage
# dependencies: 

domain Elasticsearch {
  version: "1.0.0"

  type ElasticsearchClient = String
  type ElasticsearchAuditStorageOptions = String
  type ElasticsearchAuditStorage = String

  invariants exports_present {
    - true
  }
}
