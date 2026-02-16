/**
 * EU AI Act Compliance Framework Mapping
 * 
 * Maps ISL constructs to EU AI Act requirements for AI system compliance.
 */

import type { FrameworkControl, ISLMapping, ControlMapping, Domain, ControlStatus, ComplianceEvidence, RiskLevel } from '../types';

export const EU_AI_ACT_REQUIREMENTS: FrameworkControl[] = [
  // Title III, Chapter II: Requirements for High-Risk AI Systems
  {
    id: 'ARTICLE-10',
    name: 'Data and Data Governance',
    description: 'Training, validation and testing data sets shall be relevant, representative, free of errors and complete',
    category: 'Data Governance',
    islMappings: [
      { type: 'behavior', pattern: /train|validate|test/i, description: 'Model training behavior' },
      { type: 'spec', pattern: /data.*quality|data.*governance/i, description: 'Data quality specifications' },
      { type: 'annotation', pattern: '[training_data]', description: 'Training data annotation' },
    ],
  },
  {
    id: 'ARTICLE-11',
    name: 'Technical Documentation',
    description: 'High-risk AI systems shall be accompanied by technical documentation',
    category: 'Documentation',
    islMappings: [
      { type: 'spec', pattern: /api|openapi|swagger/i, description: 'API documentation' },
      { type: 'behavior', pattern: /document|spec|describe/i, description: 'Documentation behavior' },
      { type: 'entity', pattern: /documentation|spec/i, description: 'Documentation entities' },
    ],
  },
  {
    id: 'ARTICLE-12',
    name: 'Record Keeping',
    description: 'High-risk AI systems shall allow automatic recording of events',
    category: 'Logging',
    islMappings: [
      { type: 'behavior', pattern: /log|audit|record/i, description: 'Logging behavior' },
      { type: 'spec', pattern: /audit.*trail|log.*level/i, description: 'Audit specifications' },
      { type: 'annotation', pattern: '[logged]', description: 'Logged operation annotation' },
    ],
  },
  {
    id: 'ARTICLE-13',
    name: 'Transparency and Provision of Information to Users',
    description: 'High-risk AI systems shall be designed and developed in such a way that they are sufficiently transparent',
    category: 'Transparency',
    islMappings: [
      { type: 'behavior', pattern: /explain|interpret|transparent/i, description: 'Explainability behavior' },
      { type: 'spec', pattern: /explainability|interpretability/i, description: 'Transparency specifications' },
      { type: 'annotation', pattern: '[explainable]', description: 'Explainable annotation' },
    ],
  },
  {
    id: 'ARTICLE-14',
    name: 'Human Oversight',
    description: 'High-risk AI systems shall be designed and developed in such a way that they can be effectively overseen by humans',
    category: 'Human Oversight',
    islMappings: [
      { type: 'behavior', pattern: /human.*review|manual.*override/i, description: 'Human review behavior' },
      { type: 'spec', pattern: /human.*in.*loop|oversight/i, description: 'Oversight specifications' },
      { type: 'actor', pattern: /human|operator|reviewer/i, description: 'Human actors' },
    ],
  },
  {
    id: 'ARTICLE-15',
    name: 'Accuracy, Robustness and Cybersecurity',
    description: 'High-risk AI systems shall achieve appropriate accuracy, robustness, and cybersecurity',
    category: 'Security & Robustness',
    islMappings: [
      { type: 'behavior', pattern: /validate|test|verify/i, description: 'Validation behavior' },
      { type: 'spec', pattern: /accuracy|robustness|security/i, description: 'Quality specifications' },
      { type: 'annotation', pattern: '[validated]', description: 'Validated annotation' },
    ],
  },
];

export class EUAIActFramework {
  private controls: FrameworkControl[];

  constructor() {
    this.controls = EU_AI_ACT_REQUIREMENTS;
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
