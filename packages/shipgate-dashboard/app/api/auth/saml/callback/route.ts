import { NextRequest, NextResponse } from 'next/server';
import getJackson from '@/lib/jackson';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/audit';
import { getLicenseStatus } from '@/lib/license';

export async function GET(req: NextRequest) {
  const { oauthController } = await getJackson();

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');

  if (!code) {
    return NextResponse.redirect(new URL('/?error=saml_no_code', req.url));
  }

  let orgId: string | null = null;
  if (state) {
    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      orgId = parsed.orgId;
    } catch {}
  }

  try {
    const redirectUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/auth/saml/callback`;
    const tokenRes = await oauthController.token({
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUrl,
      client_id: 'dummy',
      client_secret: 'dummy',
    });

    const accessToken = (tokenRes as { access_token?: string }).access_token;
    if (!accessToken) {
      return NextResponse.redirect(new URL('/?error=saml_token_failed', req.url));
    }

    const profile = await oauthController.userInfo(accessToken);
    const email = (profile as { email?: string }).email;
    const firstName = (profile as { firstName?: string }).firstName ?? '';
    const lastName = (profile as { lastName?: string }).lastName ?? '';
    const name = [firstName, lastName].filter(Boolean).join(' ') || email?.split('@')[0] || 'SSO User';

    if (!email) {
      return NextResponse.redirect(new URL('/?error=saml_no_email', req.url));
    }

    if (!orgId) {
      const domain = email.split('@')[1];
      const org = await prisma.org.findFirst({
        where: { ssoDomain: domain, ssoEnabled: true },
        select: { id: true },
      });
      orgId = org?.id ?? null;
    }

    if (!orgId) {
      return NextResponse.redirect(new URL('/?error=saml_no_org', req.url));
    }

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          provider: 'saml',
          providerAccountId: `saml:${email}`,
        },
      });
    }

    const existingMembership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: user.id, orgId } },
    });

    if (!existingMembership) {
      await prisma.membership.create({
        data: { userId: user.id, orgId, role: 'member' },
      });
    }

    const license = await getLicenseStatus(user.id);
    const isPro = license.isPro;

    const sessionPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      provider: 'saml',
      isPro,
      at: Date.now(),
    };

    const session = Buffer.from(JSON.stringify(sessionPayload)).toString('base64url');

    auditLog(req, { userId: user.id }, 'auth.sso_login', undefined, orgId, {
      provider: 'saml',
    });

    const destination = isPro ? '/dashboard' : '/checkout';
    const res = NextResponse.redirect(new URL(destination, req.url));
    res.cookies.set('shipgate-session', session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return res;
  } catch (err: unknown) {
    console.error('SAML callback error:', err);
    return NextResponse.redirect(new URL('/?error=saml_failed', req.url));
  }
}
