/**
 * XSS Check
 *
 * Scan React components for dangerouslySetInnerHTML, unescaped user input in JSX.
 */

import type { SecurityCheckResult, SecurityFinding } from '../types.js';

export const CHECK_ID = 'xss';

interface ScanInput {
  files: Array<{ path: string; content: string }>;
}

function scanFile(filePath: string, content: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNum = i + 1;

    // dangerouslySetInnerHTML - always flag for review
    if (/dangerouslySetInnerHTML/i.test(line)) {
      findings.push({
        id: 'XSS001',
        title: 'dangerouslySetInnerHTML usage',
        severity: 'high',
        file: filePath,
        line: lineNum,
        description:
          'dangerouslySetInnerHTML can introduce XSS if content is user-controlled.',
        recommendation:
          'Sanitize HTML with DOMPurify or similar. Prefer text content when possible.',
        snippet: line.trim(),
      });
    }

    // {variable} in JSX without sanitization - heuristic
    // Match { something } where something could be user input
    const jsxInterpolation = /\{\s*(?:user|input|data|content|html|body|message|text|value)\s*[\.\w]*\s*\}/i;
    if (jsxInterpolation.test(line) && /dangerouslySetInnerHTML/.test(line) === false) {
      // Only flag if we also see innerHTML or similar
      if (/innerHTML|insertAdjacentHTML|document\.write/i.test(content)) {
        findings.push({
          id: 'XSS002',
          title: 'Potential unescaped user input in HTML context',
          severity: 'medium',
          file: filePath,
          line: lineNum,
          description:
            'User/content variable may be rendered in HTML context without sanitization.',
          recommendation: 'Use text content or sanitize with DOMPurify before rendering.',
          snippet: line.trim(),
        });
      }
    }

    // document.innerHTML = or element.innerHTML =
    if (/\.innerHTML\s*=\s*(?!["'`])\w+/.test(line)) {
      findings.push({
        id: 'XSS003',
        title: 'innerHTML assignment with variable',
        severity: 'high',
        file: filePath,
        line: lineNum,
        description: 'innerHTML set from variable. Ensure content is sanitized.',
        recommendation: 'Use DOMPurify.sanitize() or textContent for user data.',
        snippet: line.trim(),
      });
    }
  }

  return findings;
}

export function runXssCheck(input: ScanInput): SecurityCheckResult {
  const findings: SecurityFinding[] = [];

  const reactExtensions = /\.(tsx|jsx)$/;
  for (const file of input.files) {
    if (
      reactExtensions.test(file.path) &&
      !file.path.includes('node_modules')
    ) {
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
