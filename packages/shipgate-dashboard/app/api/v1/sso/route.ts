import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireOrgRole } from '@/lib/api-auth';
import { auditLog } from '@/lib/audit';
import getJackson from '@/lib/jackson';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const orgId = req.nextUrl.searchParams.get('orgId');
  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  const roleErr = requireOrgRole(auth, orgId, ['admin']);
  if (roleErr) return roleErr;

  try {
    const { connectionAPIController } = await getJackson();
    const connections = await connectionAPIController.getConnections({
      tenant: orgId,
      product: 'shipgate',
    });
    return NextResponse.json({ ok: true, data: connections });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list SSO connections';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as {
    orgId: string;
    metadataUrl?: string;
    rawMetadata?: string;
  };

  if (!body.orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  const roleErr = requireOrgRole(auth, body.orgId, ['admin']);
  if (roleErr) return roleErr;

  if (!body.metadataUrl && !body.rawMetadata) {
    return NextResponse.json(
      { error: 'metadataUrl or rawMetadata is required' },
      { status: 400 }
    );
  }

  try {
    const { connectionAPIController } = await getJackson();
    const redirectUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/auth/saml/callback`;

    const connectionParams: Record<string, unknown> = {
      tenant: body.orgId,
      product: 'shipgate',
      redirectUrl: [redirectUrl],
      defaultRedirectUrl: redirectUrl,
    };

    if (body.metadataUrl) {
      connectionParams.metadataUrl = body.metadataUrl;
    } else if (body.rawMetadata) {
      connectionParams.rawMetadata = body.rawMetadata;
    }

    const connection = await connectionAPIController.createSAMLConnection(
      connectionParams as Parameters<typeof connectionAPIController.createSAMLConnection>[0]
    );

    auditLog(req, auth, 'sso.connection_created', `org:${body.orgId}`, body.orgId);

    return NextResponse.json({ ok: true, data: connection }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create SSO connection';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
