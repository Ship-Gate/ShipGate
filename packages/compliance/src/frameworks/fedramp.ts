/**
 * FedRAMP (Federal Risk and Authorization Management Program) Compliance Framework Mapping
 * 
 * Maps ISL constructs to FedRAMP security controls for federal cloud compliance.
 */

import type { FrameworkControl, ISLMapping, ControlMapping, Domain, ControlStatus, ComplianceEvidence, RiskLevel } from '../types';

export const FEDRAMP_CONTROLS: FrameworkControl[] = [
  // AC: Access Control
  {
    id: 'AC-1',
    name: 'Access Control Policy and Procedures',
    description: 'Develop, document, and disseminate an access control policy',
    category: 'Access Control',
    islMappings: [
      { type: 'spec', pattern: /access.*policy|authorization.*policy/i, description: 'Access control policy' },
      { type: 'behavior', pattern: /define.*policy|document.*policy/i, description: 'Policy documentation' },
    ],
  },
  {
    id: 'AC-2',
    name: 'Account Management',
    description: 'Identify, authenticate, and authorize users',
    category: 'Access Control',
    islMappings: [
      { type: 'behavior', pattern: /login|authenticate|create.*user/i, description: 'User authentication' },
      { type: 'entity', pattern: /user|account|credential/i, description: 'User entities' },
      { type: 'spec', pattern: /account.*management|user.*lifecycle/i, description: 'Account management' },
    ],
  },
  {
    id: 'AC-3',
    name: 'Access Enforcement',
    description: 'Enforce approved authorizations for logical access to information',
    category: 'Access Control',
    islMappings: [
      { type: 'behavior', pattern: /authorize|permit|grant/i, description: 'Authorization enforcement' },
      { type: 'spec', pattern: /role.*based|permission/i, description: 'Role-based access' },
      { type: 'annotation', pattern: '[requires_auth]', description: 'Authentication requirement' },
    ],
  },
  // AU: Audit and Accountability
  {
    id: 'AU-2',
    name: 'Audit Events',
    description: 'Audit events include user actions, system actions, and policy violations',
    category: 'Audit',
    islMappings: [
      { type: 'behavior', pattern: /log|audit|record/i, description: 'Audit logging' },
      { type: 'spec', pattern: /audit.*trail|log.*level/i, description: 'Audit specifications' },
      { type: 'annotation', pattern: '[audited]', description: 'Audited operation' },
    ],
  },
  {
    id: 'AU-3',
    name: 'Content of Audit Records',
    description: 'Audit records contain information to establish what type of event occurred',
    category: 'Audit',
    islMappings: [
      { type: 'entity', pattern: /audit.*log|event.*log/i, description: 'Audit log entities' },
      { type: 'spec', pattern: /log.*format|audit.*field/i, description: 'Audit record format' },
    ],
  },
  // SC: System and Communications Protection
  {
    id: 'SC-7',
    name: 'Boundary Protection',
    description: 'Monitor and control communications at external boundaries',
    category: 'System Protection',
    islMappings: [
      { type: 'spec', pattern: /firewall|boundary|edge/i, description: 'Boundary controls' },
      { type: 'behavior', pattern: /filter|block|allow/i, description: 'Traffic filtering' },
      { type: 'annotation', pattern: '[boundary]', description: 'Boundary annotation' },
    ],
  },
  {
    id: 'SC-8',
    name: 'Transmission Confidentiality and Integrity',
    description: 'Protect information in transmission',
    category: 'System Protection',
    islMappings: [
      { type: 'spec', pattern: /encrypt.*transit|tls|https/i, description: 'Transit encryption' },
      { type: 'behavior', pattern: /encrypt|decrypt|sign/i, description: 'Cryptographic operations' },
      { type: 'annotation', pattern: '[encrypted]', description: 'Encrypted transmission' },
    ],
  },
  // IA: Identification and Authentication
  {
    id: 'IA-1',
    name: 'Identification and Authentication Policy and Procedures',
    description: 'Develop, document, and disseminate identification and authentication policies',
    category: 'Identification & Authentication',
    islMappings: [
      { type: 'spec', pattern: /auth.*policy|identity.*policy/i, description: 'Authentication policy' },
      { type: 'behavior', pattern: /define.*auth|document.*auth/i, description: 'Auth documentation' },
    ],
  },
  {
    id: 'IA-2',
    name: 'Identification and Authentication (Organizational Users)',
    description: 'Identify and authenticate organizational users',
    category: 'Identification & Authentication',
    islMappings: [
      { type: 'behavior', pattern: /login|authenticate|verify.*identity/i, description: 'User authentication' },
      { type: 'entity', pattern: /user|identity|credential/i, description: 'User identity entities' },
      { type: 'spec', pattern: /multi.*factor|mfa|2fa/i, description: 'Multi-factor authentication' },
    ],
  },
  // CM: Configuration Management
  {
    id: 'CM-2',
    name: 'Baseline Configuration',
    description: 'Develop, document, and maintain baseline configurations',
    category: 'Configuration Management',
    islMappings: [
      { type: 'spec', pattern: /baseline|config.*template/i, description: 'Baseline configuration' },
      { type: 'entity', pattern: /config|setting|parameter/i, description: 'Configuration entities' },
      { type: 'behavior', pattern: /baseline|standardize/i, description: 'Configuration standardization' },
    ],
  },
];

export class FedRAMPFramework {
  private controls: FrameworkControl[];

  constructor() {
    this.controls = FEDRAMP_CONTROLS;
  }

  mapDomain(domain: Domain): ControlMapping[] {
    const mappings: ControlMapping[] = [];

    for (const control of this.controls) {
      const evidence = this.collectEvidence(domain, control);
      const status = this.determineStatus(evidence, control);
      const risk = this.assessRisk(evidence, control);

      mappings.push({
        controlId: control.id,
        controlName: control.name,
        category: control.category,
        description: control.description,
        status,
        risk,
        evidence,
        islMappings: control.islMappings,
      });
    }

    return mappings;
  }

  private collectEvidence(domain: Domain, control: FrameworkControl): ComplianceEvidence[] {
    const evidence: ComplianceEvidence[] = [];

    // Check entities
    for (const entity of domain.types || []) {
      for (const mapping of control.islMappings) {
        if (mapping.type === 'entity' && mapping.pattern instanceof RegExp && mapping.pattern.test(entity.name)) {
          evidence.push({
            type: 'entity',
            source: entity.name,
            content: entity.name,
            description: mapping.description,
            confidence: 0.8,
          });
        }
      }
    }

    // Check behaviors
    for (const behavior of domain.behaviors || []) {
      for (const mapping of control.islMappings) {
        if (mapping.type === 'behavior' && mapping.pattern instanceof RegExp && mapping.pattern.test(behavior.name)) {
          evidence.push({
            type: 'behavior',
            source: behavior.name,
            content: behavior.name,
            description: mapping.description,
            confidence: 0.9,
          });
        }
      }
    }

    // Check annotations
    const allAnnotations = [
      ...(domain.types || []).flatMap(t => t.annotations || []),
      ...(domain.behaviors || []).flatMap(b => b.annotations || []),
    ];

    for (const annotation of allAnnotations) {
      for (const mapping of control.islMappings) {
        if (mapping.type === 'annotation' && mapping.pattern instanceof RegExp && mapping.pattern.test(annotation)) {
          evidence.push({
            type: 'annotation',
            source: annotation,
            content: annotation,
            description: mapping.description,
            confidence: 0.7,
          });
        }
      }
    }

    return evidence;
  }

  private determineStatus(evidence: ComplianceEvidence[], control: FrameworkControl): ControlStatus {
    if (evidence.length === 0) {
      return 'not_implemented';
    }
    
    const highConfidenceEvidence = evidence.filter(e => (e.confidence || 0) >= 0.8);
    if (highConfidenceEvidence.length > 0) {
      return 'implemented';
    }
    
    return 'partial';
  }

  private assessRisk(evidence: ComplianceEvidence[], control: FrameworkControl): RiskLevel {
    if (evidence.length === 0) {
      return 'high';
    }
    
    const avgConfidence = evidence.reduce((sum, e) => sum + (e.confidence || 0), 0) / evidence.length;
    if (avgConfidence >= 0.8) {
      return 'low';
    } else if (avgConfidence >= 0.6) {
      return 'medium';
    } else {
      return 'high';
    }
  }
}
