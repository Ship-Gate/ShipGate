import type { PropertyProof, PropertyName } from './types.js';

interface PropertyRiskProfile {
  name: string;
  riskStatement: string;
  tier: 1 | 2;
}

const PROPERTY_RISKS: Record<PropertyName, PropertyRiskProfile> = {
  'import-integrity': {
    name: 'Import Integrity',
    riskStatement: 'Unverified imports may cause runtime errors or reference non-existent modules',
    tier: 1,
  },
  'type-safety': {
    name: 'Type Safety',
    riskStatement: 'Type errors may exist, allowing invalid data to flow through the application',
    tier: 1,
  },
  'error-handling': {
    name: 'Error Handling',
    riskStatement: 'Unhandled errors may crash the application or leak sensitive stack traces',
    tier: 1,
  },
  'auth-coverage': {
    name: 'Authentication Coverage',
    riskStatement: 'Protected endpoints may be accessible without authentication',
    tier: 1,
  },
  'input-validation': {
    name: 'Input Validation',
    riskStatement: 'Invalid input may bypass validation and cause unexpected behavior',
    tier: 1,
  },
  'sql-injection': {
    name: 'SQL Injection Prevention',
    riskStatement: 'SQL injection vulnerabilities may allow unauthorized database access',
    tier: 1,
  },
  'xss-prevention': {
    name: 'XSS Prevention',
    riskStatement: 'Cross-site scripting vulnerabilities may allow malicious script execution',
    tier: 1,
  },
  'secret-exposure': {
    name: 'Secret Exposure',
    riskStatement: 'API keys, tokens, or credentials may be exposed in code or logs',
    tier: 2,
  },
  'dependency-security': {
    name: 'Dependency Security',
    riskStatement: 'Third-party dependencies may contain known security vulnerabilities',
    tier: 2,
  },
  'rate-limiting': {
    name: 'Rate Limiting',
    riskStatement: 'Endpoints may be vulnerable to DoS attacks without rate limiting',
    tier: 2,
  },
  'logging-compliance': {
    name: 'Logging Compliance',
    riskStatement: 'Sensitive data may be logged, violating privacy regulations',
    tier: 2,
  },
  'data-encryption': {
    name: 'Data Encryption',
    riskStatement: 'Sensitive data may be transmitted or stored without encryption',
    tier: 2,
  },
  'session-security': {
    name: 'Session Security',
    riskStatement: 'Session tokens may be vulnerable to theft or hijacking',
    tier: 2,
  },
};

const INHERENT_LIMITATIONS = [
  'Business logic correctness cannot be statically verified',
  'Third-party dependency runtime behavior not verified',
  'Infrastructure configuration and deployment security not verified',
  'Performance and scalability characteristics not verified',
  'User experience and accessibility not verified',
];

export function generateResidualRisks(properties: PropertyProof[]): string[] {
  const risks: string[] = [];

  // Check each known property
  for (const [propertyName, riskProfile] of Object.entries(PROPERTY_RISKS)) {
    const proof = properties.find(p => p.property === propertyName);

    if (!proof) {
      // Property was not checked at all
      risks.push(`NOT VERIFIED — ${riskProfile.name}: ${riskProfile.riskStatement}`);
    } else if (proof.status === 'FAILED') {
      // Property check failed
      risks.push(`FAILED — ${riskProfile.name}: ${riskProfile.riskStatement} (${proof.findings.length} issues found)`);
    } else if (proof.status === 'PARTIAL') {
      // Property partially verified
      risks.push(`PARTIAL — ${riskProfile.name}: ${riskProfile.riskStatement} (confidence: ${proof.confidence})`);
    } else if (proof.status === 'NOT_VERIFIED') {
      // Property prover ran but could not verify
      risks.push(`NOT VERIFIED — ${riskProfile.name}: ${riskProfile.riskStatement} (${proof.summary})`);
    }
    // PROVEN properties are not included in residual risks
  }

  // Add inherent limitations
  for (const limitation of INHERENT_LIMITATIONS) {
    risks.push(`LIMITATION — ${limitation}`);
  }

  return risks;
}

export function categorizeRisks(risks: string[]): {
  critical: string[];
  important: string[];
  limitations: string[];
} {
  const critical: string[] = [];
  const important: string[] = [];
  const limitations: string[] = [];

  for (const risk of risks) {
    if (risk.startsWith('LIMITATION')) {
      limitations.push(risk);
    } else if (risk.includes('Tier 1') || risk.includes('SQL Injection') || risk.includes('Authentication') || risk.includes('XSS')) {
      critical.push(risk);
    } else {
      important.push(risk);
    }
  }

  return { critical, important, limitations };
}
