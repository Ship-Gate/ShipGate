import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type SessionData = { email?: string; id?: string; isPro?: boolean };

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

export function middleware(req: NextRequest) {
  const session = parseSession(req.cookies.get('shipgate-session')?.value);
  const path = req.nextUrl.pathname;

  // Dashboard: requires session + Pro
  if (path.startsWith('/dashboard')) {
    if (!session) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    if (!session.isPro) {
      return NextResponse.redirect(new URL('/checkout', req.url));
    }
  }

  // Checkout: requires session
  if (path === '/checkout') {
    if (!session) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    if (session.isPro) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  // Home: if logged in with Pro, go to dashboard; if logged in without Pro, go to checkout
  if (path === '/') {
    if (session) {
      return NextResponse.redirect(
        new URL(session.isPro ? '/dashboard' : '/checkout', req.url)
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
