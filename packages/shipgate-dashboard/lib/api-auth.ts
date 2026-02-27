import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';

export type MembershipRole = 'admin' | 'member' | 'viewer';

export type AuthContext = {
  userId: string;
  email: string;
  orgIds: string[];
  /** Role per org. Use getRole(orgId) to check. */
  orgRoles: Map<string, MembershipRole>;
};

export function getRole(auth: AuthContext, orgId: string): MembershipRole | null {
  return auth.orgRoles.get(orgId) ?? null;
}

/**
 * Require the user to have one of the allowed roles in the given org.
 * Returns 403 if no org access or role not in allowedRoles.
 */
export function requireOrgRole(
  auth: AuthContext,
  orgId: string,
  allowedRoles: MembershipRole[]
): NextResponse | null {
  const orgErr = assertOrgAccess(auth, orgId);
  if (orgErr) return orgErr;
  const role = getRole(auth, orgId);
  if (!role || !allowedRoles.includes(role)) {
    return NextResponse.json(
      { error: 'Forbidden: insufficient permissions for this organization' },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Require the user to be admin or member in at least one org.
 * Use for actions that have no orgId (e.g. token management).
 * Viewers cannot create/revoke tokens.
 */
export function requireAdminOrMember(auth: AuthContext): NextResponse | null {
  const hasWriteRole = [...auth.orgRoles.values()].some(
    (r) => r === 'admin' || r === 'member'
  );
  if (!hasWriteRole) {
    return NextResponse.json(
      { error: 'Forbidden: viewer role cannot perform this action' },
      { status: 403 }
    );
  }
  return null;
}

type SessionPayload = {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  provider?: string;
  isPro?: boolean;
};

function parseCookieSession(cookie: string | undefined): SessionPayload | null {
  if (!cookie) return null;
  try {
    const json = Buffer.from(cookie, 'base64url').toString('utf8');
    const data = JSON.parse(json) as SessionPayload;
    return data?.email && data?.id ? data : null;
  } catch {
    return null;
  }
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Authenticate a request via cookie session or Bearer PAT.
 * Returns AuthContext on success, or a 401 NextResponse on failure.
 */
export async function authenticate(
  req: NextRequest
): Promise<AuthContext | NextResponse> {
  // Try Bearer token first (CLI / extension)
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const rawToken = authHeader.slice(7);
    const tokenHash = hashToken(rawToken);

    const pat = await prisma.personalAccessToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { memberships: { select: { orgId: true, role: true } } } } },
    });

    if (!pat || (pat.expiresAt && pat.expiresAt < new Date())) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Touch lastUsedAt (fire-and-forget)
    prisma.personalAccessToken
      .update({ where: { id: pat.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});

    const orgRoles = new Map<string, MembershipRole>();
    for (const m of pat.user.memberships) {
      orgRoles.set(m.orgId, m.role);
    }
    return {
      userId: pat.user.id,
      email: pat.user.email,
      orgIds: pat.user.memberships.map((m) => m.orgId),
      orgRoles,
    };
  }

  // Try cookie session (browser)
  const sessionCookie = req.cookies.get('shipgate-session')?.value;
  const session = parseCookieSession(sessionCookie);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find or create user + default org
  const user = await ensureUser(session);
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    select: { orgId: true, role: true },
  });

  const orgRoles = new Map<string, MembershipRole>();
  for (const m of memberships) {
    orgRoles.set(m.orgId, m.role);
  }

  return {
    userId: user.id,
    email: user.email,
    orgIds: memberships.map((m) => m.orgId),
    orgRoles,
  };
}

/**
 * Ensure a user record exists for this OAuth session.
 * Creates the user and a personal org on first login.
 */
async function ensureUser(session: SessionPayload) {
  let user = await prisma.user.findUnique({ where: { email: session.email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: session.email,
        name: session.name ?? session.email.split('@')[0],
        avatar: session.avatar,
        provider: session.provider ?? 'unknown',
        providerAccountId: session.id,
      },
    });

    // Create a default personal org
    const orgName = `${user.name ?? user.email}'s Workspace`;
    const org = await prisma.org.create({ data: { name: orgName } });
    await prisma.membership.create({
      data: { userId: user.id, orgId: org.id, role: 'admin' },
    });
  }

  return user;
}

/**
 * Helper: check if authenticated user has access to a given org.
 */
export function assertOrgAccess(auth: AuthContext, orgId: string): NextResponse | null {
  if (!auth.orgIds.includes(orgId)) {
    return NextResponse.json({ error: 'Forbidden: no access to this org' }, { status: 403 });
  }
  return null;
}
