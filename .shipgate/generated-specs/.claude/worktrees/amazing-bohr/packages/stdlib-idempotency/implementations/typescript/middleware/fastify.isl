# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: idempotencyPlugin, createIdempotencyHandler, FastifyRequest, FastifyReply, FastifyInstance, FastifyPluginOptions
# dependencies: fastify, @isl-lang/stdlib-idempotency/middleware/fastify, @isl-lang/stdlib-idempotency/store/memory

domain Fastify {
  version: "1.0.0"

  type FastifyRequest = String
  type FastifyReply = String
  type FastifyInstance = String
  type FastifyPluginOptions = String

  invariants exports_present {
    - true
  }
}
