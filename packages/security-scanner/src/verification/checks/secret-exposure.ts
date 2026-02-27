/**
 * Secret Exposure Check
 *
 * Regex scan for: API keys (sk_, pk_, key_), passwords, connection strings,
 * JWTs, private keys. Check .env is in .gitignore.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { SecurityCheckResult, SecurityFinding } from '../types.js';

export const CHECK_ID = 'secret-exposure';

interface ScanInput {
  rootDir: string;
  files: Array<{ path: string; content: string }>;
}

interface SecretPattern {
  id: string;
  pattern: RegExp;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    id: 'SEC001',
    pattern: /\b(sk_[a-zA-Z0-9]{24,})|(pk_[a-zA-Z0-9]{24,})\b/,
    severity: 'critical',
    title: 'Stripe-style API key detected',
    description: 'Stripe secret or publishable key pattern found. Ensure this is not committed.',
  },
  {
    id: 'SEC002',
    pattern: /\b(?:api[_-]?key|apikey)\s*[:=]\s*["'`][a-zA-Z0-9_\-]{20,}["'`]/i,
    severity: 'critical',
    title: 'API key assignment',
    description: 'Potential hardcoded API key.',
  },
  {
    id: 'SEC003',
    pattern: /\b(?:password|passwd|pwd)\s*[:=]\s*["'`][^"'`]{8,}["'`]/i,
    severity: 'critical',
    title: 'Hardcoded password',
    description: 'Password found in source. Use environment variables.',
  },
  {
    id: 'SEC004',
    pattern: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@/,
    severity: 'critical',
    title: 'MongoDB connection string with credentials',
    description: 'Database connection string with embedded credentials.',
  },
  {
    id: 'SEC005',
    pattern: /(?:mysql|postgres(?:ql)?):\/\/[^:]+:[^@]+@/i,
    severity: 'critical',
    title: 'SQL connection string with credentials',
    description: 'Database connection string with embedded credentials.',
  },
  {
    id: 'SEC006',
    pattern: /\b(?:Bearer|JWT)\s+eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/,
    severity: 'high',
    title: 'Hardcoded JWT token',
    description: 'JWT token in source. Tokens should be generated at runtime.',
  },
  {
    id: 'SEC007',
    pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/,
    severity: 'critical',
    title: 'Private key in source',
    description: 'Private key material found. Never commit private keys.',
  },
  {
    id: 'SEC008',
    pattern: /\b(?:secret|token)\s*[:=]\s*["'`][a-zA-Z0-9_\-]{16,}["'`]/i,
    severity: 'high',
    title: 'Hardcoded secret/token',
    description: 'Secret or token in source. Use env vars.',
  },
  {
    id: 'SEC009',
    pattern: /process\.env\.\w+\s*[=!]==\s*["'`][^"'`]+["'`]/,
    severity: 'low',
    title: 'Env comparison with literal',
    description: 'Comparing env var to literal may leak value in error messages.',
  },
];

function scanContent(
  filePath: string,
  content: string
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNum = i + 1;

    for (const sp of SECRET_PATTERNS) {
      const match = line.match(sp.pattern);
      if (match) {
        // Redact in output
        const snippet = line.trim().replace(/.{50,}/g, (m) => m.slice(0, 30) + '...[REDACTED]');
        findings.push({
          id: sp.id,
          title: sp.title,
          severity: sp.severity,
          file: filePath,
          line: lineNum,
          description: sp.description,
          recommendation: 'Use environment variables. Ensure .env is in .gitignore.',
          snippet,
          context: { patternId: sp.id },
        });
      }
    }
  }

  return findings;
}

async function checkGitignore(rootDir: string): Promise<SecurityFinding | null> {
  const gitignorePath = path.join(rootDir, '.gitignore');
  try {
    const content = await fs.readFile(gitignorePath, 'utf-8');
    const hasEnv = /^\.env$|^\.env\s|\.env$/m.test(content);
    if (!hasEnv) {
      return {
        id: 'SEC010',
        title: '.env not in .gitignore',
        severity: 'high',
        file: '.gitignore',
        line: 1,
        description: '.env file may be committed, exposing secrets.',
        recommendation: 'Add .env to .gitignore',
        context: { file: '.gitignore' },
      };
    }
  } catch {
    // No .gitignore - could be a finding
    return {
      id: 'SEC011',
      title: 'No .gitignore found',
      severity: 'medium',
      file: '.gitignore',
      line: 1,
      description: 'No .gitignore file. .env and other secrets may be committed.',
      recommendation: 'Create .gitignore and add .env',
    };
  }
  return null;
}

export async function runSecretExposureCheck(
  input: ScanInput
): Promise<SecurityCheckResult> {
  const findings: SecurityFinding[] = [];

  // Scan files
  const scanExtensions = /\.(ts|tsx|js|jsx|json|env|yaml|yml)$/;
  for (const file of input.files) {
    if (
      scanExtensions.test(file.path) &&
      !file.path.includes('node_modules') &&
      !file.path.includes('.test.') &&
      !file.path.includes('.spec.')
    ) {
      findings.push(...scanContent(file.path, file.content));
    }
  }

  // Check .gitignore
  const gitignoreFinding = await checkGitignore(input.rootDir);
  if (gitignoreFinding) {
    findings.push(gitignoreFinding);
  }

  const criticalOrHigh = findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high'
  );

  return {
    check: CHECK_ID,
    severity: criticalOrHigh.length > 0 ? 'critical' : 'medium',
    passed: criticalOrHigh.length === 0,
    findings,
  };
}
