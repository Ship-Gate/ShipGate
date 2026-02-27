import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { prisma } from '@/lib/prisma';

function verifySignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac('sha1', secret).update(body).digest('hex');
  return signature === expected;
}

interface VercelWebhookPayload {
  id: string;
  type: string;
  createdAt: number;
  payload: {
    deploymentId: string;
    name: string;
    url?: string;
    state?: string;
    meta?: {
      githubCommitSha?: string;
      githubCommitRef?: string;
      githubCommitAuthorLogin?: string;
    };
    target?: string;
    createdAt?: number;
    readyAt?: number;
  };
}

function mapVercelStatus(type: string, state?: string): string {
  if (type === 'deployment.error') return 'error';
  if (type === 'deployment.canceled') return 'cancelled';
  if (type === 'deployment.ready') return 'ready';
  if (state === 'BUILDING') return 'building';
  if (state === 'READY') return 'ready';
  if (state === 'ERROR') return 'error';
  return 'building';
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-vercel-signature') ?? '';

  const providers = await prisma.deploymentProvider.findMany({
    where: { provider: 'vercel' },
    select: { id: true, orgId: true, webhookSecret: true, projectFilter: true },
  });

  const matched = providers.find((p: { id: string; orgId: string; webhookSecret: string; projectFilter: string | null }) =>
    verifySignature(body, signature, p.webhookSecret)
  );

  if (!matched) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: VercelWebhookPayload;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!event.type.startsWith('deployment')) {
    return NextResponse.json({ data: { skipped: true } });
  }

  const p = event.payload;

  if (
    matched.projectFilter &&
    !p.name.toLowerCase().includes(matched.projectFilter.toLowerCase())
  ) {
    return NextResponse.json({ data: { filtered: true } });
  }

  const status = mapVercelStatus(event.type, p.state);

  await prisma.deployment.upsert({
    where: { id: p.deploymentId },
    create: {
      id: p.deploymentId,
      providerId: matched.id,
      externalId: p.deploymentId,
      projectName: p.name,
      environment: p.target ?? 'preview',
      status,
      url: p.url ? `https://${p.url}` : null,
      commitSha: p.meta?.githubCommitSha ?? null,
      branch: p.meta?.githubCommitRef ?? null,
      creator: p.meta?.githubCommitAuthorLogin ?? null,
      startedAt: new Date(p.createdAt ?? event.createdAt),
      finishedAt: status === 'ready' || status === 'error' ? new Date() : null,
    },
    update: {
      status,
      url: p.url ? `https://${p.url}` : undefined,
      finishedAt: status === 'ready' || status === 'error' ? new Date() : undefined,
    },
  });

  return NextResponse.json({ data: { received: true } });
}
