# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: execute, auditLog, errorHandler, start, loadConfig, FastifyAdapter, prisma, AuditEntry, FastifyConfig
# dependencies: @prisma/client, fastify-plugin, @fastify/jwt, @fastify/cors, @fastify/rate-limit, fastify

domain FastifyAdapter {
  version: "1.0.0"

  type AuditEntry = String
  type FastifyConfig = String

  invariants exports_present {
    - true
  }
}
