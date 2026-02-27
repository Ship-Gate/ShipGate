import { NextRequest, NextResponse } from 'next/server';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: string;
  isPro?: boolean;
};

function parseSession(cookie: string | undefined): SessionUser | null {
  if (!cookie) return null;
  try {
    const json = Buffer.from(cookie, 'base64url').toString('utf8');
    const data = JSON.parse(json) as SessionUser & { at?: number };
    if (!data.email || !data.id) return null;
    return {
      id: data.id,
      email: data.email,
      name: data.name ?? data.email,
      avatar: data.avatar,
      provider: data.provider,
      isPro: data.isPro ?? false,
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = parseSession(req.cookies.get('shipgate-session')?.value);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(session);
}
