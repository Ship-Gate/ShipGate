/**
 * PCI-DSS v4.0 Compliance Framework Mapping
 * 
 * Maps ISL constructs to PCI-DSS requirements for payment card
 * industry data security standard compliance.
 */

import type { FrameworkControl, ISLMapping, ControlMapping, Domain, ControlStatus, ComplianceEvidence, RiskLevel } from '../types';

export const PCI_REQUIREMENTS: FrameworkControl[] = [
  // Requirement 3: Protect Stored Cardholder Data
  {
    id: '3.3.1',
    name: 'PAN Display Masking',
    description: 'Mask PAN when displayed (first six and last four digits max)',
    category: 'Protect Stored Cardholder Data',
    islMappings: [
      { type: 'field', pattern: /last_four|masked_pan|card_mask/i, description: 'Field stores only last 4 digits' },
      { type: 'annotation', pattern: '[masked]', description: 'Field marked as masked' },
    ],
  },
  {
    id: '3.4.1',
    name: 'PAN Encryption',
    description: 'Render PAN unreadable anywhere it is stored',
    category: 'Protect Stored Cardholder Data',
    islMappings: [
      { type: 'annotation', pattern: '[sensitive]', description: 'Field marked sensitive' },
      { type: 'annotation', pattern: '[secret]', description: 'Field marked secret' },
      { type: 'spec', pattern: /encrypted_in_transit|encrypted_at_rest/i, description: 'Encryption spec defined' },
    ],
  },
  {
    id: '3.5.1',
    name: 'Key Management',
    description: 'Document and implement key management procedures',
    category: 'Protect Stored Cardholder Data',
    islMappings: [
      { type: 'spec', pattern: /key_rotation|encryption_key/i, description: 'Key rotation policy' },
      { type: 'spec', pattern: /temporal.*key.*rotated/i, description: 'Temporal key rotation spec' },
    ],
  },
  {
    id: '3.6.1',
    name: 'Cryptographic Key Protection',
    description: 'Protect cryptographic keys used to protect stored account data',
    category: 'Protect Stored Cardholder Data',
    islMappings: [
      { type: 'annotation', pattern: '[secret]', description: 'Key marked as secret' },
      { type: 'spec', pattern: /key.*never_logged|key.*never_exposed/i, description: 'Key protection invariant' },
    ],
  },
  
  // Requirement 6: Develop and Maintain Secure Systems
  {
    id: '6.2.1',
    name: 'Secure Development Process',
    description: 'Bespoke and custom software is developed securely',
    category: 'Develop Secure Systems',
    islMappings: [
      { type: 'behavior', pattern: /.*/, description: 'ISL spec-first development' },
      { type: 'spec', pattern: /precondition|postcondition/i, description: 'Contract specifications' },
    ],
  },
  {
    id: '6.2.2',
    name: 'Security Training',
    description: 'Software development personnel receive training on secure development',
    category: 'Develop Secure Systems',
    islMappings: [
      { type: 'spec', pattern: /security.*spec/i, description: 'Security specifications documented' },
    ],
  },
  {
    id: '6.3.1',
    name: 'Security Vulnerabilities',
    description: 'Security vulnerabilities are identified and addressed',
    category: 'Develop Secure Systems',
    islMappings: [
      { type: 'spec', pattern: /chaos.*test|security.*test/i, description: 'Security testing' },
      { type: 'spec', pattern: /verify|verification/i, description: 'Formal verification' },
    ],
  },
  {
    id: '6.4.1',
    name: 'Change Management',
    description: 'Changes to system components are managed',
    category: 'Develop Secure Systems',
    islMappings: [
      { type: 'spec', pattern: /version|changelog/i, description: 'Version tracking' },
    ],
  },
  {
    id: '6.5.1',
    name: 'Injection Attacks',
    description: 'Protect against injection attacks',
    category: 'Develop Secure Systems',
    islMappings: [
      { type: 'spec', pattern: /sanitize|validate|escape/i, description: 'Input validation' },
      { type: 'annotation', pattern: '[validated]', description: 'Validated annotation' },
    ],
  },
  
  // Requirement 7: Restrict Access
  {
    id: '7.2.1',
    name: 'Access Control System',
    description: 'Access control system established for system components',
    category: 'Restrict Access',
    islMappings: [
      { type: 'spec', pattern: /actor|permission|role/i, description: 'Actor-based access control' },
      { type: 'spec', pattern: /requires.*authentication/i, description: 'Authentication requirement' },
    ],
  },
  {
    id: '7.2.2',
    name: 'Privilege Assignment',
    description: 'Access is assigned based on job classification and function',
    category: 'Restrict Access',
    islMappings: [
      { type: 'spec', pattern: /actor.*permission/i, description: 'Actor permissions defined' },
      { type: 'spec', pattern: /authorization/i, description: 'Authorization rules' },
    ],
  },
  
  // Requirement 8: Identify Users
  {
    id: '8.3.1',
    name: 'User Authentication',
    description: 'Strong authentication for users and administrators',
    category: 'Identify Users',
    islMappings: [
      { type: 'spec', pattern: /authentication|auth/i, description: 'Authentication spec' },
      { type: 'spec', pattern: /mfa|multi.?factor/i, description: 'MFA requirement' },
    ],
  },
  {
    id: '8.6.1',
    name: 'Authentication Mechanisms',
    description: 'Use of authentication mechanisms is managed',
    category: 'Identify Users',
    islMappings: [
      { type: 'spec', pattern: /session|token/i, description: 'Session management' },
      { type: 'spec', pattern: /jwt|oauth/i, description: 'Token-based auth' },
    ],
  },
  
  // Requirement 10: Track and Monitor Access
  {
    id: '10.2.1',
    name: 'Audit Logs',
    description: 'Audit logs capture user activities and security events',
    category: 'Track and Monitor',
    islMappings: [
      { type: 'spec', pattern: /observability|logs/i, description: 'Observability spec' },
      { type: 'spec', pattern: /audit|log/i, description: 'Audit logging' },
    ],
  },
  {
    id: '10.3.1',
    name: 'Log Contents',
    description: 'Audit logs record required information',
    category: 'Track and Monitor',
    islMappings: [
      { type: 'spec', pattern: /user_id|actor|timestamp/i, description: 'Structured log fields' },
      { type: 'spec', pattern: /log.*level|log.*message/i, description: 'Log structure' },
    ],
  },
  {
    id: '10.5.1',
    name: 'Log Protection',
    description: 'Audit log history is retained and available for analysis',
    category: 'Track and Monitor',
    islMappings: [
      { type: 'spec', pattern: /log.*encrypt|log.*protect/i, description: 'Log encryption' },
      { type: 'spec', pattern: /log.*retention/i, description: 'Log retention policy' },
    ],
  },
  {
    id: '10.7.1',
    name: 'Security Event Detection',
    description: 'Detect and respond to failures of critical security controls',
    category: 'Track and Monitor',
    islMappings: [
      { type: 'spec', pattern: /alert|monitoring/i, description: 'Alerting spec' },
      { type: 'spec', pattern: /metric|trace/i, description: 'Metrics and tracing' },
    ],
  },
  
  // Requirement 11: Test Security
  {
    id: '11.3.1',
    name: 'Vulnerability Scans',
    description: 'Internal and external vulnerability scans performed',
    category: 'Test Security',
    islMappings: [
      { type: 'spec', pattern: /test|verify|scan/i, description: 'Security testing' },
    ],
  },
  {
    id: '11.4.1',
    name: 'Penetration Testing',
    description: 'External and internal penetration testing performed',
    category: 'Test Security',
    islMappings: [
      { type: 'spec', pattern: /chaos|fault.*injection/i, description: 'Chaos testing' },
      { type: 'spec', pattern: /penetration|security.*test/i, description: 'Penetration testing' },
    ],
  },
  
  // Requirement 12: Information Security Policy
  {
    id: '12.1.1',
    name: 'Security Policy',
    description: 'Information security policy is established and maintained',
    category: 'Information Security',
    islMappings: [
      { type: 'spec', pattern: /compliance|policy/i, description: 'Compliance spec' },
      { type: 'spec', pattern: /security.*spec/i, description: 'Security specification' },
    ],
  },
];

export class PCIDSSFramework {
  private controls: FrameworkControl[];

  constructor() {
    this.controls = PCI_REQUIREMENTS;
  }

  getControls(): FrameworkControl[] {
    return this.controls;
  }

  getControlById(id: string): FrameworkControl | undefined {
    return this.controls.find(c => c.id === id);
  }

  getControlsByCategory(category: string): FrameworkControl[] {
    return this.controls.filter(c => c.category === category);
  }

  mapDomain(domain: Domain): ControlMapping[] {
    const mappings: ControlMapping[] = [];

    for (const control of this.controls) {
      const evidence = this.collectEvidence(domain, control);
      const status = this.determineStatus(evidence, control);

      mappings.push({
        controlId: control.id,
        controlName: control.name,
        description: control.description,
        status,
        evidence,
        risk: this.assessRisk(status, control),
      });
    }

    return mappings;
  }

  private collectEvidence(domain: Domain, control: FrameworkControl): ComplianceEvidence[] {
    const evidence: ComplianceEvidence[] = [];

    for (const mapping of control.islMappings) {
      switch (mapping.type) {
        case 'annotation':
          evidence.push(...this.findAnnotationEvidence(domain, mapping));
          break;
        case 'field':
          evidence.push(...this.findFieldEvidence(domain, mapping));
          break;
        case 'behavior':
          evidence.push(...this.findBehaviorEvidence(domain, mapping));
          break;
        case 'spec':
          evidence.push(...this.findSpecEvidence(domain, mapping));
          break;
      }
    }

    return evidence;
  }

  private findAnnotationEvidence(domain: Domain, mapping: ISLMapping): ComplianceEvidence[] {
    const evidence: ComplianceEvidence[] = [];
    const pattern = typeof mapping.pattern === 'string' ? mapping.pattern : mapping.pattern.source;

    for (const type of domain.types) {
      for (const field of type.fields) {
        if (field.annotations?.some(a => a.includes(pattern))) {
          evidence.push({
            type: 'isl_spec',
            source: `${type.name}.${field.name}`,
            content: `Field annotated with ${pattern}`,
          });
        }
      }
    }

    return evidence;
  }

  private findFieldEvidence(domain: Domain, mapping: ISLMapping): ComplianceEvidence[] {
    const evidence: ComplianceEvidence[] = [];
    const pattern = mapping.pattern instanceof RegExp ? mapping.pattern : new RegExp(mapping.pattern, 'i');

    for (const type of domain.types) {
      for (const field of type.fields) {
        if (pattern.test(field.name)) {
          evidence.push({
            type: 'isl_spec',
            source: `${type.name}.${field.name}`,
            content: mapping.description,
          });
        }
      }
    }

    return evidence;
  }

  private findBehaviorEvidence(domain: Domain, mapping: ISLMapping): ComplianceEvidence[] {
    const evidence: ComplianceEvidence[] = [];

    for (const behavior of domain.behaviors) {
      if (behavior.security || behavior.compliance) {
        evidence.push({
          type: 'isl_spec',
          source: `behavior ${behavior.name}`,
          content: `Behavior has security/compliance specifications`,
        });
      }
    }

    return evidence;
  }

  private findSpecEvidence(domain: Domain, mapping: ISLMapping): ComplianceEvidence[] {
    const evidence: ComplianceEvidence[] = [];
    const pattern = mapping.pattern instanceof RegExp ? mapping.pattern : new RegExp(mapping.pattern, 'i');

    // Check domain-level compliance
    if (domain.compliance?.pci_dss) {
      for (const [key, value] of Object.entries(domain.compliance.pci_dss)) {
        if (pattern.test(key) || pattern.test(String(value))) {
          evidence.push({
            type: 'isl_spec',
            source: `compliance.pci_dss.${key}`,
            content: String(value),
          });
        }
      }
    }

    // Check behaviors
    for (const behavior of domain.behaviors) {
      if (behavior.observability && pattern.test('observability')) {
        evidence.push({
          type: 'isl_spec',
          source: `${behavior.name}.observability`,
          content: 'Observability spec defined',
        });
      }

      if (behavior.security) {
        if (behavior.security.authentication && pattern.test('authentication')) {
          evidence.push({
            type: 'isl_spec',
            source: `${behavior.name}.security.authentication`,
            content: behavior.security.authentication,
          });
        }
        if (behavior.security.rateLimit && pattern.test('rate')) {
          evidence.push({
            type: 'isl_spec',
            source: `${behavior.name}.security.rateLimit`,
            content: `${behavior.security.rateLimit.requests}/${behavior.security.rateLimit.window}`,
          });
        }
      }
    }

    // Check actors
    if (domain.actors && pattern.test('actor')) {
      for (const actor of domain.actors) {
        evidence.push({
          type: 'isl_spec',
          source: `actor ${actor.name}`,
          content: `Permissions: ${actor.permissions.join(', ')}`,
        });
      }
    }

    return evidence;
  }

  private determineStatus(evidence: ComplianceEvidence[], control: FrameworkControl): ControlStatus {
    if (evidence.length === 0) {
      return 'not_implemented';
    }

    const requiredMappings = control.islMappings.length;
    const foundMappings = new Set(evidence.map(e => e.type)).size;

    if (foundMappings >= requiredMappings) {
      return 'implemented';
    } else if (foundMappings > 0) {
      return 'partial';
    }

    return 'not_implemented';
  }

  private assessRisk(status: ControlStatus, control: FrameworkControl): RiskLevel {
    const criticalControls = ['3.4.1', '3.5.1', '8.3.1', '10.2.1'];
    const highRiskControls = ['3.3.1', '6.5.1', '7.2.1', '10.5.1'];

    if (status === 'not_implemented') {
      if (criticalControls.includes(control.id)) return 'critical';
      if (highRiskControls.includes(control.id)) return 'high';
      return 'medium';
    }

    if (status === 'partial') {
      if (criticalControls.includes(control.id)) return 'high';
      return 'medium';
    }

    return 'low';
  }
}
