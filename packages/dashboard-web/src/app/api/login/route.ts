import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const AUTH_COOKIE_NAME = 'shipgate-auth';
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = formData.get('password') as string | null;
  const redirectTo = (formData.get('redirect') as string | null) ?? '/dashboard';
  const expected = process.env.DASHBOARD_PASSWORD;

  if (!expected) {
    return NextResponse.json(
      { success: false, error: 'Dashboard login is not configured' },
      { status: 400 }
    );
  }

  if (!password || password !== expected) {
    return NextResponse.json(
      { success: false, error: 'Invalid password' },
      { status: 401 }
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: '/',
  });

  const url = new URL(redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`, request.url);
  return NextResponse.redirect(url);
}
