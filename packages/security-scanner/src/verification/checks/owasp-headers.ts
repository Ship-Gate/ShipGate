/**
 * OWASP Headers Check
 *
 * Verify security headers middleware exists: CORS, CSP, HSTS, X-Frame-Options.
 */

import type { SecurityCheckResult, SecurityFinding } from '../types.js';

export const CHECK_ID = 'owasp-headers';

interface ScanInput {
  files: Array<{ path: string; content: string }>;
}

const HEADER_PATTERNS: Array<{
  name: string;
  patterns: RegExp[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}> = [
  {
    name: 'Content-Security-Policy',
    patterns: [/Content-Security-Policy|content-security-policy|csp/i],
    severity: 'medium',
    description: 'CSP helps prevent XSS and data injection.',
  },
  {
    name: 'Strict-Transport-Security',
    patterns: [
      /Strict-Transport-Security|strict-transport-security|hsts/i,
      /max-age=\s*\d+/,
    ],
    severity: 'high',
    description: 'HSTS forces HTTPS.',
  },
  {
    name: 'X-Frame-Options',
    patterns: [/X-Frame-Options|x-frame-options/i],
    severity: 'medium',
    description: 'Prevents clickjacking.',
  },
  {
    name: 'X-Content-Type-Options',
    patterns: [/X-Content-Type-Options|x-content-type-options|nosniff/i],
    severity: 'medium',
    description: 'Prevents MIME sniffing.',
  },
  {
    name: 'CORS',
    patterns: [
      /Access-Control-Allow-Origin|access-control-allow-origin|cors/i,
      /cors\s*\(|corsMiddleware|enableCors/,
    ],
    severity: 'high',
    description: 'CORS configuration for cross-origin requests.',
  },
];

function scanFile(filePath: string, content: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const foundHeaders = new Set<string>();

  for (const hp of HEADER_PATTERNS) {
    const found = hp.patterns.some((p) => p.test(content));
    if (found) {
      foundHeaders.add(hp.name);
    }
  }

  // Report missing critical/high headers
  const criticalHeaders = HEADER_PATTERNS.filter(
    (h) => h.severity === 'high' || h.severity === 'critical'
  );
  for (const hp of criticalHeaders) {
    if (!foundHeaders.has(hp.name)) {
      const firstLine = content.split('\n')[0] ?? '';
      findings.push({
        id: 'OWASP001',
        title: `Missing ${hp.name} / ${hp.name.replace(/-/g, ' ')}`,
        severity: hp.severity,
        file: filePath,
        line: 1,
        description: hp.description,
        recommendation: `Add ${hp.name} to security headers middleware.`,
        context: { header: hp.name },
      });
    }
  }

  // If no security headers at all
  if (foundHeaders.size === 0 && /middleware|app\.use|router\.use/.test(content)) {
    findings.push({
      id: 'OWASP002',
      title: 'No security headers middleware detected',
      severity: 'medium',
      file: filePath,
      line: 1,
      description: 'App uses middleware but no security headers (CSP, HSTS, X-Frame-Options) found.',
      recommendation:
        'Add helmet or similar middleware. Configure CORS, CSP, HSTS, X-Frame-Options.',
      context: {},
    });
  }

  return findings;
}

export function runOwaspHeadersCheck(input: ScanInput): SecurityCheckResult {
  const findings: SecurityFinding[] = [];

  // Look in typical locations: middleware, app entry, config
  const relevantFiles = input.files.filter(
    (f) =>
      /\.(ts|js|tsx|jsx)$/.test(f.path) &&
      !f.path.includes('node_modules') &&
      (f.path.includes('middleware') ||
        f.path.includes('app.') ||
        f.path.includes('index.') ||
        f.path.includes('server.') ||
        f.path.includes('main.') ||
        f.path.includes('config'))
  );

  if (relevantFiles.length === 0) {
    return {
      check: CHECK_ID,
      severity: 'low',
      passed: true,
      findings: [],
    };
  }

  for (const file of relevantFiles) {
    findings.push(...scanFile(file.path, file.content));
  }

  // Deduplicate by header
  const seen = new Set<string>();
  const uniqueFindings = findings.filter((f) => {
    const key = `${f.context?.header ?? f.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const criticalOrHigh = uniqueFindings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high'
  );

  return {
    check: CHECK_ID,
    severity: criticalOrHigh.length > 0 ? 'high' : 'medium',
    passed: criticalOrHigh.length === 0,
    findings: uniqueFindings,
  };
}
