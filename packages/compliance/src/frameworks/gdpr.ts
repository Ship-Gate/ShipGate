/**
 * GDPR (General Data Protection Regulation) Compliance Framework Mapping
 * 
 * Maps ISL constructs to GDPR articles for EU data protection compliance.
 */

import type { FrameworkControl, ISLMapping, ControlMapping, Domain, ControlStatus, ComplianceEvidence, RiskLevel } from '../types';

export const GDPR_ARTICLES: FrameworkControl[] = [
  // Chapter II: Principles
  {
    id: 'Art.5',
    name: 'Principles of Processing',
    description: 'Personal data shall be processed lawfully, fairly and transparently',
    category: 'Principles',
    islMappings: [
      { type: 'annotation', pattern: '[personal_data]', description: 'Personal data identification' },
      { type: 'spec', pattern: /purpose.*limitation|lawful.*basis/i, description: 'Purpose limitation' },
      { type: 'spec', pattern: /data.*minimization/i, description: 'Data minimization' },
    ],
  },
  {
    id: 'Art.6',
    name: 'Lawfulness of Processing',
    description: 'Processing shall be lawful based on consent or legitimate interests',
    category: 'Principles',
    islMappings: [
      { type: 'behavior', pattern: /consent|get.*consent/i, description: 'Consent collection' },
      { type: 'spec', pattern: /lawful.*basis|consent.*required/i, description: 'Lawful basis documentation' },
    ],
  },
  {
    id: 'Art.7',
    name: 'Conditions for Consent',
    description: 'Controller shall demonstrate that data subject has given consent',
    category: 'Principles',
    islMappings: [
      { type: 'behavior', pattern: /record.*consent|store.*consent/i, description: 'Consent recording' },
      { type: 'spec', pattern: /consent.*audit|consent.*log/i, description: 'Consent audit trail' },
    ],
  },
  
  // Chapter III: Rights of Data Subject
  {
    id: 'Art.12',
    name: 'Transparent Information',
    description: 'Provide information to the data subject in a concise, transparent, intelligible manner',
    category: 'Data Subject Rights',
    islMappings: [
      { type: 'behavior', pattern: /privacy.*notice|privacy.*policy/i, description: 'Privacy notices' },
      { type: 'spec', pattern: /transparency|disclosure/i, description: 'Transparency requirements' },
    ],
  },
  {
    id: 'Art.15',
    name: 'Right of Access',
    description: 'Data subject shall have the right to obtain confirmation and access to personal data',
    category: 'Data Subject Rights',
    islMappings: [
      { type: 'behavior', pattern: /get.*data|export.*data|access.*data/i, description: 'Data access behavior' },
      { type: 'spec', pattern: /data.*access|subject.*access/i, description: 'Access request handling' },
    ],
  },
  {
    id: 'Art.16',
    name: 'Right to Rectification',
    description: 'Data subject shall have the right to rectification of inaccurate personal data',
    category: 'Data Subject Rights',
    islMappings: [
      { type: 'behavior', pattern: /update.*data|correct.*data|rectify/i, description: 'Data rectification' },
      { type: 'spec', pattern: /data.*update|data.*correction/i, description: 'Rectification capability' },
    ],
  },
  {
    id: 'Art.17',
    name: 'Right to Erasure',
    description: 'Data subject shall have the right to erasure of personal data (right to be forgotten)',
    category: 'Data Subject Rights',
    islMappings: [
      { type: 'behavior', pattern: /delete.*user|delete.*data|erase|forget/i, description: 'Data deletion behavior' },
      { type: 'spec', pattern: /compliance.*gdpr.*delete|right.*erasure/i, description: 'Erasure compliance' },
      { type: 'spec', pattern: /data.*retention|retention.*policy/i, description: 'Retention policy' },
    ],
  },
  {
    id: 'Art.18',
    name: 'Right to Restriction',
    description: 'Data subject shall have the right to restriction of processing',
    category: 'Data Subject Rights',
    islMappings: [
      { type: 'behavior', pattern: /restrict.*processing|pause.*processing/i, description: 'Processing restriction' },
      { type: 'spec', pattern: /processing.*restriction/i, description: 'Restriction capability' },
    ],
  },
  {
    id: 'Art.20',
    name: 'Right to Data Portability',
    description: 'Data subject shall have the right to receive personal data in a portable format',
    category: 'Data Subject Rights',
    islMappings: [
      { type: 'behavior', pattern: /export.*data|download.*data|portability/i, description: 'Data export behavior' },
      { type: 'spec', pattern: /data.*format.*json|data.*format.*csv/i, description: 'Portable format' },
    ],
  },
  {
    id: 'Art.21',
    name: 'Right to Object',
    description: 'Data subject shall have the right to object to processing',
    category: 'Data Subject Rights',
    islMappings: [
      { type: 'behavior', pattern: /opt.*out|unsubscribe|object/i, description: 'Objection handling' },
      { type: 'spec', pattern: /marketing.*opt.*out|object.*processing/i, description: 'Objection mechanism' },
    ],
  },
  {
    id: 'Art.22',
    name: 'Automated Decision-Making',
    description: 'Right not to be subject to decisions based solely on automated processing',
    category: 'Data Subject Rights',
    islMappings: [
      { type: 'spec', pattern: /human.*review|manual.*override/i, description: 'Human intervention' },
      { type: 'behavior', pattern: /explain.*decision|decision.*explanation/i, description: 'Explainability' },
    ],
  },
  
  // Chapter IV: Controller and Processor
  {
    id: 'Art.25',
    name: 'Data Protection by Design',
    description: 'Implement appropriate technical and organizational measures (privacy by design)',
    category: 'Controller Obligations',
    islMappings: [
      { type: 'annotation', pattern: '[personal_data]', description: 'Data classification' },
      { type: 'annotation', pattern: '[sensitive]', description: 'Sensitive data marking' },
      { type: 'spec', pattern: /privacy.*default|data.*minimization/i, description: 'Privacy by default' },
    ],
  },
  {
    id: 'Art.30',
    name: 'Records of Processing',
    description: 'Maintain records of processing activities',
    category: 'Controller Obligations',
    islMappings: [
      { type: 'spec', pattern: /audit.*log|processing.*record/i, description: 'Processing records' },
      { type: 'spec', pattern: /observability/i, description: 'Activity logging' },
    ],
  },
  {
    id: 'Art.32',
    name: 'Security of Processing',
    description: 'Implement appropriate technical and organizational measures to ensure security',
    category: 'Security',
    islMappings: [
      { type: 'spec', pattern: /encrypt/i, description: 'Encryption' },
      { type: 'spec', pattern: /pseudonymization|anonymization/i, description: 'Pseudonymization' },
      { type: 'spec', pattern: /security.*spec/i, description: 'Security measures' },
      { type: 'spec', pattern: /access.*control|authentication/i, description: 'Access controls' },
    ],
  },
  {
    id: 'Art.33',
    name: 'Notification of Breach',
    description: 'Notify supervisory authority of personal data breach within 72 hours',
    category: 'Breach Notification',
    islMappings: [
      { type: 'spec', pattern: /breach.*notification|incident.*report/i, description: 'Breach notification' },
      { type: 'spec', pattern: /alert|notification/i, description: 'Alerting mechanism' },
    ],
  },
  {
    id: 'Art.34',
    name: 'Communication of Breach',
    description: 'Communicate personal data breach to data subject',
    category: 'Breach Notification',
    islMappings: [
      { type: 'behavior', pattern: /notify.*user|notify.*breach/i, description: 'User notification' },
      { type: 'spec', pattern: /breach.*communication/i, description: 'Breach communication' },
    ],
  },
  {
    id: 'Art.35',
    name: 'Data Protection Impact Assessment',
    description: 'Carry out assessment of impact of processing operations on data protection',
    category: 'Impact Assessment',
    islMappings: [
      { type: 'spec', pattern: /dpia|impact.*assessment/i, description: 'DPIA documentation' },
      { type: 'spec', pattern: /risk.*assessment/i, description: 'Risk assessment' },
    ],
  },
  
  // Chapter V: Transfers
  {
    id: 'Art.44',
    name: 'General Principles for Transfers',
    description: 'Transfers to third countries only with appropriate safeguards',
    category: 'International Transfers',
    islMappings: [
      { type: 'spec', pattern: /data.*transfer|cross.*border/i, description: 'Transfer documentation' },
      { type: 'spec', pattern: /adequacy|safeguard/i, description: 'Transfer safeguards' },
    ],
  },
];

export class GDPRFramework {
  private controls: FrameworkControl[];

  constructor() {
    this.controls = GDPR_ARTICLES;
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

      // Check types and fields for personal data annotations
      for (const type of domain.types) {
        for (const field of type.fields) {
          if (mapping.type === 'annotation') {
            const patternStr = String(mapping.pattern);
            if (field.annotations?.some(a => a.includes(patternStr))) {
              evidence.push({
                type: 'isl_spec',
                source: `${type.name}.${field.name}`,
                content: `Field marked as ${patternStr}`,
              });
            }
          }
        }
      }

      // Check behaviors for data subject rights
      for (const behavior of domain.behaviors) {
        if (mapping.type === 'behavior' && pattern.test(behavior.name)) {
          evidence.push({
            type: 'isl_spec',
            source: `behavior ${behavior.name}`,
            content: mapping.description,
          });
        }

        // Check behavior compliance specs
        if (behavior.compliance?.gdpr && mapping.type === 'spec') {
          for (const [key, value] of Object.entries(behavior.compliance.gdpr)) {
            if (pattern.test(key) || pattern.test(value)) {
              evidence.push({
                type: 'isl_spec',
                source: `${behavior.name}.compliance.gdpr.${key}`,
                content: value,
              });
            }
          }
        }

        // Check security specs
        if (mapping.type === 'spec' && behavior.security) {
          if (behavior.security.encryption && pattern.test('encrypt')) {
            evidence.push({
              type: 'isl_spec',
              source: `${behavior.name}.security.encryption`,
              content: `Encryption: ${behavior.security.encryption.algorithm || 'enabled'}`,
            });
          }
          if (behavior.security.authentication && pattern.test('authentication|access.*control')) {
            evidence.push({
              type: 'isl_spec',
              source: `${behavior.name}.security.authentication`,
              content: behavior.security.authentication,
            });
          }
        }

        // Check observability
        if (mapping.type === 'spec' && behavior.observability && pattern.test('observability|audit|log')) {
          evidence.push({
            type: 'isl_spec',
            source: `${behavior.name}.observability`,
            content: 'Activity logging enabled',
          });
        }
      }

      // Check domain-level GDPR compliance
      if (domain.compliance?.gdpr && mapping.type === 'spec') {
        for (const [key, value] of Object.entries(domain.compliance.gdpr)) {
          if (pattern.test(key)) {
            evidence.push({
              type: 'isl_spec',
              source: `compliance.gdpr.${key}`,
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
    // Data subject rights are high priority
    const criticalControls = ['Art.17', 'Art.32', 'Art.33', 'Art.5'];
    const highRiskControls = ['Art.15', 'Art.20', 'Art.25', 'Art.6'];

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
   * Check if domain handles personal data
   */
  handlesPersonalData(domain: Domain): boolean {
    for (const type of domain.types) {
      for (const field of type.fields) {
        if (field.annotations?.some(a => 
          a.includes('[personal_data]') || 
          a.includes('[pii]') ||
          a.includes('[email]') ||
          a.includes('[name]')
        )) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if domain has data subject rights behaviors
   */
  hasDataSubjectRights(domain: Domain): { 
    access: boolean; 
    rectification: boolean; 
    erasure: boolean; 
    portability: boolean;
  } {
    const behaviorNames = domain.behaviors.map(b => b.name.toLowerCase());
    
    return {
      access: behaviorNames.some(n => /get.*data|export.*data|access/i.test(n)),
      rectification: behaviorNames.some(n => /update.*data|correct|rectify/i.test(n)),
      erasure: behaviorNames.some(n => /delete.*user|delete.*data|erase|forget/i.test(n)),
      portability: behaviorNames.some(n => /export|download|portability/i.test(n)),
    };
  }
}
