import { NextRequest } from 'next/server';
import getJackson from '@/lib/jackson';

export async function GET(req: NextRequest) {
  const { oauthController } = await getJackson();
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const token = authHeader.slice(7);
    const user = await oauthController.userInfo(token);
    return Response.json(user);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get user info';
    return Response.json({ error: message }, { status: 401 });
  }
}
