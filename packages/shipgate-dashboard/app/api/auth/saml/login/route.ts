import { NextRequest } from 'next/server';
import getJackson from '@/lib/jackson';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { oauthController } = await getJackson();
  const tenant = req.nextUrl.searchParams.get('tenant');
  const email = req.nextUrl.searchParams.get('email');

  let orgId = tenant;

  if (!orgId && email) {
    const domain = email.split('@')[1];
    if (domain) {
      const org = await prisma.org.findFirst({
        where: { ssoDomain: domain, ssoEnabled: true },
        select: { id: true },
      });
      orgId = org?.id ?? null;
    }
  }

  if (!orgId) {
    return Response.json({ error: 'SSO not configured for this domain' }, { status: 400 });
  }

  const redirectUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/auth/saml/callback`;
  const state = Buffer.from(JSON.stringify({ orgId })).toString('base64url');

  try {
    const { redirect_url } = await oauthController.authorize({
      tenant: orgId,
      product: 'shipgate',
      redirect_uri: redirectUrl,
      state,
      response_type: 'code',
      scope: '',
    });

    if (!redirect_url) {
      return Response.json({ error: 'SAML connection not configured' }, { status: 400 });
    }

    return Response.redirect(redirect_url, 302);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'SAML login failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
