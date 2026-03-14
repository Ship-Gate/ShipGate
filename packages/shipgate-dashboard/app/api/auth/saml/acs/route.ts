import { NextRequest } from 'next/server';
import getJackson from '@/lib/jackson';

export async function POST(req: NextRequest) {
  const { oauthController } = await getJackson();

  const formData = await req.formData();
  const SAMLResponse = formData.get('SAMLResponse') as string;
  const RelayState = formData.get('RelayState') as string;

  try {
    const { redirect_url } = await oauthController.samlResponse({
      SAMLResponse,
      RelayState,
    });

    if (!redirect_url) {
      return Response.json({ error: 'SAML response processing failed' }, { status: 400 });
    }

    return Response.redirect(redirect_url, 302);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'SAML ACS error';
    return Response.json({ error: message }, { status: 500 });
  }
}
