import type { Finding } from '../types';

export class FindingFormatter {
  static toJSON(findings: Finding[]): string {
    return JSON.stringify(findings, null, 2);
  }

  static toTerminal(findings: Finding[]): string {
    return findings
      .map((f) => {
        const location = `${f.file}:${f.line}:${f.column}`;
        const severity = f.severity.toUpperCase();
        return `[${severity}] ${location} - ${f.message} (${f.rule})`;
      })
      .join('\n');
  }
}
