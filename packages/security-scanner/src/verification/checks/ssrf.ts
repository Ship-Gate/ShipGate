/**
 * SSRF Check
 *
 * Scan for user-controlled URLs passed to fetch/axios without allowlist validation.
 */

import type { SecurityCheckResult, SecurityFinding } from '../types.js';

export const CHECK_ID = 'ssrf';

interface ScanInput {
  files: Array<{ path: string; content: string }>;
}

function scanFile(filePath: string, content: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNum = i + 1;

    // fetch(url) or axios.get(url) where url comes from req/input/params
    const fetchWithUserInput =
      /(?:fetch|axios\.(?:get|post|put|delete|request))\s*\(\s*(?:req\.(?:body|query|params)|input|params|body|request\.(?:body|query|params))\.\w+/;
    if (fetchWithUserInput.test(line)) {
      findings.push({
        id: 'SSRF001',
        title: 'User-controlled URL in fetch/axios',
        severity: 'high',
        file: filePath,
        line: lineNum,
        description:
          'URL passed to fetch/axios appears to come from user input. SSRF risk.',
        recommendation:
          'Validate URL against an allowlist. Block internal IPs (127.0.0.1, 10.x, 169.254.x).',
        snippet: line.trim(),
      });
    }

    // fetch(`${base}${userInput}`) or similar
    const templateUrl =
      /(?:fetch|axios\.\w+)\s*\(\s*`[^`]*\$\{(?:req|input|params|body|query)\.\w+\}/;
    if (templateUrl.test(line)) {
      findings.push({
        id: 'SSRF002',
        title: 'URL template with user input',
        severity: 'high',
        file: filePath,
        line: lineNum,
        description: 'URL built with user input. SSRF risk.',
        recommendation: 'Use allowlist validation before making the request.',
        snippet: line.trim(),
      });
    }

    // http.request or https.request with user URL
    const nodeHttp =
      /(?:http|https)\.request\s*\(\s*(?:req|input|params|body|query)\.\w+/;
    if (nodeHttp.test(line)) {
      findings.push({
        id: 'SSRF003',
        title: 'User-controlled URL in http.request',
        severity: 'high',
        file: filePath,
        line: lineNum,
        description: 'URL from user input passed to http.request. SSRF risk.',
        recommendation: 'Validate URL and block internal addresses.',
        snippet: line.trim(),
      });
    }
  }

  return findings;
}

export function runSsrfCheck(input: ScanInput): SecurityCheckResult {
  const findings: SecurityFinding[] = [];

  const extensions = /\.(ts|tsx|js|jsx)$/;
  for (const file of input.files) {
    if (extensions.test(file.path) && !file.path.includes('node_modules')) {
      findings.push(...scanFile(file.path, file.content));
    }
  }

  const criticalOrHigh = findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high'
  );

  return {
    check: CHECK_ID,
    severity: criticalOrHigh.length > 0 ? 'high' : 'low',
    passed: criticalOrHigh.length === 0,
    findings,
  };
}
