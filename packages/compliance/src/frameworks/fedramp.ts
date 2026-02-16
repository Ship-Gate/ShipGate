/**
 * FedRAMP (Federal Risk and Authorization Management Program) Compliance Framework Mapping
 *
 * Maps ISL constructs to FedRAMP security controls based on NIST SP 800-53 Rev 5.
 * Covers the most critical control families relevant to software verification.
 *
 * FedRAMP has 325+ controls for High impact. This mapping focuses on the
 * control families most relevant to ISL-verifiable software concerns:
 * AC (Access Control), AU (Audit), CA (Assessment), CM (Config Mgmt),
 * IA (Identification/Auth), IR (Incident Response), RA (Risk Assessment),
 * SA (System Acquisition), SC (System Communications), SI (System Integrity).
 */

import type { FrameworkControl, ISLMapping, ControlMapping, Domain, ControlStatus, ComplianceEvidence, RiskLevel } from '../types';

export const FEDRAMP_CONTROLS: FrameworkControl[] = [
  // AC: Access Control
  {
    id: 'AC-2',
    name: 'Account Management',
    description: 'Define and manage information system accounts including establishing, activating, modifying, reviewing, disabling, and removing accounts',
    category: 'Access Control',
    islMappings: [
      { type: 'behavior', pattern: /register|create.*user|signup|create.*account/i, description: 'Account creation behavior' },
      { type: 'behavior', pattern: /disable.*user|deactivate|remove.*user/i, description: 'Account removal behavior' },
      { type: 'spec', pattern: /actor|role|permission/i, description: 'Actor-based account model' },
    ],
  },
  {
    id: 'AC-3',
    name: 'Access Enforcement',
    description: 'Enforce approved authorizations for logical access to information and system resources',
    category: 'Access Control',
    islMappings: [
      { type: 'spec', pattern: /authorization|access.*control/i, description: 'Authorization enforcement' },
      { type: 'annotation', pattern: '[requires_auth]', description: 'Authentication annotation' },
      { type: 'spec', pattern: /actor.*permission|role.*check/i, description: 'Role-based access' },
    ],
  },
  {
    id: 'AC-4',
    name: 'Information Flow Enforcement',
    description: 'Enforce approved authorizations for controlling the flow of information within the system',
    category: 'Access Control',
    islMappings: [
      { type: 'spec', pattern: /data.*flow|information.*flow/i, description: 'Data flow control' },
      { type: 'annotation', pattern: '[sensitive]', description: 'Sensitive data marking' },
      { type: 'spec', pattern: /firewall|boundary|filter/i, description: 'Boundary enforcement' },
    ],
  },
  {
    id: 'AC-6',
    name: 'Least Privilege',
    description: 'Employ the principle of least privilege, allowing only authorized accesses necessary for tasks',
    category: 'Access Control',
    islMappings: [
      { type: 'spec', pattern: /permission|privilege|role/i, description: 'Permission model' },
      { type: 'spec', pattern: /actor.*specific|minimal.*access/i, description: 'Least privilege design' },
    ],
  },
  {
    id: 'AC-7',
    name: 'Unsuccessful Login Attempts',
    description: 'Enforce a limit of consecutive invalid logon attempts and take action when limit is exceeded',
    category: 'Access Control',
    islMappings: [
      { type: 'spec', pattern: /login.*attempt|lockout|brute.*force/i, description: 'Login attempt limits' },
      { type: 'spec', pattern: /rate.*limit/i, description: 'Rate limiting on auth' },
    ],
  },
  {
    id: 'AC-17',
    name: 'Remote Access',
    description: 'Establish and document usage restrictions and implementation guidance for remote access',
    category: 'Access Control',
    islMappings: [
      { type: 'spec', pattern: /remote.*access|vpn|ssh/i, description: 'Remote access controls' },
      { type: 'spec', pattern: /encrypt.*transit|tls|https/i, description: 'Encrypted remote access' },
    ],
  },

  // AU: Audit and Accountability
  {
    id: 'AU-2',
    name: 'Audit Events',
    description: 'Identify events that the system is capable of auditing in support of the audit function',
    category: 'Audit and Accountability',
    islMappings: [
      { type: 'spec', pattern: /audit|log.*event/i, description: 'Audit event definition' },
      { type: 'spec', pattern: /observability/i, description: 'Observability spec' },
    ],
  },
  {
    id: 'AU-3',
    name: 'Content of Audit Records',
    description: 'Ensure audit records contain what, when, where, source, outcome, and identity of involved individuals',
    category: 'Audit and Accountability',
    islMappings: [
      { type: 'spec', pattern: /log.*field|user_id.*timestamp|structured.*log/i, description: 'Structured audit fields' },
      { type: 'spec', pattern: /trace.*id|correlation.*id/i, description: 'Correlation tracking' },
    ],
  },
  {
    id: 'AU-6',
    name: 'Audit Review, Analysis, and Reporting',
    description: 'Review and analyze audit records for indications of inappropriate or unusual activity',
    category: 'Audit and Accountability',
    islMappings: [
      { type: 'spec', pattern: /monitoring|alert|anomaly/i, description: 'Audit analysis and alerting' },
      { type: 'spec', pattern: /metric|dashboard/i, description: 'Audit reporting' },
    ],
  },
  {
    id: 'AU-9',
    name: 'Protection of Audit Information',
    description: 'Protect audit information and audit logging tools from unauthorized access, modification, and deletion',
    category: 'Audit and Accountability',
    islMappings: [
      { type: 'spec', pattern: /log.*protect|log.*encrypt|audit.*integrity/i, description: 'Audit log protection' },
      { type: 'spec', pattern: /immutable|tamper.*proof/i, description: 'Tamper-proof logs' },
    ],
  },
  {
    id: 'AU-12',
    name: 'Audit Record Generation',
    description: 'Provide audit record generation capability and allow authorized personnel to select auditable events',
    category: 'Audit and Accountability',
    islMappings: [
      { type: 'spec', pattern: /log|observability/i, description: 'Log generation' },
      { type: 'spec', pattern: /trace|span/i, description: 'Trace generation' },
    ],
  },

  // CA: Assessment, Authorization, and Monitoring
  {
    id: 'CA-2',
    name: 'Control Assessments',
    description: 'Develop and conduct assessments of security and privacy controls',
    category: 'Assessment and Authorization',
    islMappings: [
      { type: 'spec', pattern: /verify|verification|test/i, description: 'Security verification' },
      { type: 'spec', pattern: /compliance|assessment/i, description: 'Compliance assessment' },
    ],
  },
  {
    id: 'CA-7',
    name: 'Continuous Monitoring',
    description: 'Develop a system-level continuous monitoring strategy and implement monitoring program',
    category: 'Assessment and Authorization',
    islMappings: [
      { type: 'spec', pattern: /monitoring|health.*check|observability/i, description: 'Continuous monitoring' },
      { type: 'spec', pattern: /metric|alert/i, description: 'Monitoring metrics and alerts' },
    ],
  },

  // CM: Configuration Management
  {
    id: 'CM-2',
    name: 'Baseline Configuration',
    description: 'Develop, document, and maintain a current baseline configuration of the system',
    category: 'Configuration Management',
    islMappings: [
      { type: 'spec', pattern: /configuration|config.*management/i, description: 'Configuration management' },
      { type: 'spec', pattern: /version|baseline/i, description: 'Version baseline' },
    ],
  },
  {
    id: 'CM-3',
    name: 'Configuration Change Control',
    description: 'Determine and document types of changes, review and approve change requests, and track changes',
    category: 'Configuration Management',
    islMappings: [
      { type: 'spec', pattern: /change.*management|change.*control/i, description: 'Change control process' },
      { type: 'spec', pattern: /approval|authorize.*change/i, description: 'Change authorization' },
      { type: 'behavior', pattern: /.*/, description: 'ISL spec-first change process' },
    ],
  },
  {
    id: 'CM-6',
    name: 'Configuration Settings',
    description: 'Establish and document configuration settings that reflect the most restrictive mode',
    category: 'Configuration Management',
    islMappings: [
      { type: 'spec', pattern: /security.*default|secure.*config/i, description: 'Secure defaults' },
      { type: 'annotation', pattern: '[secret]', description: 'Secret configuration marking' },
    ],
  },

  // IA: Identification and Authentication
  {
    id: 'IA-2',
    name: 'Identification and Authentication (Organizational Users)',
    description: 'Uniquely identify and authenticate organizational users',
    category: 'Identification and Authentication',
    islMappings: [
      { type: 'spec', pattern: /authentication|auth/i, description: 'User authentication' },
      { type: 'spec', pattern: /mfa|multi.?factor/i, description: 'Multi-factor authentication' },
      { type: 'spec', pattern: /actor.*auth/i, description: 'Actor authentication' },
    ],
  },
  {
    id: 'IA-5',
    name: 'Authenticator Management',
    description: 'Manage system authenticators (passwords, tokens, certificates)',
    category: 'Identification and Authentication',
    islMappings: [
      { type: 'spec', pattern: /password.*policy|credential|token.*management/i, description: 'Credential management' },
      { type: 'spec', pattern: /key.*rotation|secret.*management/i, description: 'Secret rotation' },
    ],
  },
  {
    id: 'IA-8',
    name: 'Identification and Authentication (Non-Organizational Users)',
    description: 'Uniquely identify and authenticate non-organizational users',
    category: 'Identification and Authentication',
    islMappings: [
      { type: 'spec', pattern: /api.*key|service.*auth|external.*auth/i, description: 'External authentication' },
      { type: 'spec', pattern: /oauth|jwt|token/i, description: 'Token-based auth' },
    ],
  },

  // IR: Incident Response
  {
    id: 'IR-4',
    name: 'Incident Handling',
    description: 'Implement an incident handling capability including preparation, detection, analysis, containment, eradication, and recovery',
    category: 'Incident Response',
    islMappings: [
      { type: 'spec', pattern: /incident.*response|incident.*handling/i, description: 'Incident handling' },
      { type: 'spec', pattern: /alert|escalation/i, description: 'Incident alerting' },
    ],
  },
  {
    id: 'IR-5',
    name: 'Incident Monitoring',
    description: 'Track and document system security and privacy incidents',
    category: 'Incident Response',
    islMappings: [
      { type: 'spec', pattern: /incident.*track|security.*event/i, description: 'Incident tracking' },
      { type: 'spec', pattern: /monitoring|anomaly.*detect/i, description: 'Incident monitoring' },
    ],
  },
  {
    id: 'IR-6',
    name: 'Incident Reporting',
    description: 'Require personnel to report suspected incidents to the organizational incident response capability',
    category: 'Incident Response',
    islMappings: [
      { type: 'spec', pattern: /incident.*report|notify|escalat/i, description: 'Incident reporting' },
      { type: 'behavior', pattern: /report.*incident|alert/i, description: 'Incident report behavior' },
    ],
  },

  // RA: Risk Assessment
  {
    id: 'RA-3',
    name: 'Risk Assessment',
    description: 'Conduct an assessment of risk, including the likelihood and magnitude of harm',
    category: 'Risk Assessment',
    islMappings: [
      { type: 'spec', pattern: /risk.*assessment|threat.*model/i, description: 'Risk assessment' },
      { type: 'spec', pattern: /chaos.*test|fault.*injection/i, description: 'Risk testing' },
    ],
  },
  {
    id: 'RA-5',
    name: 'Vulnerability Monitoring and Scanning',
    description: 'Monitor and scan for vulnerabilities in the system and hosted applications',
    category: 'Risk Assessment',
    islMappings: [
      { type: 'spec', pattern: /vulnerability|security.*scan/i, description: 'Vulnerability scanning' },
      { type: 'spec', pattern: /dependency.*audit|supply.*chain/i, description: 'Dependency scanning' },
    ],
  },

  // SA: System and Services Acquisition
  {
    id: 'SA-8',
    name: 'Security and Privacy Engineering Principles',
    description: 'Apply security and privacy engineering principles in the specification, design, development, implementation, and modification',
    category: 'System Acquisition',
    islMappings: [
      { type: 'spec', pattern: /security.*spec|privacy.*spec/i, description: 'Security engineering' },
      { type: 'spec', pattern: /precondition|postcondition|invariant/i, description: 'Formal verification' },
    ],
  },
  {
    id: 'SA-11',
    name: 'Developer Testing and Evaluation',
    description: 'Require the developer of the system to create a security assessment plan and implement it',
    category: 'System Acquisition',
    islMappings: [
      { type: 'spec', pattern: /test|verify|gate/i, description: 'Security testing' },
      { type: 'spec', pattern: /contract.*test|property.*test/i, description: 'Contract testing' },
    ],
  },

  // SC: System and Communications Protection
  {
    id: 'SC-7',
    name: 'Boundary Protection',
    description: 'Monitor and control communications at external managed interfaces',
    category: 'System and Communications',
    islMappings: [
      { type: 'spec', pattern: /firewall|boundary|gateway/i, description: 'Boundary protection' },
      { type: 'spec', pattern: /rate.*limit|throttle/i, description: 'Traffic control' },
    ],
  },
  {
    id: 'SC-8',
    name: 'Transmission Confidentiality and Integrity',
    description: 'Protect the confidentiality and integrity of transmitted information',
    category: 'System and Communications',
    islMappings: [
      { type: 'spec', pattern: /encrypt.*transit|tls|https/i, description: 'Transit encryption' },
      { type: 'spec', pattern: /integrity.*check|checksum/i, description: 'Integrity verification' },
    ],
  },
  {
    id: 'SC-12',
    name: 'Cryptographic Key Establishment and Management',
    description: 'Establish and manage cryptographic keys when cryptography is employed',
    category: 'System and Communications',
    islMappings: [
      { type: 'spec', pattern: /key.*management|key.*rotation/i, description: 'Key management' },
      { type: 'annotation', pattern: '[secret]', description: 'Secret key marking' },
    ],
  },
  {
    id: 'SC-13',
    name: 'Cryptographic Protection',
    description: 'Determine the required types of cryptography for each use and implement',
    category: 'System and Communications',
    islMappings: [
      { type: 'spec', pattern: /encrypt|cryptograph|hash/i, description: 'Cryptographic implementation' },
      { type: 'spec', pattern: /algorithm|cipher/i, description: 'Algorithm specification' },
    ],
  },
  {
    id: 'SC-28',
    name: 'Protection of Information at Rest',
    description: 'Protect the confidentiality and integrity of information at rest',
    category: 'System and Communications',
    islMappings: [
      { type: 'spec', pattern: /encrypt.*rest|storage.*encrypt/i, description: 'At-rest encryption' },
      { type: 'annotation', pattern: '[sensitive]', description: 'Sensitive data at rest' },
    ],
  },

  // SI: System and Information Integrity
  {
    id: 'SI-2',
    name: 'Flaw Remediation',
    description: 'Identify, report, and correct system flaws; test updates before deployment',
    category: 'System Integrity',
    islMappings: [
      { type: 'spec', pattern: /patch|update|remediat/i, description: 'Flaw remediation' },
      { type: 'spec', pattern: /dependency.*audit|vulnerability/i, description: 'Vulnerability patching' },
    ],
  },
  {
    id: 'SI-3',
    name: 'Malicious Code Protection',
    description: 'Implement malicious code protection mechanisms at system entry and exit points',
    category: 'System Integrity',
    islMappings: [
      { type: 'spec', pattern: /sanitize|validate|escape/i, description: 'Input sanitization' },
      { type: 'spec', pattern: /injection|xss|malicious/i, description: 'Injection prevention' },
    ],
  },
  {
    id: 'SI-4',
    name: 'System Monitoring',
    description: 'Monitor the system to detect attacks and indicators of potential attacks',
    category: 'System Integrity',
    islMappings: [
      { type: 'spec', pattern: /monitoring|intrusion.*detect/i, description: 'System monitoring' },
      { type: 'spec', pattern: /alert|anomaly/i, description: 'Attack detection' },
    ],
  },
  {
    id: 'SI-5',
    name: 'Security Alerts, Advisories, and Directives',
    description: 'Receive security alerts, advisories, and directives and take appropriate actions',
    category: 'System Integrity',
    islMappings: [
      { type: 'spec', pattern: /security.*alert|advisory/i, description: 'Security alerts' },
      { type: 'spec', pattern: /cve|vulnerability.*feed/i, description: 'Vulnerability advisories' },
    ],
  },
  {
    id: 'SI-10',
    name: 'Information Input Validation',
    description: 'Check the validity of information inputs',
    category: 'System Integrity',
    islMappings: [
      { type: 'spec', pattern: /validate|sanitize|precondition/i, description: 'Input validation' },
      { type: 'spec', pattern: /type.*check|schema/i, description: 'Schema validation' },
    ],
  },
  {
    id: 'SI-12',
    name: 'Information Management and Retention',
    description: 'Manage and retain information within the system in accordance with applicable laws',
    category: 'System Integrity',
    islMappings: [
      { type: 'spec', pattern: /retention|disposal|purge/i, description: 'Data retention policy' },
      { type: 'behavior', pattern: /delete|archive|purge/i, description: 'Data lifecycle behavior' },
    ],
  },
];

export class FedRAMPFramework {
  private controls: FrameworkControl[];

  constructor() {
    this.controls = FEDRAMP_CONTROLS;
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

      // Check types and fields for annotations
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
          if (behavior.security?.authentication && pattern.test('authentication|auth')) {
            evidence.push({
              type: 'isl_spec',
              source: `${behavior.name}.security.authentication`,
              content: behavior.security.authentication,
            });
          }
          if (behavior.security?.rateLimit && pattern.test('rate.*limit')) {
            evidence.push({
              type: 'isl_spec',
              source: `${behavior.name}.security.rateLimit`,
              content: `Rate limit: ${behavior.security.rateLimit.requests}/${behavior.security.rateLimit.window}`,
            });
          }
          if (behavior.security?.encryption && pattern.test('encrypt')) {
            evidence.push({
              type: 'isl_spec',
              source: `${behavior.name}.security.encryption`,
              content: `Encryption: ${behavior.security.encryption.algorithm || 'enabled'}`,
            });
          }
          if (behavior.observability && pattern.test('observability|log|audit|monitor|trace')) {
            evidence.push({
              type: 'isl_spec',
              source: `${behavior.name}.observability`,
              content: 'Observability spec defined',
            });
          }
          if (behavior.preconditions?.length && pattern.test('precondition|validate|sanitize|test|verify')) {
            evidence.push({
              type: 'isl_spec',
              source: `${behavior.name}.preconditions`,
              content: `${behavior.preconditions.length} preconditions defined`,
            });
          }
          if (behavior.postconditions?.length && pattern.test('postcondition|verify|test')) {
            evidence.push({
              type: 'isl_spec',
              source: `${behavior.name}.postconditions`,
              content: `${behavior.postconditions.length} postconditions defined`,
            });
          }
          if (behavior.security?.authorization && pattern.test('authorization|access.*control|role')) {
            evidence.push({
              type: 'isl_spec',
              source: `${behavior.name}.security.authorization`,
              content: `Authorization: ${behavior.security.authorization.join(', ')}`,
            });
          }
        }
      }

      // Check actors
      if (domain.actors && mapping.type === 'spec' && pattern.test('actor|role|permission|privilege')) {
        for (const actor of domain.actors) {
          evidence.push({
            type: 'isl_spec',
            source: `actor ${actor.name}`,
            content: `Actor with ${actor.permissions.length} permissions`,
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

    const uniqueSources = new Set(evidence.map(e => e.source.split('.')[0]));

    if (uniqueSources.size >= 2 || evidence.length >= control.islMappings.length) {
      return 'implemented';
    }

    return 'partial';
  }

  private assessRisk(status: ControlStatus, control: FrameworkControl): RiskLevel {
    // NIST baseline critical controls
    const criticalControls = ['AC-3', 'IA-2', 'AU-2', 'SC-8', 'SI-10', 'SC-13'];
    const highRiskControls = ['AC-2', 'AC-6', 'AU-3', 'AU-12', 'CM-3', 'IA-5', 'IR-4', 'SA-11', 'SC-7', 'SI-3'];

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
   * Determine FedRAMP impact level for a domain
   */
  classifyImpactLevel(domain: Domain): 'low' | 'moderate' | 'high' {
    const hasGovernmentData = domain.types.some(t =>
      t.fields.some(f => f.annotations?.some(a =>
        a.includes('[cui]') || a.includes('[fouo]') || a.includes('[classified]')
      ))
    );

    const hasPII = domain.types.some(t =>
      t.fields.some(f => f.annotations?.some(a =>
        a.includes('[pii]') || a.includes('[personal_data]')
      ))
    );

    const hasFinancialData = domain.types.some(t =>
      t.fields.some(f => f.annotations?.some(a =>
        a.includes('[payment]') || a.includes('[financial]')
      ))
    );

    if (hasGovernmentData) return 'high';
    if (hasPII || hasFinancialData) return 'moderate';
    return 'low';
  }
}
