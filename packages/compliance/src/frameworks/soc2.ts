/**
 * SOC2 Trust Services Criteria Compliance Framework Mapping
 * 
 * Maps ISL constructs to SOC2 Trust Services Criteria for
 * service organization control compliance.
 */

import type { FrameworkControl, ISLMapping, ControlMapping, Domain, ControlStatus, ComplianceEvidence, RiskLevel } from '../types';

export const SOC2_CONTROLS: FrameworkControl[] = [
  // CC6: Logical and Physical Access Controls
  {
    id: 'CC6.1',
    name: 'Logical Access Security',
    description: 'The entity implements logical access security software, infrastructure, and architectures',
    category: 'Logical and Physical Access',
    islMappings: [
      { type: 'spec', pattern: /actor|permission|role/i, description: 'Actor-based access control' },
      { type: 'spec', pattern: /authentication|auth/i, description: 'Authentication requirements' },
      { type: 'annotation', pattern: '[requires_auth]', description: 'Authentication annotation' },
    ],
  },
  {
    id: 'CC6.2',
    name: 'User Registration',
    description: 'Prior to issuing credentials, the entity registers and authorizes users',
    category: 'Logical and Physical Access',
    islMappings: [
      { type: 'behavior', pattern: /register|create.*user|signup/i, description: 'User registration behavior' },
      { type: 'spec', pattern: /actor.*create/i, description: 'User creation process' },
    ],
  },
  {
    id: 'CC6.3',
    name: 'Credential Management',
    description: 'The entity authorizes, modifies, or removes access to data and assets',
    category: 'Logical and Physical Access',
    islMappings: [
      { type: 'behavior', pattern: /update.*permission|revoke|grant/i, description: 'Permission management' },
      { type: 'spec', pattern: /authorization/i, description: 'Authorization rules' },
    ],
  },
  {
    id: 'CC6.6',
    name: 'External Boundaries',
    description: 'The entity implements controls to prevent or detect unauthorized access',
    category: 'Logical and Physical Access',
    islMappings: [
      { type: 'spec', pattern: /rate.*limit/i, description: 'Rate limiting' },
      { type: 'spec', pattern: /security.*spec/i, description: 'Security specifications' },
      { type: 'spec', pattern: /firewall|boundary/i, description: 'Boundary controls' },
    ],
  },
  {
    id: 'CC6.7',
    name: 'Transmission Protection',
    description: 'The entity restricts the transmission of information to authorized channels',
    category: 'Logical and Physical Access',
    islMappings: [
      { type: 'spec', pattern: /encrypt.*transit|tls|https/i, description: 'Transit encryption' },
      { type: 'annotation', pattern: '[sensitive]', description: 'Sensitive data marking' },
    ],
  },
  {
    id: 'CC6.8',
    name: 'Unauthorized Software Prevention',
    description: 'The entity implements controls to prevent unauthorized software installation',
    category: 'Logical and Physical Access',
    islMappings: [
      { type: 'spec', pattern: /dependency|package.*verify/i, description: 'Dependency verification' },
    ],
  },
  
  // CC7: System Operations
  {
    id: 'CC7.1',
    name: 'Detection of Changes',
    description: 'The entity detects changes to infrastructure and software',
    category: 'System Operations',
    islMappings: [
      { type: 'spec', pattern: /version|changelog/i, description: 'Version tracking' },
      { type: 'spec', pattern: /audit|log.*change/i, description: 'Change logging' },
    ],
  },
  {
    id: 'CC7.2',
    name: 'System Monitoring',
    description: 'The entity monitors system components to detect anomalies',
    category: 'System Operations',
    islMappings: [
      { type: 'spec', pattern: /observability/i, description: 'Observability spec' },
      { type: 'spec', pattern: /metric|monitoring/i, description: 'Metrics and monitoring' },
      { type: 'spec', pattern: /alert/i, description: 'Alerting configuration' },
    ],
  },
  {
    id: 'CC7.3',
    name: 'Security Event Analysis',
    description: 'The entity evaluates security events to determine their impact',
    category: 'System Operations',
    islMappings: [
      { type: 'spec', pattern: /log.*analysis|siem/i, description: 'Log analysis' },
      { type: 'spec', pattern: /incident|security.*event/i, description: 'Incident handling' },
    ],
  },
  {
    id: 'CC7.4',
    name: 'Incident Response',
    description: 'The entity responds to identified security incidents',
    category: 'System Operations',
    islMappings: [
      { type: 'spec', pattern: /incident.*response/i, description: 'Incident response spec' },
      { type: 'spec', pattern: /alert.*action/i, description: 'Alert actions' },
    ],
  },
  {
    id: 'CC7.5',
    name: 'Recovery Procedures',
    description: 'The entity identifies, develops, and implements recovery activities',
    category: 'System Operations',
    islMappings: [
      { type: 'spec', pattern: /recovery|backup|restore/i, description: 'Recovery procedures' },
      { type: 'spec', pattern: /disaster|failover/i, description: 'Disaster recovery' },
    ],
  },
  
  // CC8: Change Management
  {
    id: 'CC8.1',
    name: 'Change Authorization',
    description: 'The entity authorizes, designs, and develops changes to infrastructure and software',
    category: 'Change Management',
    islMappings: [
      { type: 'spec', pattern: /approval|authorize.*change/i, description: 'Change authorization' },
      { type: 'behavior', pattern: /.*/, description: 'ISL-first development process' },
    ],
  },
  
  // CC9: Risk Mitigation
  {
    id: 'CC9.1',
    name: 'Risk Identification',
    description: 'The entity identifies and assesses risks to objectives',
    category: 'Risk Mitigation',
    islMappings: [
      { type: 'spec', pattern: /risk|threat/i, description: 'Risk specifications' },
      { type: 'spec', pattern: /chaos.*test/i, description: 'Chaos testing for risk' },
    ],
  },
  {
    id: 'CC9.2',
    name: 'Vendor Risk Management',
    description: 'The entity assesses and manages risks associated with vendors',
    category: 'Risk Mitigation',
    islMappings: [
      { type: 'spec', pattern: /vendor|third.*party/i, description: 'Vendor management' },
      { type: 'spec', pattern: /dependency.*audit/i, description: 'Dependency auditing' },
    ],
  },
  
  // A1: Availability
  {
    id: 'A1.1',
    name: 'Capacity Planning',
    description: 'The entity maintains processing capacity to meet availability commitments',
    category: 'Availability',
    islMappings: [
      { type: 'spec', pattern: /capacity|scale|limit/i, description: 'Capacity specifications' },
      { type: 'spec', pattern: /temporal.*availability/i, description: 'Availability SLA' },
    ],
  },
  {
    id: 'A1.2',
    name: 'Environmental Protections',
    description: 'The entity implements environmental protections',
    category: 'Availability',
    islMappings: [
      { type: 'spec', pattern: /redundancy|failover/i, description: 'Redundancy specs' },
    ],
  },
  
  // C1: Confidentiality
  {
    id: 'C1.1',
    name: 'Confidential Information Identification',
    description: 'The entity identifies and maintains confidential information',
    category: 'Confidentiality',
    islMappings: [
      { type: 'annotation', pattern: '[sensitive]', description: 'Sensitive annotation' },
      { type: 'annotation', pattern: '[secret]', description: 'Secret annotation' },
      { type: 'annotation', pattern: '[confidential]', description: 'Confidential annotation' },
    ],
  },
  {
    id: 'C1.2',
    name: 'Confidential Information Disposal',
    description: 'The entity disposes of confidential information to meet objectives',
    category: 'Confidentiality',
    islMappings: [
      { type: 'behavior', pattern: /delete|dispose|purge/i, description: 'Data disposal behavior' },
      { type: 'spec', pattern: /retention|disposal/i, description: 'Retention policy' },
    ],
  },
  
  // PI1: Processing Integrity
  {
    id: 'PI1.1',
    name: 'Input Validation',
    description: 'The entity validates inputs before processing',
    category: 'Processing Integrity',
    islMappings: [
      { type: 'spec', pattern: /precondition/i, description: 'Input preconditions' },
      { type: 'spec', pattern: /validate|sanitize/i, description: 'Input validation' },
    ],
  },
  {
    id: 'PI1.2',
    name: 'Processing Validation',
    description: 'The entity implements processing validation',
    category: 'Processing Integrity',
    islMappings: [
      { type: 'spec', pattern: /postcondition/i, description: 'Output postconditions' },
      { type: 'spec', pattern: /invariant/i, description: 'Invariants' },
    ],
  },
  {
    id: 'PI1.3',
    name: 'Output Validation',
    description: 'The entity validates outputs to meet processing integrity requirements',
    category: 'Processing Integrity',
    islMappings: [
      { type: 'spec', pattern: /verify|verification/i, description: 'Output verification' },
      { type: 'spec', pattern: /postcondition/i, description: 'Postcondition checks' },
    ],
  },
];

export class SOC2Framework {
  private controls: FrameworkControl[];

  constructor() {
    this.controls = SOC2_CONTROLS;
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

      // Check types and fields
      for (const type of domain.types) {
        for (const field of type.fields) {
          if (mapping.type === 'annotation' && field.annotations?.some(a => a.includes(String(mapping.pattern)))) {
            evidence.push({
              type: 'isl_spec',
              source: `${type.name}.${field.name}`,
              content: `Field has annotation ${mapping.pattern}`,
            });
          }
        }
      }

      // Check behaviors
      for (const behavior of domain.behaviors) {
        if (mapping.type === 'behavior' && pattern.test(behavior.name)) {
          evidence.push({
            type: 'isl_spec',
            source: `behavior ${String(behavior.name)}`,
            content: mapping.description,
          });
        }

        if (mapping.type === 'spec') {
          if (behavior.preconditions && pattern.test('precondition')) {
            evidence.push({
              type: 'isl_spec',
              source: `${String(behavior.name)}.preconditions`,
              content: `${behavior.preconditions.length} preconditions defined`,
            });
          }
          if (behavior.postconditions && pattern.test('postcondition')) {
            evidence.push({
              type: 'isl_spec',
              source: `${String(behavior.name)}.postconditions`,
              content: `${behavior.postconditions.length} postconditions defined`,
            });
          }
          if (behavior.observability && pattern.test('observability')) {
            evidence.push({
              type: 'isl_spec',
              source: `${String(behavior.name)}.observability`,
              content: 'Observability spec defined',
            });
          }
          if (behavior.security?.rateLimit && pattern.test('rate')) {
            evidence.push({
              type: 'isl_spec',
              source: `${String(behavior.name)}.security.rateLimit`,
              content: `Rate limit: ${behavior.security.rateLimit.requests}/${behavior.security.rateLimit.window}`,
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
            content: `Actor with ${actor.permissions.length} permissions`,
          });
        }
      }

      // Check domain compliance
      if (domain.compliance?.soc2 && mapping.type === 'spec') {
        for (const [key, value] of Object.entries(domain.compliance.soc2)) {
          if (pattern.test(key)) {
            evidence.push({
              type: 'isl_spec',
              source: `compliance.soc2.${key}`,
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

    const uniqueTypes = new Set(evidence.map(e => e.source.split('.')[0]));
    
    if (uniqueTypes.size >= 2 || evidence.length >= control.islMappings.length) {
      return 'implemented';
    }

    return 'partial';
  }

  private assessRisk(status: ControlStatus, control: FrameworkControl): RiskLevel {
    const criticalControls = ['CC6.1', 'CC6.6', 'CC7.2', 'C1.1'];
    const highRiskControls = ['CC6.7', 'CC7.1', 'PI1.1', 'PI1.2'];

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
