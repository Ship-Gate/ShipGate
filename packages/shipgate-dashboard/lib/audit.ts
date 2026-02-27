import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '@/lib/api-auth';

export type AuditRequestContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  sessionId?: string | null;
};

/**
 * Extract IP, user-agent, request ID, and session ID from a request.
 * Use for audit log context capture.
 */
export function getAuditRequestContext(req: NextRequest): AuditRequestContext {
  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null;
  const userAgent = req.headers.get('user-agent');
  const requestId = req.headers.get('x-request-id') ?? null;
  const sessionCookie = req.cookies?.get?.('shipgate-session')?.value;
  const sessionId = sessionCookie
    ? createHash('sha256').update(sessionCookie).digest('hex').slice(0, 16)
    : null;

  return { ipAddress, userAgent, requestId, sessionId };
}

type AuditActor = AuthContext | { userId: string };

/**
 * Fire-and-forget audit log entry.
 * Failures are silently ignored to avoid disrupting the main request.
 */
export function audit(
  auth: AuditActor,
  action: string,
  resource?: string,
  orgId?: string,
  meta?: Record<string, unknown>,
  requestContext?: AuditRequestContext
): void {
  prisma.auditLog
    .create({
      data: {
        userId: auth.userId,
        action,
        resource,
        orgId,
        metaJson: (meta as Prisma.InputJsonValue) ?? undefined,
        ipAddress: requestContext?.ipAddress ?? undefined,
        userAgent: requestContext?.userAgent ?? undefined,
        requestId: requestContext?.requestId ?? undefined,
        sessionId: requestContext?.sessionId ?? undefined,
      },
    })
    .catch(() => {});
}

/**
 * Audit log with auto-captured request context (IP, user-agent, request ID, session).
 * Use this when a NextRequest is available.
 */
export function auditLog(
  req: NextRequest,
  actor: AuditActor,
  action: string,
  resource?: string,
  orgId?: string,
  meta?: Record<string, unknown>
): void {
  const ctx = getAuditRequestContext(req);
  audit(actor, action, resource, orgId, meta, ctx);
}
