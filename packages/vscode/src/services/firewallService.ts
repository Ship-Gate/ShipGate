/**
 * Live Firewall Service
 *
 * Uses @isl-lang/firewall to evaluate file content on save.
 * Maps violations to diagnostics and exposes status for the sidebar.
 */

import { createAgentFirewall } from '@isl-lang/firewall';
import type { FirewallResult, PolicyViolation } from '@isl-lang/firewall';

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']);

export interface FirewallState {
  status: 'idle' | 'checking' | 'allowed' | 'blocked';
  lastFile: string | null;
  lastResult: FirewallResult | null;
  violationCount: number;
}

export class FirewallService {
  private firewall = createAgentFirewall({
    mode: 'observe',
    projectRoot: process.cwd(),
    truthpackPath: '.shipgate/truthpack',
    timeout: 5000,
  });

  private state: FirewallState = {
    status: 'idle',
    lastFile: null,
    lastResult: null,
    violationCount: 0,
  };

  private listeners: Set<(s: FirewallState) => void> = new Set();

  configure(projectRoot: string, truthpackPath?: string): void {
    this.firewall = createAgentFirewall({
      mode: 'observe',
      projectRoot,
      truthpackPath: truthpackPath ?? '.shipgate/truthpack',
      timeout: 5000,
    });
  }

  isSupported(filePath: string): boolean {
    const ext = filePath.includes('.') ? filePath.slice(filePath.lastIndexOf('.')).toLowerCase() : '';
    return SUPPORTED_EXTENSIONS.has(ext);
  }

  async evaluate(filePath: string, content: string): Promise<FirewallResult> {
    this.setState({ status: 'checking' });

    try {
      const result = await this.firewall.evaluate({ filePath, content });
      this.setState({
        status: result.allowed ? 'allowed' : 'blocked',
        lastFile: filePath,
        lastResult: result,
        violationCount: result.violations.length,
      });
      return result;
    } catch (err) {
      this.setState({
        status: 'allowed',
        lastFile: filePath,
        lastResult: null,
        violationCount: 0,
      });
      throw err;
    }
  }

  getState(): FirewallState {
    return { ...this.state };
  }

  onStateChange(listener: (s: FirewallState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(partial: Partial<FirewallState>): void {
    this.state = { ...this.state, ...partial };
    for (const fn of this.listeners) {
      fn(this.state);
    }
  }
}

export function violationsToDiagnostics(
  result: FirewallResult
): Array<{ line: number; column: number; length: number; violation: PolicyViolation }> {
  const claimById = new Map(result.claims.map((c) => [c.id, c]));
  const out: Array<{ line: number; column: number; length: number; violation: PolicyViolation }> =
    [];

  for (const v of result.violations) {
    const claim = claimById.get(v.claimId);
    if (claim?.location) {
      const { line, column, length } = claim.location;
      out.push({
        line: line - 1,
        column: Math.max(0, column - 1),
        length,
        violation: v,
      });
    } else {
      const match = /^line-(\d+)$/.exec(v.claimId);
      const line = match ? parseInt(match[1], 10) - 1 : 0;
      out.push({ line, column: 0, length: 0, violation: v });
    }
  }
  return out;
}
