/**
 * ISL Compliance Analyzer
 * 
 * Analyzes ISL domain specifications for compliance indicators,
 * data classification, and security controls.
 */

import type {
  Domain,
  BehaviorDefinition,
  TypeDefinition,
  FieldDefinition,
  ComplianceFramework,
  RiskLevel,
} from './types';

export interface AnalysisResult {
  domain: string;
  version: string;
  dataClassification: DataClassification;
  securityControls: SecurityControl[];
  complianceIndicators: ComplianceIndicator[];
  riskAssessment: RiskAssessment;
  recommendations: Recommendation[];
}

export interface DataClassification {
  hasSensitiveData: boolean;
  hasSecretData: boolean;
  hasPersonalData: boolean;
  hasPHI: boolean;
  hasPaymentData: boolean;
  sensitiveFields: SensitiveField[];
}

export interface SensitiveField {
  type: string;
  field: string;
  classification: 'sensitive' | 'secret' | 'personal' | 'phi' | 'payment';
  annotations: string[];
}

export interface SecurityControl {
  category: string;
  control: string;
  implemented: boolean;
  source: string;
  details?: string;
}

export interface ComplianceIndicator {
  framework: ComplianceFramework;
  indicator: string;
  found: boolean;
  source?: string;
  value?: string;
}

export interface RiskAssessment {
  overallRisk: RiskLevel;
  dataRisk: RiskLevel;
  accessRisk: RiskLevel;
  operationalRisk: RiskLevel;
  factors: RiskFactor[];
}

export interface RiskFactor {
  category: string;
  description: string;
  level: RiskLevel;
  mitigation?: string;
}

export interface Recommendation {
  priority: RiskLevel;
  category: string;
  recommendation: string;
  suggestedISL?: string;
}

export class ComplianceAnalyzer {
  analyze(domain: Domain): AnalysisResult {
    const dataClassification = this.classifyData(domain);
    const securityControls = this.analyzeSecurityControls(domain);
    const complianceIndicators = this.findComplianceIndicators(domain);
    const riskAssessment = this.assessRisk(domain, dataClassification, securityControls);
    const recommendations = this.generateRecommendations(
      domain,
      dataClassification,
      securityControls,
      riskAssessment
    );

    return {
      domain: domain.name,
      version: domain.version,
      dataClassification,
      securityControls,
      complianceIndicators,
      riskAssessment,
      recommendations,
    };
  }

  private classifyData(domain: Domain): DataClassification {
    const sensitiveFields: SensitiveField[] = [];
    let hasSensitiveData = false;
    let hasSecretData = false;
    let hasPersonalData = false;
    let hasPHI = false;
    let hasPaymentData = false;

    for (const type of domain.types) {
      for (const field of type.fields) {
        const annotations = field.annotations || [];
        
        if (annotations.some(a => a.includes('[sensitive]'))) {
          hasSensitiveData = true;
          sensitiveFields.push({
            type: type.name,
            field: field.name,
            classification: 'sensitive',
            annotations,
          });
        }

        if (annotations.some(a => a.includes('[secret]'))) {
          hasSecretData = true;
          sensitiveFields.push({
            type: type.name,
            field: field.name,
            classification: 'secret',
            annotations,
          });
        }

        if (annotations.some(a => 
          a.includes('[personal_data]') || 
          a.includes('[pii]') ||
          a.includes('[email]')
        )) {
          hasPersonalData = true;
          sensitiveFields.push({
            type: type.name,
            field: field.name,
            classification: 'personal',
            annotations,
          });
        }

        if (annotations.some(a => 
          a.includes('[phi]') || 
          a.includes('[health]') ||
          a.includes('[medical]')
        )) {
          hasPHI = true;
          sensitiveFields.push({
            type: type.name,
            field: field.name,
            classification: 'phi',
            annotations,
          });
        }

        if (annotations.some(a => 
          a.includes('[payment]') || 
          a.includes('[card]') ||
          a.includes('[pan]')
        ) || /card|payment|pan/i.test(field.name)) {
          hasPaymentData = true;
          sensitiveFields.push({
            type: type.name,
            field: field.name,
            classification: 'payment',
            annotations,
          });
        }
      }
    }

    return {
      hasSensitiveData,
      hasSecretData,
      hasPersonalData,
      hasPHI,
      hasPaymentData,
      sensitiveFields,
    };
  }

  private analyzeSecurityControls(domain: Domain): SecurityControl[] {
    const controls: SecurityControl[] = [];

    // Check for authentication
    const hasAuth = domain.behaviors.some(b => 
      b.security?.authentication || 
      b.preconditions?.some(p => /auth|logged.*in|authenticated/i.test(p.expression))
    );
    controls.push({
      category: 'Access Control',
      control: 'Authentication Required',
      implemented: hasAuth,
      source: hasAuth ? 'behavior.security.authentication' : '',
    });

    // Check for authorization/roles
    const hasAuthz = !!(domain.actors && domain.actors.length > 0);
    controls.push({
      category: 'Access Control',
      control: 'Role-Based Access Control',
      implemented: hasAuthz,
      source: hasAuthz ? 'domain.actors' : '',
      details: hasAuthz ? `${domain.actors!.length} actors defined` : undefined,
    });

    // Check for rate limiting
    const hasRateLimit = domain.behaviors.some(b => b.security?.rateLimit);
    controls.push({
      category: 'Security',
      control: 'Rate Limiting',
      implemented: hasRateLimit,
      source: hasRateLimit ? 'behavior.security.rateLimit' : '',
    });

    // Check for encryption
    const hasEncryption = domain.behaviors.some(b => b.security?.encryption);
    controls.push({
      category: 'Security',
      control: 'Encryption',
      implemented: hasEncryption,
      source: hasEncryption ? 'behavior.security.encryption' : '',
    });

    // Check for audit logging
    const hasAuditLog = domain.behaviors.some(b => 
      b.observability?.logs && b.observability.logs.length > 0
    );
    controls.push({
      category: 'Monitoring',
      control: 'Audit Logging',
      implemented: hasAuditLog,
      source: hasAuditLog ? 'behavior.observability.logs' : '',
    });

    // Check for metrics
    const hasMetrics = domain.behaviors.some(b => 
      b.observability?.metrics && b.observability.metrics.length > 0
    );
    controls.push({
      category: 'Monitoring',
      control: 'Metrics Collection',
      implemented: hasMetrics,
      source: hasMetrics ? 'behavior.observability.metrics' : '',
    });

    // Check for input validation
    const hasValidation = domain.behaviors.some(b => 
      b.preconditions && b.preconditions.length > 0
    );
    controls.push({
      category: 'Input Validation',
      control: 'Precondition Checks',
      implemented: hasValidation,
      source: hasValidation ? 'behavior.preconditions' : '',
    });

    // Check for output validation
    const hasOutputValidation = domain.behaviors.some(b => 
      b.postconditions && b.postconditions.length > 0
    );
    controls.push({
      category: 'Output Validation',
      control: 'Postcondition Checks',
      implemented: hasOutputValidation,
      source: hasOutputValidation ? 'behavior.postconditions' : '',
    });

    return controls;
  }

  private findComplianceIndicators(domain: Domain): ComplianceIndicator[] {
    const indicators: ComplianceIndicator[] = [];

    // PCI-DSS indicators
    if (domain.compliance?.pci_dss) {
      for (const [key, value] of Object.entries(domain.compliance.pci_dss)) {
        indicators.push({
          framework: 'pci-dss',
          indicator: key,
          found: true,
          source: 'compliance.pci_dss',
          value: String(value),
        });
      }
    }

    // SOC2 indicators
    if (domain.compliance?.soc2) {
      for (const [key, value] of Object.entries(domain.compliance.soc2)) {
        indicators.push({
          framework: 'soc2',
          indicator: key,
          found: true,
          source: 'compliance.soc2',
          value: String(value),
        });
      }
    }

    // HIPAA indicators
    if (domain.compliance?.hipaa) {
      for (const [key, value] of Object.entries(domain.compliance.hipaa)) {
        indicators.push({
          framework: 'hipaa',
          indicator: key,
          found: true,
          source: 'compliance.hipaa',
          value: String(value),
        });
      }
    }

    // GDPR indicators
    if (domain.compliance?.gdpr) {
      for (const [key, value] of Object.entries(domain.compliance.gdpr)) {
        indicators.push({
          framework: 'gdpr',
          indicator: key,
          found: true,
          source: 'compliance.gdpr',
          value: String(value),
        });
      }
    }

    // EU AI Act indicators
    if (domain.compliance?.eu_ai_act) {
      for (const [key, value] of Object.entries(domain.compliance.eu_ai_act)) {
        indicators.push({
          framework: 'eu-ai-act',
          indicator: key,
          found: true,
          source: 'compliance.eu_ai_act',
          value: String(value),
        });
      }
    }

    // FedRAMP indicators
    if (domain.compliance?.fedramp) {
      for (const [key, value] of Object.entries(domain.compliance.fedramp)) {
        indicators.push({
          framework: 'fedramp',
          indicator: key,
          found: true,
          source: 'compliance.fedramp',
          value: String(value),
        });
      }
    }

    // Check behavior-level compliance
    for (const behavior of domain.behaviors) {
      if (behavior.compliance) {
        if (behavior.compliance.pci_dss) {
          for (const [key, value] of Object.entries(behavior.compliance.pci_dss)) {
            indicators.push({
              framework: 'pci-dss',
              indicator: `${behavior.name}.${key}`,
              found: true,
              source: `${behavior.name}.compliance.pci_dss`,
              value,
            });
          }
        }
        if (behavior.compliance.gdpr) {
          for (const [key, value] of Object.entries(behavior.compliance.gdpr)) {
            indicators.push({
              framework: 'gdpr',
              indicator: `${behavior.name}.${key}`,
              found: true,
              source: `${behavior.name}.compliance.gdpr`,
              value,
            });
          }
        }
      }
    }

    return indicators;
  }

  private assessRisk(
    domain: Domain,
    dataClassification: DataClassification,
    securityControls: SecurityControl[]
  ): RiskAssessment {
    const factors: RiskFactor[] = [];

    // Data risk assessment
    let dataRisk: RiskLevel = 'low';
    if (dataClassification.hasSecretData || dataClassification.hasPaymentData) {
      dataRisk = 'critical';
      factors.push({
        category: 'Data',
        description: 'Domain handles secret or payment data',
        level: 'critical',
        mitigation: 'Ensure encryption at rest and in transit',
      });
    } else if (dataClassification.hasPHI) {
      dataRisk = 'high';
      factors.push({
        category: 'Data',
        description: 'Domain handles protected health information',
        level: 'high',
        mitigation: 'Ensure HIPAA compliance controls',
      });
    } else if (dataClassification.hasPersonalData) {
      dataRisk = 'medium';
      factors.push({
        category: 'Data',
        description: 'Domain handles personal data',
        level: 'medium',
        mitigation: 'Ensure GDPR compliance controls',
      });
    }

    // Access control risk
    const authControl = securityControls.find(c => c.control === 'Authentication Required');
    const rbacControl = securityControls.find(c => c.control === 'Role-Based Access Control');
    let accessRisk: RiskLevel = 'low';

    if (!authControl?.implemented) {
      accessRisk = 'high';
      factors.push({
        category: 'Access Control',
        description: 'No authentication requirement found',
        level: 'high',
        mitigation: 'Add authentication security spec to behaviors',
      });
    }
    if (!rbacControl?.implemented && dataClassification.hasSensitiveData) {
      accessRisk = accessRisk === 'high' ? 'critical' : 'medium';
      factors.push({
        category: 'Access Control',
        description: 'No role-based access control with sensitive data',
        level: 'medium',
        mitigation: 'Define actors with specific permissions',
      });
    }

    // Operational risk
    const auditControl = securityControls.find(c => c.control === 'Audit Logging');
    const validationControl = securityControls.find(c => c.control === 'Precondition Checks');
    let operationalRisk: RiskLevel = 'low';

    if (!auditControl?.implemented) {
      operationalRisk = 'medium';
      factors.push({
        category: 'Operations',
        description: 'No audit logging configured',
        level: 'medium',
        mitigation: 'Add observability specs with logs',
      });
    }
    if (!validationControl?.implemented) {
      operationalRisk = operationalRisk === 'medium' ? 'high' : 'medium';
      factors.push({
        category: 'Operations',
        description: 'No input validation (preconditions)',
        level: 'medium',
        mitigation: 'Add preconditions to validate inputs',
      });
    }

    // Calculate overall risk
    const riskLevels: RiskLevel[] = [dataRisk, accessRisk, operationalRisk];
    let overallRisk: RiskLevel = 'low';
    if (riskLevels.includes('critical')) overallRisk = 'critical';
    else if (riskLevels.includes('high')) overallRisk = 'high';
    else if (riskLevels.includes('medium')) overallRisk = 'medium';

    return {
      overallRisk,
      dataRisk,
      accessRisk,
      operationalRisk,
      factors,
    };
  }

  private generateRecommendations(
    domain: Domain,
    dataClassification: DataClassification,
    securityControls: SecurityControl[],
    riskAssessment: RiskAssessment
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Add recommendations based on missing controls
    for (const control of securityControls) {
      if (!control.implemented) {
        const rec = this.getControlRecommendation(control, dataClassification);
        if (rec) recommendations.push(rec);
      }
    }

    // Add recommendations based on risk factors
    for (const factor of riskAssessment.factors) {
      if (factor.level === 'critical' || factor.level === 'high') {
        recommendations.push({
          priority: factor.level,
          category: factor.category,
          recommendation: factor.mitigation || `Address: ${factor.description}`,
        });
      }
    }

    // Framework-specific recommendations
    if (dataClassification.hasPaymentData) {
      recommendations.push({
        priority: 'high',
        category: 'PCI-DSS',
        recommendation: 'Add PCI-DSS compliance specifications',
        suggestedISL: `compliance {
  pci_dss {
    card_data encrypted_at_rest
    card_data encrypted_in_transit
    card_data never_logged
  }
}`,
      });
    }

    if (dataClassification.hasPersonalData) {
      recommendations.push({
        priority: 'medium',
        category: 'GDPR',
        recommendation: 'Implement data subject rights behaviors',
        suggestedISL: `behavior DeleteUserData {
  input { user_id: UserId }
  
  postcondition user_data_deleted:
    !exists(UserData where user_id == input.user_id)
  
  compliance {
    gdpr { article_17 right_to_erasure }
  }
}`,
      });
    }

    return recommendations.sort((a, b) => {
      const order: Record<RiskLevel, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return order[a.priority] - order[b.priority];
    });
  }

  private getControlRecommendation(
    control: SecurityControl,
    dataClassification: DataClassification
  ): Recommendation | null {
    switch (control.control) {
      case 'Authentication Required':
        return {
          priority: dataClassification.hasSensitiveData ? 'high' : 'medium',
          category: 'Access Control',
          recommendation: 'Add authentication requirements',
          suggestedISL: `security {
  authentication: "jwt"
  requires: ["authenticated"]
}`,
        };

      case 'Rate Limiting':
        return {
          priority: 'medium',
          category: 'Security',
          recommendation: 'Add rate limiting to prevent abuse',
          suggestedISL: `security {
  rate_limit {
    requests: 100
    window: "1.minute"
  }
}`,
        };

      case 'Audit Logging':
        return {
          priority: dataClassification.hasSensitiveData ? 'high' : 'medium',
          category: 'Monitoring',
          recommendation: 'Add audit logging for compliance',
          suggestedISL: `observability {
  logs [
    { level: "info", message: "Action performed", fields: ["user_id", "action", "timestamp"] }
  ]
}`,
        };

      default:
        return null;
    }
  }
}

export function analyzeCompliance(domain: Domain): AnalysisResult {
  const analyzer = new ComplianceAnalyzer();
  return analyzer.analyze(domain);
}
