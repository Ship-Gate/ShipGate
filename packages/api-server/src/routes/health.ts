import { Hono } from 'hono';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const app = new Hono();

const startTime = Date.now();

function loadVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };
    return pkg.version;
  } catch {
    return '1.0.0';
  }
}

const version = loadVersion();

const AVAILABLE_DETECTORS = [
  'security-scanner',
  'hallucination-scanner',
  'taint-tracker',
  'specless-gate',
  'isl-parser',
] as const;

app.get('/api/v1/health', (c) => {
  return c.json({
    status: 'ok',
    version,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    detectors: [...AVAILABLE_DETECTORS],
  });
});

export default app;
