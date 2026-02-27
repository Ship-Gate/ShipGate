import { NextRequest, NextResponse } from 'next/server';
import { verifyLicense } from '@/lib/jwt';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || '';

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 401 });
    }

    const payload = verifyLicense(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired license' }, { status: 401 });
    }

    const apiKey = process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      console.error('[verify] OPENAI_API_KEY not configured on server');
    }

    return NextResponse.json({
      active: true,
      email: payload.email,
      plan: payload.plan,
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
      apiKey: apiKey,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
