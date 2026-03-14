/**
 * Load .env from process.cwd() so OPENAI_API_KEY / ANTHROPIC_API_KEY
 * work when running shipgate from a project root that has a .env file.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

try {
  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eq = trimmed.indexOf('=');
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
          if (key && process.env[key] === undefined) process.env[key] = value;
        }
      }
    }
  }
} catch {
  // ignore
}
