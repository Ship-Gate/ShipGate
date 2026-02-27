import type { Finding, ProverResult } from '../types';

export interface ProverContext {
  file: string;
  source: string;
  tier: 'tier1' | 'tier2' | 'tier3';
}

export abstract class BaseProver {
  abstract readonly name: string;
  abstract readonly tier: number;
  abstract readonly properties: string[];

  abstract verify(context: ProverContext): Promise<ProverResult>;

  protected createFinding(
    rule: string,
    message: string,
    file: string,
    line: number,
    column: number,
    severity: 'error' | 'warning' | 'info' = 'error'
  ): Finding {
    return {
      id: `${rule}-${file}-${line}-${column}`,
      rule,
      message,
      severity,
      file,
      line,
      column,
    };
  }
}
