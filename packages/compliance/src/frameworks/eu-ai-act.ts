/**
 * EU AI Act Compliance Framework Mapping
 *
 * Maps ISL constructs to EU AI Act requirements for artificial intelligence
 * system compliance. Based on Regulation (EU) 2024/1689.
 *
 * Focuses on high-risk AI system obligations (Title III, Chapter 2-3)
 * which are the most relevant to software verification.
 */

import type { FrameworkControl, ISLMapping, ControlMapping, Domain, ControlStatus, ComplianceEvidence, RiskLevel } from '../types';

export const EU_AI_ACT_ARTICLES: FrameworkControl[] = [
  // Title III, Chapter 2: Requirements for High-Risk AI Systems

  // Article 9: Risk Management System
  {
    id: 'Art.9(1)',
    name: 'Risk Management System',
    description: 'A risk management system shall be established, implemented, documented and maintained',
    category: 'Risk Management',
    islMappings: [
      { type: 'spec', pattern: /risk.*assessment|risk.*analysis|risk.*management/i, description: 'Risk assessment process' },
      { type: 'spec', pattern: /chaos.*test|fault.*injection/i, description: 'Risk testing methodology' },
      { type: 'spec', pattern: /threat.*model/i, description: 'Threat modeling' },
    ],
  },
  {
    id: 'Art.9(2)',
    name: 'Risk Identification and Analysis',
    description: 'Identify and analyse known and reasonably foreseeable risks',
    category: 'Risk Management',
    islMappings: [
      { type: 'spec', pattern: /precondition|invariant/i, description: 'Formal risk constraints' },
      { type: 'spec', pattern: /edge.*case|boundary/i, description: 'Edge case analysis' },
    ],
  },
  {
    id: 'Art.9(4)',
    name: 'Risk Mitigation',
    description: 'Adopt suitable risk management measures to address identified risks',
    category: 'Risk Management',
    islMappings: [
      { type: 'spec', pattern: /postcondition|guard|safeguard/i, description: 'Safety guards' },
      { type: 'spec', pattern: /fallback|recovery|graceful/i, description: 'Fallback mechanisms' },
      { type: 'spec', pattern: /rate.*limit|throttle/i, description: 'Usage limits' },
    ],
  },

  // Article 10: Data and Data Governance
  {
    id: 'Art.10(1)',
    name: 'Data Governance',
    description: 'Training, validation and testing data shall be subject to data governance practices',
    category: 'Data Governance',
    islMappings: [
      { type: 'spec', pattern: /data.*quality|data.*governance|data.*validation/i, description: 'Data governance practices' },
      { type: 'annotation', pattern: '[training_data]', description: 'Training data annotation' },
    ],
  },
  {
    id: 'Art.10(2)',
    name: 'Data Quality Criteria',
    description: 'Training, validation and testing data sets shall meet quality criteria',
    category: 'Data Governance',
    islMappings: [
      { type: 'spec', pattern: /validate|sanitize|clean/i, description: 'Data validation' },
      { type: 'spec', pattern: /bias.*detect|fairness/i, description: 'Bias detection' },
      { type: 'annotation', pattern: '[validated]', description: 'Validation annotation' },
    ],
  },
  {
    id: 'Art.10(5)',
    name: 'Data Representativeness',
    description: 'Training, validation and testing data sets shall be relevant, sufficiently representative',
    category: 'Data Governance',
    islMappings: [
      { type: 'spec', pattern: /representative|coverage|sample/i, description: 'Data representativeness' },
      { type: 'spec', pattern: /test.*coverage|scenario/i, description: 'Testing coverage' },
    ],
  },

  // Article 11: Technical Documentation
  {
    id: 'Art.11(1)',
    name: 'Technical Documentation',
    description: 'Technical documentation shall be drawn up before placing on the market and kept up to date',
    category: 'Technical Documentation',
    islMappings: [
      { type: 'spec', pattern: /specification|document/i, description: 'ISL specifications as documentation' },
      { type: 'behavior', pattern: /.*/, description: 'Behavior specifications serve as documentation' },
    ],
  },

  // Article 12: Record-Keeping
  {
    id: 'Art.12(1)',
    name: 'Automatic Logging',
    description: 'High-risk AI systems shall allow for automatic recording of events (logs)',
    category: 'Record-Keeping',
    islMappings: [
      { type: 'spec', pattern: /observability|log|audit/i, description: 'Logging specification' },
      { type: 'spec', pattern: /trace|tracing/i, description: 'Distributed tracing' },
      { type: 'spec', pattern: /event.*log|event.*record/i, description: 'Event recording' },
    ],
  },
  {
    id: 'Art.12(2)',
    name: 'Traceability',
    description: 'Logging capabilities shall ensure traceability of the AI system functioning',
    category: 'Record-Keeping',
    islMappings: [
      { type: 'spec', pattern: /trace.*id|correlation.*id|request.*id/i, description: 'Request traceability' },
      { type: 'spec', pattern: /provenance|lineage/i, description: 'Data lineage tracking' },
    ],
  },

  // Article 13: Transparency and Provision of Information
  {
    id: 'Art.13(1)',
    name: 'Transparency',
    description: 'High-risk AI systems shall be designed to ensure transparent operation',
    category: 'Transparency',
    islMappings: [
      { type: 'spec', pattern: /explain|explainability|interpretable/i, description: 'Explainability specification' },
      { type: 'behavior', pattern: /explain.*decision|decision.*explanation/i, description: 'Decision explanation behavior' },
    ],
  },
  {
    id: 'Art.13(2)',
    name: 'Instructions for Use',
    description: 'Accompanied by instructions for use including intended purpose and limitations',
    category: 'Transparency',
    islMappings: [
      { type: 'spec', pattern: /purpose|scope|limitation|constraint/i, description: 'System purpose and limitations' },
      { type: 'spec', pattern: /intended.*use|use.*case/i, description: 'Intended use documentation' },
    ],
  },
  {
    id: 'Art.13(3)(b)(ii)',
    name: 'Performance Metrics Disclosure',
    description: 'Disclose level of accuracy and relevant metrics',
    category: 'Transparency',
    islMappings: [
      { type: 'spec', pattern: /accuracy|precision|recall|metric/i, description: 'Performance metrics' },
      { type: 'spec', pattern: /confidence|threshold/i, description: 'Confidence thresholds' },
    ],
  },

  // Article 14: Human Oversight
  {
    id: 'Art.14(1)',
    name: 'Human Oversight Design',
    description: 'AI systems shall be designed to allow effective human oversight during use',
    category: 'Human Oversight',
    islMappings: [
      { type: 'spec', pattern: /human.*review|manual.*override|human.*in.*loop/i, description: 'Human oversight mechanism' },
      { type: 'behavior', pattern: /approve|review|override/i, description: 'Approval/review behavior' },
    ],
  },
  {
    id: 'Art.14(3)(a)',
    name: 'Understanding AI Capabilities',
    description: 'Natural persons shall understand capabilities and limitations of the AI system',
    category: 'Human Oversight',
    islMappings: [
      { type: 'spec', pattern: /capability|limitation|boundary/i, description: 'Capability boundaries' },
      { type: 'spec', pattern: /alert.*operator|notify.*human/i, description: 'Operator notifications' },
    ],
  },
  {
    id: 'Art.14(4)',
    name: 'Override and Intervention',
    description: 'Ability to override or reverse outputs of the AI system',
    category: 'Human Oversight',
    islMappings: [
      { type: 'behavior', pattern: /override|rollback|revert|undo/i, description: 'Override capability' },
      { type: 'spec', pattern: /stop|halt|disable|kill.*switch/i, description: 'Emergency stop mechanism' },
    ],
  },

  // Article 15: Accuracy, Robustness and Cybersecurity
  {
    id: 'Art.15(1)',
    name: 'Accuracy',
    description: 'AI systems shall achieve an appropriate level of accuracy',
    category: 'Accuracy & Robustness',
    islMappings: [
      { type: 'spec', pattern: /accuracy|precision|quality/i, description: 'Accuracy requirements' },
      { type: 'spec', pattern: /postcondition|verify/i, description: 'Output verification' },
      { type: 'spec', pattern: /test|validation/i, description: 'Testing specifications' },
    ],
  },
  {
    id: 'Art.15(3)',
    name: 'Robustness',
    description: 'AI systems shall be resilient against attempts to alter their use or performance',
    category: 'Accuracy & Robustness',
    islMappings: [
      { type: 'spec', pattern: /chaos|resilience|fault.*tolerance/i, description: 'Resilience testing' },
      { type: 'spec', pattern: /adversarial|attack.*resist/i, description: 'Adversarial robustness' },
      { type: 'spec', pattern: /invariant/i, description: 'System invariants' },
    ],
  },
  {
    id: 'Art.15(4)',
    name: 'Cybersecurity',
    description: 'AI systems shall be resilient against unauthorized third-party access',
    category: 'Accuracy & Robustness',
    islMappings: [
      { type: 'spec', pattern: /authentication|auth/i, description: 'Authentication requirement' },
      { type: 'spec', pattern: /encrypt|security/i, description: 'Security measures' },
      { type: 'spec', pattern: /rate.*limit|firewall/i, description: 'Access protection' },
    ],
  },

  // Article 17: Quality Management System
  {
    id: 'Art.17(1)',
    name: 'Quality Management System',
    description: 'Providers shall put a quality management system in place',
    category: 'Quality Management',
    islMappings: [
      { type: 'spec', pattern: /compliance|quality|standard/i, description: 'Quality standards' },
      { type: 'spec', pattern: /version|changelog/i, description: 'Version control' },
    ],
  },
  {
    id: 'Art.17(1)(e)',
    name: 'Verification & Validation Procedures',
    description: 'Procedures for verification and validation testing before and after deployment',
    category: 'Quality Management',
    islMappings: [
      { type: 'spec', pattern: /verify|verification|gate/i, description: 'Verification procedures' },
      { type: 'spec', pattern: /precondition|postcondition|contract/i, description: 'Contract testing' },
    ],
  },
  {
    id: 'Art.17(1)(g)',
    name: 'Incident Reporting',
    description: 'Systems and procedures for reporting serious incidents',
    category: 'Quality Management',
    islMappings: [
      { type: 'spec', pattern: /incident|alert|escalation/i, description: 'Incident management' },
      { type: 'spec', pattern: /monitoring|health.*check/i, description: 'System monitoring' },
    ],
  },

  // Title IV: Transparency Obligations for Certain AI Systems
  {
    id: 'Art.50(1)',
    name: 'AI Interaction Disclosure',
    description: 'Ensure that persons are informed they are interacting with an AI system',
    category: 'Transparency Obligations',
    islMappings: [
      { type: 'spec', pattern: /disclosure|ai.*disclosure|bot.*disclosure/i, description: 'AI disclosure' },
      { type: 'behavior', pattern: /disclose|inform.*ai/i, description: 'Disclosure behavior' },
    ],
  },
  {
    id: 'Art.50(2)',
    name: 'AI-Generated Content Marking',
    description: 'AI-generated content shall be marked as artificially generated or manipulated',
    category: 'Transparency Obligations',
    islMappings: [
      { type: 'annotation', pattern: '[ai_generated]', description: 'AI-generated marking' },
      { type: 'spec', pattern: /watermark|provenance|ai.*label/i, description: 'Content provenance' },
    ],
  },
];

export class EUAIActFramework {
  private controls: FrameworkControl[];

  constructor() {
    this.controls = EU_AI_ACT_ARTICLES;
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
          // Check preconditions
          if (behavior.preconditions?.length && pattern.test('precondition')) {
            evidence.push({
              type: 'isl_spec',
              source: `${behavior.name}.preconditions`,
              content: `${behavior.preconditions.length} preconditions defined`,
            });
          }

          // Check postconditions
          if (behavior.postconditions?.length && pattern.test('postcondition')) {
            evidence.push({
              type: 'isl_spec',
              source: `${behavior.name}.postconditions`,
              content: `${behavior.postconditions.length} postconditions defined`,
            });
          }

          // Check observability
          if (behavior.observability && pattern.test('observability|log|audit|trace')) {
            evidence.push({
              type: 'isl_spec',
              source: `${behavior.name}.observability`,
              content: 'Observability spec defined',
            });
          }

          // Check security
          if (behavior.security) {
            if (behavior.security.authentication && pattern.test('authentication|auth|security')) {
              evidence.push({
                type: 'isl_spec',
                source: `${behavior.name}.security.authentication`,
                content: behavior.security.authentication,
              });
            }
            if (behavior.security.rateLimit && pattern.test('rate.*limit|throttle')) {
              evidence.push({
                type: 'isl_spec',
                source: `${behavior.name}.security.rateLimit`,
                content: `Rate limit: ${behavior.security.rateLimit.requests}/${behavior.security.rateLimit.window}`,
              });
            }
            if (behavior.security.encryption && pattern.test('encrypt|security')) {
              evidence.push({
                type: 'isl_spec',
                source: `${behavior.name}.security.encryption`,
                content: `Encryption: ${behavior.security.encryption.algorithm || 'enabled'}`,
              });
            }
          }

          // Check behavior-level compliance
          if (behavior.preconditions?.length && pattern.test('validate|verify|test')) {
            evidence.push({
              type: 'isl_spec',
              source: `${behavior.name}.preconditions`,
              content: `${behavior.preconditions.length} validation rules`,
            });
          }

          if (behavior.postconditions?.length && pattern.test('verify|verification|accuracy')) {
            evidence.push({
              type: 'isl_spec',
              source: `${behavior.name}.postconditions`,
              content: `${behavior.postconditions.length} verification postconditions`,
            });
          }
        }
      }

      // Check actors for human oversight controls
      if (domain.actors && mapping.type === 'spec' && pattern.test('human|review|approve|override|operator')) {
        for (const actor of domain.actors) {
          if (/admin|operator|reviewer|human/i.test(actor.name)) {
            evidence.push({
              type: 'isl_spec',
              source: `actor ${actor.name}`,
              content: `Human oversight actor with ${actor.permissions.length} permissions`,
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
    // Core AI safety requirements are critical
    const criticalControls = ['Art.9(1)', 'Art.14(1)', 'Art.15(1)', 'Art.15(4)', 'Art.13(1)'];
    const highRiskControls = ['Art.9(4)', 'Art.10(2)', 'Art.12(1)', 'Art.14(4)', 'Art.15(3)', 'Art.17(1)(e)'];

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
   * Determine AI risk classification for a domain based on ISL spec analysis
   */
  classifyRiskLevel(domain: Domain): 'unacceptable' | 'high' | 'limited' | 'minimal' {
    const hasHealthData = domain.types.some(t =>
      t.fields.some(f => f.annotations?.some(a =>
        a.includes('[phi]') || a.includes('[health]') || a.includes('[medical]')
      ))
    );

    const hasBiometricData = domain.types.some(t =>
      t.fields.some(f => f.annotations?.some(a =>
        a.includes('[biometric]') || a.includes('[facial]')
      ))
    );

    const hasAutomatedDecision = domain.behaviors.some(b =>
      /score|classify|rank|decision|predict|assess/i.test(b.name)
    );

    const hasSafetyRelevant = domain.behaviors.some(b =>
      /safety|critical|emergency/i.test(b.name)
    );

    // High-risk indicators (Annex III)
    if (hasHealthData && hasAutomatedDecision) return 'high';
    if (hasBiometricData) return 'high';
    if (hasSafetyRelevant) return 'high';
    if (hasAutomatedDecision) return 'limited';
    return 'minimal';
  }

  /**
   * Check if domain has human oversight mechanisms
   */
  hasHumanOversight(domain: Domain): {
    humanReview: boolean;
    override: boolean;
    emergencyStop: boolean;
    explanation: boolean;
  } {
    const behaviorNames = domain.behaviors.map(b => b.name.toLowerCase());

    return {
      humanReview: behaviorNames.some(n => /review|approve|manual/i.test(n)),
      override: behaviorNames.some(n => /override|rollback|revert|undo/i.test(n)),
      emergencyStop: behaviorNames.some(n => /stop|halt|disable|kill/i.test(n)),
      explanation: behaviorNames.some(n => /explain|reason|justify/i.test(n)),
    };
  }
}
