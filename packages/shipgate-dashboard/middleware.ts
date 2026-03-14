import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type SessionData = { email?: string; id?: string; isPro?: boolean; plan?: string; provider?: string };

const ENTERPRISE_ONLY_PATHS = ['/dashboard/settings/sso', '/dashboard/settings/audit'];

function parseSession(cookie: string | undefined): SessionData | null {
  if (!cookie) return null;
  try {
    const json = atob(cookie.replace(/-/g, '+').replace(/_/g, '/'));
    const data = JSON.parse(json) as SessionData;
    return data?.email && data?.id ? data : null;
  } catch {
    return null;
  }
}

function getEffectivePlan(session: SessionData): string {
  if (session.plan) return session.plan;
  if (session.isPro) return 'pro';
  return 'free';
}

export function middleware(req: NextRequest) {
  const session = parseSession(req.cookies.get('shipgate-session')?.value);
  const path = req.nextUrl.pathname;

  // SAML auth routes — always pass through
  if (path.startsWith('/api/auth/saml')) {
    return NextResponse.next();
  }

  // Dashboard: requires session + paid plan
  if (path.startsWith('/dashboard')) {
    if (!session) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    const plan = getEffectivePlan(session);

    if (plan === 'free') {
      return NextResponse.redirect(new URL('/checkout', req.url));
    }

    if (plan === 'pro' && ENTERPRISE_ONLY_PATHS.some((p) => path.startsWith(p))) {
      return NextResponse.redirect(new URL('/dashboard/settings?upgrade=enterprise', req.url));
    }
  }

  // Checkout: requires session
  if (path === '/checkout') {
    if (!session) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    const plan = getEffectivePlan(session);
    if (plan === 'enterprise') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  // Home: redirect based on plan
  if (path === '/') {
    if (session) {
      const plan = getEffectivePlan(session);
      return NextResponse.redirect(
        new URL(plan !== 'free' ? '/dashboard' : '/checkout', req.url)
      );
    }
  }

  // Inject requestId on API routes
  if (path.startsWith('/api/')) {
    const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
    const res = NextResponse.next();
    res.headers.set('x-request-id', requestId);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/checkout', '/dashboard', '/dashboard/:path*', '/api/:path*'],
};
