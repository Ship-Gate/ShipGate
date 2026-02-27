import type { ProofBundle } from '@isl-verify/core';
import type { ControlResult } from '../types';

export class SOC2Framework {
  static readonly CONTROLS = [
    { id: 'CC6.1', name: 'Logical Access Controls', category: 'Common Criteria' },
    { id: 'CC6.2', name: 'Authentication', category: 'Common Criteria' },
    { id: 'CC6.3', name: 'Authorization', category: 'Common Criteria' },
    { id: 'CC7.1', name: 'Data Detection', category: 'Common Criteria' },
    { id: 'CC7.2', name: 'Security Monitoring', category: 'Common Criteria' },
  ];

  static evaluate(bundle: ProofBundle): ControlResult[] {
    const results: ControlResult[] = [];

    // CC6.1 - Logical Access Controls
    results.push({
      controlId: 'CC6.1',
      name: 'Logical Access Controls',
      description: 'System enforces logical access security controls',
      status: this.hasAuthChecks(bundle) ? 'pass' : 'fail',
      evidence: this.collectAuthEvidence(bundle),
      recommendations: this.hasAuthChecks(bundle)
        ? undefined
        : ['Implement authentication and authorization checks'],
    });

    // CC6.2 - Authentication
    results.push({
      controlId: 'CC6.2',
      name: 'Authentication',
      description: 'System authenticates users before granting access',
      status: this.hasAuthChecks(bundle) ? 'pass' : 'fail',
      evidence: this.collectAuthEvidence(bundle),
    });

    // CC6.3 - Authorization
    results.push({
      controlId: 'CC6.3',
      name: 'Authorization',
      description: 'System authorizes user actions',
      status: this.hasAuthChecks(bundle) ? 'pass' : 'fail',
      evidence: this.collectAuthEvidence(bundle),
    });

    // CC7.1 - Data Detection
    results.push({
      controlId: 'CC7.1',
      name: 'Data Detection',
      description: 'System detects security events',
      status: 'partial',
      evidence: ['Static analysis performed'],
      recommendations: ['Add runtime monitoring'],
    });

    // CC7.2 - Security Monitoring
    results.push({
      controlId: 'CC7.2',
      name: 'Security Monitoring',
      description: 'System monitors for security violations',
      status: 'partial',
      evidence: ['Verification pipeline active'],
      recommendations: ['Add continuous monitoring'],
    });

    return results;
  }

  private static hasAuthChecks(bundle: ProofBundle): boolean {
    return bundle.provers.some((p) =>
      p.properties.some((prop) => prop.property === 'auth_enforcement' && prop.status === 'pass')
    );
  }

  private static collectAuthEvidence(bundle: ProofBundle): string[] {
    const evidence: string[] = [];
    bundle.provers.forEach((prover) => {
      prover.properties.forEach((prop) => {
        if (prop.property === 'auth_enforcement' && prop.status === 'pass') {
          evidence.push(`${prover.name}: ${prop.message}`);
        }
      });
    });
    return evidence.length > 0 ? evidence : ['No authentication checks detected'];
  }
}
