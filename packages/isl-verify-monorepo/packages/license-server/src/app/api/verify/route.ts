import { NextRequest, NextResponse } from 'next/server';
import { verifyLicense } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    try {
      const payload = verifyLicense(token);

      // Check expiry
      const expiresAt = new Date(payload.expiresAt);
      const now = new Date();

      if (expiresAt < now) {
        return NextResponse.json({
          valid: false,
          error: 'License expired',
          expiresAt: payload.expiresAt,
        });
      }

      return NextResponse.json({
        valid: true,
        tier: payload.tier,
        email: payload.email,
        expiresAt: payload.expiresAt,
        repoCount: payload.repoCount,
        features: payload.features,
      });
    } catch (error) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid license key',
      });
    }
  } catch (error) {
    console.error('Verify route error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
