/**
 * HIPAA Security Rule Compliance Framework Mapping
 * 
 * Maps ISL constructs to HIPAA Security Rule requirements for
 * healthcare data protection compliance.
 */

import type { FrameworkControl, ISLMapping, ControlMapping, Domain, ControlStatus, ComplianceEvidence, RiskLevel } from '../types';

export const HIPAA_RULES: FrameworkControl[] = [
  // Administrative Safeguards (§164.308)
  {
    id: '164.308(a)(1)',
    name: 'Security Management Process',
    description: 'Implement policies and procedures to prevent, detect, and correct security violations',
    category: 'Administrative Safeguards',
    islMappings: [
      { type: 'spec', pattern: /security.*spec|policy/i, description: 'Security policies' },
      { type: 'spec', pattern: /risk.*assessment|risk.*analysis/i, description: 'Risk analysis' },
    ],
  },
  {
    id: '164.308(a)(3)',
    name: 'Workforce Security',
    description: 'Implement procedures for authorization and supervision of workforce members',
    category: 'Administrative Safeguards',
    islMappings: [
      { type: 'spec', pattern: /actor|role|permission/i, description: 'Workforce access control' },
      { type: 'spec', pattern: /authorization|access.*control/i, description: 'Authorization procedures' },
    ],
  },
  {
    id: '164.308(a)(4)',
    name: 'Information Access Management',
    description: 'Implement policies and procedures for authorizing access to ePHI',
    category: 'Administrative Safeguards',
    islMappings: [
      { type: 'spec', pattern: /authentication|auth/i, description: 'Access authorization' },
      { type: 'spec', pattern: /permission|access.*level/i, description: 'Access levels' },
      { type: 'annotation', pattern: '[phi]', description: 'PHI annotation' },
    ],
  },
  {
    id: '164.308(a)(5)',
    name: 'Security Awareness Training',
    description: 'Implement security awareness and training program',
    category: 'Administrative Safeguards',
    islMappings: [
      { type: 'spec', pattern: /training|awareness/i, description: 'Training program' },
    ],
  },
  {
    id: '164.308(a)(6)',
    name: 'Security Incident Procedures',
    description: 'Implement policies and procedures to address security incidents',
    category: 'Administrative Safeguards',
    islMappings: [
      { type: 'spec', pattern: /incident|security.*event/i, description: 'Incident procedures' },
      { type: 'spec', pattern: /alert|notification/i, description: 'Incident notification' },
    ],
  },
  {
    id: '164.308(a)(7)',
    name: 'Contingency Plan',
    description: 'Establish policies and procedures for responding to emergency situations',
    category: 'Administrative Safeguards',
    islMappings: [
      { type: 'spec', pattern: /backup|recovery|disaster/i, description: 'Contingency planning' },
      { type: 'spec', pattern: /failover|redundancy/i, description: 'Emergency procedures' },
    ],
  },
  {
    id: '164.308(a)(8)',
    name: 'Evaluation',
    description: 'Perform periodic technical and nontechnical evaluation',
    category: 'Administrative Safeguards',
    islMappings: [
      { type: 'spec', pattern: /audit|evaluation|review/i, description: 'Security evaluation' },
      { type: 'spec', pattern: /test|verify/i, description: 'Security testing' },
    ],
  },
  
  // Physical Safeguards (§164.310)
  {
    id: '164.310(a)(1)',
    name: 'Facility Access Controls',
    description: 'Implement policies and procedures to limit physical access',
    category: 'Physical Safeguards',
    islMappings: [
      { type: 'spec', pattern: /physical.*access|facility/i, description: 'Facility access' },
    ],
  },
  {
    id: '164.310(b)',
    name: 'Workstation Use',
    description: 'Implement policies and procedures for workstation use',
    category: 'Physical Safeguards',
    islMappings: [
      { type: 'spec', pattern: /workstation|device.*policy/i, description: 'Workstation policy' },
    ],
  },
  {
    id: '164.310(d)',
    name: 'Device and Media Controls',
    description: 'Implement policies and procedures for receipt and removal of hardware and media',
    category: 'Physical Safeguards',
    islMappings: [
      { type: 'spec', pattern: /media.*disposal|device.*control/i, description: 'Media controls' },
      { type: 'behavior', pattern: /dispose|destroy|wipe/i, description: 'Data disposal' },
    ],
  },
  
  // Technical Safeguards (§164.312)
  {
    id: '164.312(a)(1)',
    name: 'Access Control',
    description: 'Implement technical policies and procedures for access to ePHI',
    category: 'Technical Safeguards',
    islMappings: [
      { type: 'spec', pattern: /authentication|auth/i, description: 'Unique user identification' },
      { type: 'spec', pattern: /session|timeout|logout/i, description: 'Automatic logoff' },
      { type: 'spec', pattern: /encrypt/i, description: 'Encryption and decryption' },
    ],
  },
  {
    id: '164.312(b)',
    name: 'Audit Controls',
    description: 'Implement hardware, software, and procedural mechanisms to record and examine activity',
    category: 'Technical Safeguards',
    islMappings: [
      { type: 'spec', pattern: /audit|log/i, description: 'Audit logging' },
      { type: 'spec', pattern: /observability/i, description: 'Activity monitoring' },
      { type: 'spec', pattern: /trace/i, description: 'Activity tracing' },
    ],
  },
  {
    id: '164.312(c)(1)',
    name: 'Integrity',
    description: 'Implement policies and procedures to protect ePHI from improper alteration or destruction',
    category: 'Technical Safeguards',
    islMappings: [
      { type: 'spec', pattern: /integrity|checksum|hash/i, description: 'Data integrity' },
      { type: 'spec', pattern: /invariant/i, description: 'Data invariants' },
      { type: 'spec', pattern: /validate|verify/i, description: 'Validation mechanisms' },
    ],
  },
  {
    id: '164.312(d)',
    name: 'Person or Entity Authentication',
    description: 'Implement procedures to verify identity of person or entity seeking access',
    category: 'Technical Safeguards',
    islMappings: [
      { type: 'spec', pattern: /authentication|verify.*identity/i, description: 'Authentication' },
      { type: 'spec', pattern: /mfa|multi.?factor/i, description: 'Multi-factor auth' },
      { type: 'spec', pattern: /actor.*auth/i, description: 'Actor authentication' },
    ],
  },
  {
    id: '164.312(e)(1)',
    name: 'Transmission Security',
    description: 'Implement technical security measures to guard against unauthorized access during transmission',
    category: 'Technical Safeguards',
    islMappings: [
      { type: 'spec', pattern: /encrypt.*transit|tls|https/i, description: 'Transit encryption' },
      { type: 'annotation', pattern: '[sensitive]', description: 'Sensitive data marking' },
      { type: 'spec', pattern: /integrity.*check/i, description: 'Integrity controls' },
    ],
  },
  
  // Organizational Requirements (§164.314)
  {
    id: '164.314(a)(1)',
    name: 'Business Associate Contracts',
    description: 'Ensure satisfactory assurances from business associates',
    category: 'Organizational Requirements',
    islMappings: [
      { type: 'spec', pattern: /vendor|third.*party|business.*associate/i, description: 'BA management' },
    ],
  },
  
  // Policies and Documentation (§164.316)
  {
    id: '164.316(a)',
    name: 'Policies and Procedures',
    description: 'Implement reasonable and appropriate policies and procedures',
    category: 'Policies and Documentation',
    islMappings: [
      { type: 'spec', pattern: /policy|procedure/i, description: 'Documented policies' },
      { type: 'spec', pattern: /compliance.*hipaa/i, description: 'HIPAA compliance spec' },
    ],
  },
  {
    id: '164.316(b)(1)',
    name: 'Documentation',
    description: 'Maintain documentation of policies and procedures',
    category: 'Policies and Documentation',
    islMappings: [
      { type: 'spec', pattern: /document|specification/i, description: 'Documentation' },
      { type: 'behavior', pattern: /.*/, description: 'ISL specifications as documentation' },
    ],
  },
];

export class HIPAAFramework {
  private controls: FrameworkControl[];

  constructor() {
    this.controls = HIPAA_RULES;
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
      const pattern = mapping.pattern instanceof RegExp ? mapping.pattern : new RegExp(mapping.pattern, 'i');

      // Check types and fields for PHI annotations
      for (const type of domain.types) {
        for (const field of type.fields) {
          if (mapping.type === 'annotation') {
            const patternStr = String(mapping.pattern);
            if (field.annotations?.some(a => a.includes(patternStr))) {
              evidence.push({
                type: 'isl_spec',
                source: `${type.name}.${field.name}`,
                content: `Field has ${patternStr} annotation`,
              });
            }
          }
        }
      }

      // Check behaviors
      for (const behavior of domain.behaviors) {
        if (mapping.type === 'behavior' && pattern.test(behavior.name)) {
          evidence.push({
            type: 'isl_spec',
            source: `behavior ${behavior.name}`,
            content: mapping.description,
          });
        }

        if (mapping.type === 'spec') {
          if (behavior.security?.authentication && pattern.test('authentication')) {
            evidence.push({
              type: 'isl_spec',
              source: `${behavior.name}.security.authentication`,
              content: behavior.security.authentication,
            });
          }
          if (behavior.observability && pattern.test('observability|log|audit')) {
            evidence.push({
              type: 'isl_spec',
              source: `${behavior.name}.observability`,
              content: 'Audit logging enabled',
            });
          }
          if (behavior.security?.encryption && pattern.test('encrypt')) {
            evidence.push({
              type: 'isl_spec',
              source: `${behavior.name}.security.encryption`,
              content: `Encryption: ${behavior.security.encryption.algorithm || 'enabled'}`,
            });
          }
          if (behavior.preconditions?.length && pattern.test('validate|verify')) {
            evidence.push({
              type: 'isl_spec',
              source: `${behavior.name}.preconditions`,
              content: `${behavior.preconditions.length} validation rules`,
            });
          }
        }
      }

      // Check actors
      if (domain.actors && mapping.type === 'spec' && pattern.test('actor|role|permission')) {
        for (const actor of domain.actors) {
          evidence.push({
            type: 'isl_spec',
            source: `actor ${actor.name}`,
            content: `Access control: ${actor.permissions.join(', ')}`,
          });
        }
      }

      // Check domain-level HIPAA compliance
      if (domain.compliance?.hipaa && mapping.type === 'spec') {
        for (const [key, value] of Object.entries(domain.compliance.hipaa)) {
          if (pattern.test(key)) {
            evidence.push({
              type: 'isl_spec',
              source: `compliance.hipaa.${key}`,
              content: String(value),
            });
          }
        }
      }
    }

    return evidence;
  }

  private determineStatus(evidence: ComplianceEvidence[], control: FrameworkControl): ControlStatus {
    if (evidence.length === 0) {
      return 'not_implemented';
    }

    const uniqueSources = new Set(evidence.map(e => e.source.split('.')[0]));
    
    if (uniqueSources.size >= 2 || evidence.length >= control.islMappings.length) {
      return 'implemented';
    }

    return 'partial';
  }

  private assessRisk(status: ControlStatus, control: FrameworkControl): RiskLevel {
    // Critical controls for PHI protection
    const criticalControls = ['164.312(a)(1)', '164.312(b)', '164.312(e)(1)', '164.308(a)(4)'];
    const highRiskControls = ['164.312(c)(1)', '164.312(d)', '164.308(a)(6)', '164.308(a)(7)'];

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

  /**
   * Check if domain handles PHI (Protected Health Information)
   */
  handlesPHI(domain: Domain): boolean {
    for (const type of domain.types) {
      for (const field of type.fields) {
        if (field.annotations?.some(a => 
          a.includes('[phi]') || 
          a.includes('[health]') || 
          a.includes('[medical]')
        )) {
          return true;
        }
      }
    }
    return false;
  }
}
