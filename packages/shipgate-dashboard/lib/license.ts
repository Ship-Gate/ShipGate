import { prisma } from './prisma';

const FREE_SCAN_LIMIT = 25;

export type LicenseStatus = {
  isPro: boolean;
  scansUsed: number;
  scansLimit: number;
  canScan: boolean;
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function getLicenseStatus(userId: string): Promise<LicenseStatus> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { isPro: true },
  });

  if (user.isPro) {
    return { isPro: true, scansUsed: 0, scansLimit: Infinity, canScan: true };
  }

  const meter = await prisma.usageMeter.findUnique({
    where: { userId_month: { userId, month: currentMonth() } },
  });

  const scansUsed = meter?.scans ?? 0;
  return {
    isPro: false,
    scansUsed,
    scansLimit: FREE_SCAN_LIMIT,
    canScan: scansUsed < FREE_SCAN_LIMIT,
  };
}

/**
 * Atomically increment scan count.
 * Returns the updated count or throws if over limit (free tier).
 */
export async function incrementScanUsage(userId: string): Promise<number> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { isPro: true },
  });

  if (user.isPro) return -1; // unlimited

  const month = currentMonth();

  const meter = await prisma.usageMeter.upsert({
    where: { userId_month: { userId, month } },
    create: { userId, month, scans: 1 },
    update: { scans: { increment: 1 } },
  });

  if (meter.scans > FREE_SCAN_LIMIT) {
    // rolled back by decrementing -- keep idempotent
    await prisma.usageMeter.update({
      where: { userId_month: { userId, month } },
      data: { scans: { decrement: 1 } },
    });
    throw new ScanLimitError(FREE_SCAN_LIMIT);
  }

  return meter.scans;
}

export class ScanLimitError extends Error {
  public readonly limit: number;
  constructor(limit: number) {
    super(`Monthly scan limit of ${limit} reached`);
    this.name = 'ScanLimitError';
    this.limit = limit;
  }
}

/**
 * Sync the DB isPro flag from Stripe subscription state.
 * Called by the Stripe webhook and during OAuth login.
 */
export async function syncStripeStatus(
  userId: string,
  isActive: boolean,
  stripeCustomerId?: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      isPro: isActive,
      ...(stripeCustomerId ? { stripeCustomerId } : {}),
      proExpiresAt: isActive ? null : new Date(),
    },
  });
}
