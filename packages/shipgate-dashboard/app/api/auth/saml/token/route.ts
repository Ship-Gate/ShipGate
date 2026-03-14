import { NextRequest } from 'next/server';
import getJackson from '@/lib/jackson';

export async function POST(req: NextRequest) {
  const { oauthController } = await getJackson();
  const body = await req.json();

  try {
    const tokenResponse = await oauthController.token(body);
    return Response.json(tokenResponse);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Token exchange failed';
    return Response.json({ error: message }, { status: 400 });
  }
}
