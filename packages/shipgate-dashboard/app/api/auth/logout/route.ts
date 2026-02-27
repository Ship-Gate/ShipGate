import { NextRequest, NextResponse } from 'next/server';
import { auditLog } from '@/lib/audit';

function parseSessionUserId(cookie: string | undefined): string | null {
  if (!cookie) return null;
  try {
    const json = Buffer.from(cookie, 'base64url').toString('utf8');
    const data = JSON.parse(json) as { id?: string };
    return data?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const sessionCookie = req.cookies.get('shipgate-session')?.value;
  const userId = parseSessionUserId(sessionCookie);
  if (userId) {
    auditLog(req, { userId }, 'auth.logout');
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('shipgate-session', '', { maxAge: 0, path: '/' });
  return res;
}
