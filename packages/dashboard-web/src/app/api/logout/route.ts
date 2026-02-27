import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const AUTH_COOKIE_NAME = 'shipgate-auth';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  const url = new URL('/login', request.url);
  return NextResponse.redirect(url);
}
