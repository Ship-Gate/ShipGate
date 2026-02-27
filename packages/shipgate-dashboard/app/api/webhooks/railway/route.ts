import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';

function verifySignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

interface RailwayWebhookPayload {
  type: string;
  timestamp: string;
  data: {
    deployment: {
      id: string;
      status: string;
      url?: string;
      staticUrl?: string;
      meta?: {
        commitHash?: string;
        branch?: string;
        commitAuthor?: string;
      };
      createdAt: string;
    };
    project: {
      name: string;
    };
    environment: {
      name: string;
    };
  };
}

function mapRailwayStatus(status: string): string {
  const map: Record<string, string> = {
    DEPLOYING: 'building',
    SUCCESS: 'ready',
    FAILED: 'error',
    CRASHED: 'error',
    REMOVED: 'cancelled',
    BUILDING: 'building',
  };
  return map[status] ?? 'building';
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-railway-signature') ?? '';

  const providers = await prisma.deploymentProvider.findMany({
    where: { provider: 'railway' },
    select: { id: true, orgId: true, webhookSecret: true, projectFilter: true },
  });

  const matched = providers.find((p: { id: string; orgId: string; webhookSecret: string; projectFilter: string | null }) =>
    verifySignature(body, signature, p.webhookSecret)
  );

  if (!matched) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: RailwayWebhookPayload;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!event.type.includes('DEPLOY')) {
    return NextResponse.json({ data: { skipped: true } });
  }

  const d = event.data.deployment;
  const projectName = event.data.project.name;

  if (
    matched.projectFilter &&
    !projectName.toLowerCase().includes(matched.projectFilter.toLowerCase())
  ) {
    return NextResponse.json({ data: { filtered: true } });
  }

  const status = mapRailwayStatus(d.status);

  await prisma.deployment.upsert({
    where: { id: d.id },
    create: {
      id: d.id,
      providerId: matched.id,
      externalId: d.id,
      projectName,
      environment: event.data.environment.name,
      status,
      url: d.url ?? d.staticUrl ?? null,
      commitSha: d.meta?.commitHash ?? null,
      branch: d.meta?.branch ?? null,
      creator: d.meta?.commitAuthor ?? null,
      startedAt: new Date(d.createdAt),
      finishedAt: status === 'ready' || status === 'error' ? new Date() : null,
    },
    update: {
      status,
      url: d.url ?? d.staticUrl ?? undefined,
      finishedAt: status === 'ready' || status === 'error' ? new Date() : undefined,
    },
  });

  return NextResponse.json({ data: { received: true } });
}
