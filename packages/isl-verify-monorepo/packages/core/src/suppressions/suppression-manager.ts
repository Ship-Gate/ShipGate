import type { Finding } from '../types';

export class SuppressionManager {
  private suppressions: Set<string> = new Set();

  addSuppression(pattern: string): void {
    this.suppressions.add(pattern);
  }

  isSuppressed(finding: Finding): boolean {
    for (const pattern of this.suppressions) {
      if (this.matches(finding, pattern)) {
        return true;
      }
    }
    return false;
  }

  private matches(finding: Finding, pattern: string): boolean {
    // Simple pattern matching: rule:file or just rule
    const parts = pattern.split(':');
    if (parts.length === 1) {
      return finding.rule === parts[0];
    } else if (parts.length === 2) {
      return finding.rule === parts[0] && finding.file.includes(parts[1]);
    }
    return false;
  }

  filter(findings: Finding[]): Finding[] {
    return findings.filter((f) => !this.isSuppressed(f));
  }
}
