import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const HEADER = 'x-request-id';

export function getRequestId(req: NextRequest): string {
  return req.headers.get(HEADER) ?? randomUUID();
}

export function withRequestId(res: NextResponse, requestId: string): NextResponse {
  res.headers.set(HEADER, requestId);
  return res;
}
