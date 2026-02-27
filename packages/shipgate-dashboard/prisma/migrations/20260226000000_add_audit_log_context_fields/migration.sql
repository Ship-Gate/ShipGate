-- AlterTable (additive - preserves existing audit entries)
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "requestId" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;

-- CreateIndex (for audit export filtering by action)
CREATE INDEX IF NOT EXISTS "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt" DESC);
