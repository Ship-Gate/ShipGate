import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

export const DOMAIN_NAMES = [
  'tiny-crud',
  'auth-roles',
  'payments-idempotency',
  'async-jobs',
  'event-sourcing',
  'multi-tenant-saas',
  'realtime-websocket',
  'file-storage',
  'audit-compliance',
  'hard-mode',
] as const;

export type DomainName = (typeof DOMAIN_NAMES)[number];

export interface SampleExpected {
  claims: Record<string, unknown>[];
  verdicts: Record<string, unknown>;
}

export interface Sample {
  name: DomainName;
  islPath: string;
  isl: string;
  expected: SampleExpected;
}

function loadSample(name: DomainName): Sample {
  const dir = resolve(ROOT, name);
  const islPath = resolve(dir, 'domain.isl');
  const isl = readFileSync(islPath, 'utf-8');
  const claimsFile = JSON.parse(readFileSync(resolve(dir, 'expected', 'claims.json'), 'utf-8')) as { claims: Record<string, unknown>[] };
  const verdicts = JSON.parse(readFileSync(resolve(dir, 'expected', 'verdicts.json'), 'utf-8')) as Record<string, unknown>;
  return { name, islPath, isl, expected: { claims: claimsFile.claims, verdicts } };
}

const _cache = new Map<DomainName, Sample>();

export function getSample(name: DomainName): Sample {
  if (!_cache.has(name)) {
    _cache.set(name, loadSample(name));
  }
  return _cache.get(name)!;
}

export function getAllSamples(): Sample[] {
  return DOMAIN_NAMES.map(getSample);
}

export const samples: Record<DomainName, Sample> = Object.fromEntries(
  DOMAIN_NAMES.map((name) => [name, getSample(name)])
) as Record<DomainName, Sample>;
