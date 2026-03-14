import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireOrgRole } from '@/lib/api-auth';
import { auditLog } from '@/lib/audit';
import getJackson from '@/lib/jackson';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    await connectionAPIController.deleteConnections({
      clientID: params.id,
      clientSecret: '',
      tenant: orgId,
      product: 'shipgate',
    } as Parameters<typeof connectionAPIController.deleteConnections>[0]);

    auditLog(req, auth, 'sso.connection_deleted', `sso:${params.id}`, orgId);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete SSO connection';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
