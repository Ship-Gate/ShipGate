/**
 * Cross-Domain Compliance Aggregator
 *
 * Aggregates compliance results across multiple domains and frameworks
 * to produce the overall % scores (e.g., "SOC 2 Type II: 83% auto-mapped").
 *
 * This is the engine behind the landing page compliance dashboard.
 */

import type {
  Domain,
  ComplianceFramework,
  ComplianceReport,
  ControlMapping,
  ControlStatus,
  ComplianceOptions,
  RiskLevel,
  VerifyResult,
} from './types';
import { ComplianceGenerator } from './generator';

export interface FrameworkScore {
  framework: ComplianceFramework;
  frameworkName: string;
  percentage: number;
  totalControls: number;
  implementedControls: number;
  partialControls: number;
  notImplementedControls: number;
  notApplicableControls: number;
  riskLevel: RiskLevel;
  status: 'compliant' | 'compliant_with_exceptions' | 'non_compliant';
  autoMapped: boolean;
}

export interface CrossFrameworkGap {
  controlIds: Record<ComplianceFramework, string[]>;
  category: string;
  description: string;
  risk: RiskLevel;
  affectedFrameworks: ComplianceFramework[];
  recommendation: string;
  suggestedISL?: string;
}

export interface AggregatedCompliance {
  domains: string[];
  generatedAt: string;
  scores: FrameworkScore[];
  overallScore: number;
  overallRisk: RiskLevel;
  crossFrameworkGaps: CrossFrameworkGap[];
  reports: ComplianceReport[];
  summary: {
    totalControlsAcrossFrameworks: number;
    totalImplemented: number;
    totalPartial: number;
    totalNotImplemented: number;
    frameworksAssessed: number;
    domainsAssessed: number;
  };
}

const FRAMEWORK_DISPLAY_NAMES: Record<ComplianceFramework, string> = {
  'soc2': 'SOC 2 Type II',
  'hipaa': 'HIPAA',
  'eu-ai-act': 'EU AI Act',
  'pci-dss': 'PCI-DSS',
  'fedramp': 'FedRAMP',
  'gdpr': 'GDPR',
};

const ALL_FRAMEWORKS: ComplianceFramework[] = [
  'soc2', 'hipaa', 'eu-ai-act', 'pci-dss', 'fedramp', 'gdpr',
];

/**
 * Categories that map across multiple frameworks.
 * Used to identify cross-framework gaps (one ISL fix → multiple frameworks satisfied).
 */
const CROSS_FRAMEWORK_CATEGORIES: Record<string, {
  description: string;
  frameworks: Partial<Record<ComplianceFramework, string[]>>;
  recommendation: string;
  suggestedISL?: string;
}> = {
  authentication: {
    description: 'Authentication and identity verification',
    frameworks: {
      'soc2': ['CC6.1'],
      'hipaa': ['164.312(a)(1)', '164.312(d)'],
      'pci-dss': ['8.3.1'],
      'fedramp': ['IA-2', 'AC-3'],
      'eu-ai-act': ['Art.15(4)'],
      'gdpr': ['Art.32'],
    },
    recommendation: 'Add authentication specifications to behaviors',
    suggestedISL: `security {\n  authentication: "jwt"\n  requires: ["authenticated"]\n}`,
  },
  audit_logging: {
    description: 'Audit logging and activity monitoring',
    frameworks: {
      'soc2': ['CC7.2'],
      'hipaa': ['164.312(b)'],
      'pci-dss': ['10.2.1'],
      'fedramp': ['AU-2', 'AU-12'],
      'eu-ai-act': ['Art.12(1)'],
      'gdpr': ['Art.30'],
    },
    recommendation: 'Add observability specs with structured audit logging',
    suggestedISL: `observability {\n  logs [\n    { level: "info", message: "Action completed", fields: ["user_id", "action", "timestamp"] }\n  ]\n  metrics ["request_count", "latency_ms"]\n}`,
  },
  encryption: {
    description: 'Data encryption at rest and in transit',
    frameworks: {
      'soc2': ['CC6.7'],
      'hipaa': ['164.312(e)(1)'],
      'pci-dss': ['3.4.1'],
      'fedramp': ['SC-8', 'SC-28', 'SC-13'],
      'eu-ai-act': ['Art.15(4)'],
      'gdpr': ['Art.32'],
    },
    recommendation: 'Add encryption specifications for sensitive data',
    suggestedISL: `security {\n  encryption {\n    algorithm: "AES-256-GCM"\n    key_rotation: "90.days"\n  }\n}`,
  },
  access_control: {
    description: 'Role-based access control and least privilege',
    frameworks: {
      'soc2': ['CC6.3'],
      'hipaa': ['164.308(a)(3)', '164.308(a)(4)'],
      'pci-dss': ['7.2.1', '7.2.2'],
      'fedramp': ['AC-6', 'AC-2'],
      'gdpr': ['Art.25'],
    },
    recommendation: 'Define actors with specific permissions for least-privilege access',
    suggestedISL: `actor Admin {\n  permissions: ["read", "write", "admin"]\n  authentication: "mfa"\n}\n\nactor User {\n  permissions: ["read"]\n  authentication: "jwt"\n}`,
  },
  input_validation: {
    description: 'Input validation and injection prevention',
    frameworks: {
      'soc2': ['PI1.1'],
      'pci-dss': ['6.5.1'],
      'fedramp': ['SI-10', 'SI-3'],
      'eu-ai-act': ['Art.15(1)'],
    },
    recommendation: 'Add preconditions for input validation',
    suggestedISL: `precondition valid_input:\n  input.email matches /^[^@]+@[^@]+$/\n  input.name.length > 0 and input.name.length < 256`,
  },
  incident_response: {
    description: 'Incident detection, response, and notification',
    frameworks: {
      'soc2': ['CC7.3', 'CC7.4'],
      'hipaa': ['164.308(a)(6)'],
      'fedramp': ['IR-4', 'IR-5', 'IR-6'],
      'eu-ai-act': ['Art.17(1)(g)'],
      'gdpr': ['Art.33', 'Art.34'],
    },
    recommendation: 'Add incident response and alerting specifications',
  },
  risk_management: {
    description: 'Risk identification, assessment, and mitigation',
    frameworks: {
      'soc2': ['CC9.1'],
      'fedramp': ['RA-3', 'RA-5'],
      'eu-ai-act': ['Art.9(1)', 'Art.9(2)'],
      'gdpr': ['Art.35'],
    },
    recommendation: 'Add risk assessment and chaos testing specifications',
  },
  human_oversight: {
    description: 'Human review, override, and intervention capabilities',
    frameworks: {
      'eu-ai-act': ['Art.14(1)', 'Art.14(4)'],
      'gdpr': ['Art.22'],
    },
    recommendation: 'Add human oversight behaviors for automated decisions',
    suggestedISL: `behavior ReviewDecision {\n  input { decision_id: DecisionId }\n  \n  precondition decision_exists:\n    exists(Decision where id == input.decision_id)\n  \n  postcondition reviewed:\n    Decision.status == "reviewed"\n}`,
  },
};

export class ComplianceAggregator {
  private domains: Domain[];
  private options: ComplianceOptions;

  constructor(domains: Domain | Domain[], options: ComplianceOptions = {}) {
    this.domains = Array.isArray(domains) ? domains : [domains];
    this.options = options;
  }

  /**
   * Aggregate compliance across all specified frameworks.
   * If no frameworks specified, assesses all available frameworks.
   */
  aggregate(frameworks?: ComplianceFramework[]): AggregatedCompliance {
    const targetFrameworks = frameworks || ALL_FRAMEWORKS;
    const reports: ComplianceReport[] = [];

    // Generate reports for each domain × framework combination
    for (const domain of this.domains) {
      const generator = new ComplianceGenerator(domain, this.options);
      for (const framework of targetFrameworks) {
        const report = generator.generate(framework);
        reports.push(report);
      }
    }

    // Compute per-framework scores (merge across domains)
    const scores = this.computeFrameworkScores(reports, targetFrameworks);

    // Find cross-framework gaps
    const crossFrameworkGaps = this.findCrossFrameworkGaps(reports, targetFrameworks);

    // Compute overall score
    const overallScore = this.computeOverallScore(scores);
    const overallRisk = this.computeOverallRisk(scores);

    // Summary stats
    const summary = {
      totalControlsAcrossFrameworks: scores.reduce((sum, s) => sum + s.totalControls, 0),
      totalImplemented: scores.reduce((sum, s) => sum + s.implementedControls, 0),
      totalPartial: scores.reduce((sum, s) => sum + s.partialControls, 0),
      totalNotImplemented: scores.reduce((sum, s) => sum + s.notImplementedControls, 0),
      frameworksAssessed: targetFrameworks.length,
      domainsAssessed: this.domains.length,
    };

    return {
      domains: this.domains.map(d => d.name),
      generatedAt: new Date().toISOString(),
      scores,
      overallScore,
      overallRisk,
      crossFrameworkGaps,
      reports,
      summary,
    };
  }

  private computeFrameworkScores(reports: ComplianceReport[], frameworks: ComplianceFramework[]): FrameworkScore[] {
    const scores: FrameworkScore[] = [];

    for (const framework of frameworks) {
      const frameworkReports = reports.filter(r => r.framework === framework);
      if (frameworkReports.length === 0) continue;

      // Merge control mappings across domains for the same framework
      const mergedMappings = this.mergeControlMappings(frameworkReports);

      const total = mergedMappings.length;
      const implemented = mergedMappings.filter(m => m.status === 'implemented').length;
      const partial = mergedMappings.filter(m => m.status === 'partial').length;
      const notImplemented = mergedMappings.filter(m => m.status === 'not_implemented').length;
      const notApplicable = mergedMappings.filter(m => m.status === 'not_applicable').length;

      const applicable = total - notApplicable;
      const percentage = applicable > 0
        ? Math.round(((implemented + partial * 0.5) / applicable) * 100)
        : 100;

      let riskLevel: RiskLevel = 'low';
      const criticalGaps = mergedMappings.filter(m => m.risk === 'critical' && m.status !== 'implemented');
      const highGaps = mergedMappings.filter(m => m.risk === 'high' && m.status !== 'implemented');
      if (criticalGaps.length > 0) riskLevel = 'critical';
      else if (highGaps.length > 0) riskLevel = 'high';
      else if (percentage < 80) riskLevel = 'medium';

      let status: 'compliant' | 'compliant_with_exceptions' | 'non_compliant';
      if (percentage >= 95 && riskLevel !== 'critical') status = 'compliant';
      else if (percentage >= 70 && riskLevel !== 'critical') status = 'compliant_with_exceptions';
      else status = 'non_compliant';

      scores.push({
        framework,
        frameworkName: FRAMEWORK_DISPLAY_NAMES[framework],
        percentage,
        totalControls: total,
        implementedControls: implemented,
        partialControls: partial,
        notImplementedControls: notImplemented,
        notApplicableControls: notApplicable,
        riskLevel,
        status,
        autoMapped: true,
      });
    }

    // Sort by percentage descending (highest compliance first)
    return scores.sort((a, b) => b.percentage - a.percentage);
  }

  /**
   * Merge control mappings from multiple domain reports for the same framework.
   * If a control is implemented in ANY domain, it counts as implemented.
   */
  private mergeControlMappings(reports: ComplianceReport[]): ControlMapping[] {
    if (reports.length === 1) return reports[0].controlMappings;

    const controlMap = new Map<string, ControlMapping>();

    for (const report of reports) {
      for (const mapping of report.controlMappings) {
        const existing = controlMap.get(mapping.controlId);
        if (!existing) {
          controlMap.set(mapping.controlId, { ...mapping });
        } else {
          // Upgrade status: implemented > partial > not_implemented
          const statusOrder: Record<ControlStatus, number> = {
            implemented: 3,
            partial: 2,
            not_implemented: 1,
            not_applicable: 0,
          };
          if (statusOrder[mapping.status] > statusOrder[existing.status]) {
            controlMap.set(mapping.controlId, {
              ...mapping,
              evidence: [...existing.evidence, ...mapping.evidence],
            });
          } else {
            // Merge evidence even if status didn't upgrade
            existing.evidence = [...existing.evidence, ...mapping.evidence];
          }
        }
      }
    }

    return Array.from(controlMap.values());
  }

  private findCrossFrameworkGaps(reports: ComplianceReport[], frameworks: ComplianceFramework[]): CrossFrameworkGap[] {
    const gaps: CrossFrameworkGap[] = [];

    // Build a set of not-implemented control IDs per framework
    const notImplementedByFramework = new Map<ComplianceFramework, Set<string>>();
    for (const report of reports) {
      if (!notImplementedByFramework.has(report.framework)) {
        notImplementedByFramework.set(report.framework, new Set());
      }
      const set = notImplementedByFramework.get(report.framework)!;
      for (const mapping of report.controlMappings) {
        if (mapping.status === 'not_implemented' || mapping.status === 'partial') {
          set.add(mapping.controlId);
        }
      }
    }

    // Check each cross-framework category
    for (const [category, config] of Object.entries(CROSS_FRAMEWORK_CATEGORIES)) {
      const affectedFrameworks: ComplianceFramework[] = [];
      const controlIds: Record<string, string[]> = {};

      for (const [framework, controls] of Object.entries(config.frameworks)) {
        const fw = framework as ComplianceFramework;
        if (!frameworks.includes(fw)) continue;

        const notImpl = notImplementedByFramework.get(fw);
        if (!notImpl) continue;

        const missingControls = controls.filter(c => notImpl.has(c));
        if (missingControls.length > 0) {
          affectedFrameworks.push(fw);
          controlIds[fw] = missingControls;
        }
      }

      // Only report if gap affects 2+ frameworks (that's the cross-framework value)
      if (affectedFrameworks.length >= 2) {
        const risk = affectedFrameworks.length >= 4 ? 'critical'
          : affectedFrameworks.length >= 3 ? 'high'
          : 'medium';

        gaps.push({
          controlIds: controlIds as Record<ComplianceFramework, string[]>,
          category,
          description: config.description,
          risk,
          affectedFrameworks,
          recommendation: config.recommendation,
          suggestedISL: config.suggestedISL,
        });
      }
    }

    // Sort by number of affected frameworks (most impact first)
    return gaps.sort((a, b) => b.affectedFrameworks.length - a.affectedFrameworks.length);
  }

  private computeOverallScore(scores: FrameworkScore[]): number {
    if (scores.length === 0) return 0;
    const totalPercentage = scores.reduce((sum, s) => sum + s.percentage, 0);
    return Math.round(totalPercentage / scores.length);
  }

  private computeOverallRisk(scores: FrameworkScore[]): RiskLevel {
    if (scores.some(s => s.riskLevel === 'critical')) return 'critical';
    if (scores.some(s => s.riskLevel === 'high')) return 'high';
    if (scores.some(s => s.riskLevel === 'medium')) return 'medium';
    return 'low';
  }
}

/**
 * Quick aggregation function for a single domain across all frameworks.
 */
export function aggregateCompliance(
  domain: Domain,
  frameworks?: ComplianceFramework[],
  verifyResults?: VerifyResult[]
): AggregatedCompliance {
  const aggregator = new ComplianceAggregator(domain, { verifyResults });
  return aggregator.aggregate(frameworks);
}
