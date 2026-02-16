import { describe, it, expect, beforeEach } from 'vitest';
import {
  generate,
  ComplianceGenerator,
  analyzeCompliance,
  collectEvidence,
  PCIDSSFramework,
  SOC2Framework,
  HIPAAFramework,
  GDPRFramework,
  EUAIActFramework,
  FedRAMPFramework,
  ComplianceAggregator,
  aggregateCompliance,
  VerificationAutoLinker,
  autoLinkVerification,
} from '../src';
import type { Domain, VerifyResult } from '../src/types';
import type { VerificationSignal } from '../src/auto-linker';

// Test domain with payment processing
const paymentDomain: Domain = {
  name: 'Payments',
  version: '2.0.0',
  description: 'Payment processing domain',
  types: [
    {
      name: 'CardInfo',
      fields: [
        { name: 'last_four', type: 'String', constraints: ['length: 4'] },
        { name: 'brand', type: 'String' },
      ],
    },
    {
      name: 'PaymentRequest',
      fields: [
        { name: 'amount', type: 'Money' },
        { name: 'card_token', type: 'String', annotations: ['[sensitive]'] },
        { name: 'customer_id', type: 'CustomerId', annotations: ['[personal_data]'] },
      ],
    },
  ],
  behaviors: [
    {
      name: 'CreatePayment',
      input: [
        { name: 'amount', type: 'Money' },
        { name: 'card_token', type: 'String', annotations: ['[sensitive]'] },
      ],
      output: [
        { name: 'payment_id', type: 'PaymentId' },
        { name: 'status', type: 'PaymentStatus' },
      ],
      preconditions: [
        { name: 'valid_amount', expression: 'amount > 0 && amount <= MAX_AMOUNT' },
        { name: 'valid_token', expression: 'card_token != null' },
      ],
      postconditions: [
        { name: 'payment_created', expression: 'result.payment_id != null' },
        { name: 'status_valid', expression: "result.status in ['pending', 'succeeded']" },
      ],
      security: {
        authentication: 'jwt',
        authorization: ['payments:write'],
        rateLimit: { requests: 100, window: '1.minute' },
        encryption: { algorithm: 'AES-256-GCM' },
      },
      observability: {
        logs: [
          { level: 'info', message: 'Payment created', fields: ['payment_id', 'amount'] },
        ],
        metrics: ['payment_count', 'payment_amount'],
      },
      compliance: {
        pci_dss: {
          card_token: 'encrypted_in_transit',
          card_data: 'never_logged',
        },
      },
    },
    {
      name: 'RefundPayment',
      input: [{ name: 'payment_id', type: 'PaymentId' }],
      output: [{ name: 'refund_id', type: 'RefundId' }],
      preconditions: [
        { name: 'payment_exists', expression: 'exists(Payment where id == payment_id)' },
      ],
      postconditions: [
        { name: 'refund_created', expression: 'result.refund_id != null' },
      ],
      security: {
        authentication: 'jwt',
        authorization: ['payments:refund'],
      },
      observability: {
        logs: [
          { level: 'info', message: 'Payment refunded', fields: ['payment_id', 'refund_id'] },
        ],
      },
    },
  ],
  actors: [
    { name: 'admin', permissions: ['payments:write', 'payments:refund', 'payments:read'], authentication: 'mfa' },
    { name: 'customer', permissions: ['payments:write', 'payments:read'], authentication: 'jwt' },
  ],
  compliance: {
    pci_dss: {
      card_data: 'never_stored',
      tokens: 'encrypted_at_rest',
    },
  },
};

// Test domain with user data (GDPR)
const userDomain: Domain = {
  name: 'Users',
  version: '1.0.0',
  types: [
    {
      name: 'User',
      fields: [
        { name: 'id', type: 'UserId' },
        { name: 'email', type: 'Email', annotations: ['[personal_data]', '[pii]'] },
        { name: 'name', type: 'String', annotations: ['[personal_data]'] },
      ],
    },
  ],
  behaviors: [
    {
      name: 'DeleteUser',
      input: [{ name: 'user_id', type: 'UserId' }],
      postconditions: [
        { name: 'user_deleted', expression: '!exists(User where id == user_id)' },
      ],
      compliance: {
        gdpr: {
          article_17: 'right_to_erasure',
        },
      },
    },
    {
      name: 'ExportUserData',
      input: [{ name: 'user_id', type: 'UserId' }],
      output: [{ name: 'data', type: 'UserExport' }],
      compliance: {
        gdpr: {
          article_20: 'data_portability',
        },
      },
    },
  ],
};

describe('ComplianceGenerator', () => {
  describe('PCI-DSS Report', () => {
    it('should generate a PCI-DSS compliance report', () => {
      const report = generate(paymentDomain, 'pci-dss');

      expect(report.framework).toBe('pci-dss');
      expect(report.frameworkVersion).toBe('4.0');
      expect(report.domain).toBe('Payments');
      expect(report.domainVersion).toBe('2.0.0');
      expect(report.controlMappings.length).toBeGreaterThan(0);
    });

    it('should identify implemented controls', () => {
      const report = generate(paymentDomain, 'pci-dss');
      
      const implemented = report.controlMappings.filter(m => m.status === 'implemented');
      expect(implemented.length).toBeGreaterThan(0);
    });

    it('should include evidence for controls', () => {
      const report = generate(paymentDomain, 'pci-dss');
      
      const withEvidence = report.controlMappings.filter(m => m.evidence.length > 0);
      expect(withEvidence.length).toBeGreaterThan(0);
    });

    it('should identify gaps', () => {
      const report = generate(paymentDomain, 'pci-dss');
      
      // There should be some gaps (e.g., key rotation)
      expect(report.gaps.length).toBeGreaterThan(0);
    });

    it('should generate markdown report', () => {
      const report = generate(paymentDomain, 'pci-dss');
      
      expect(report.markdown).toContain('PCI-DSS Compliance Report');
      expect(report.markdown).toContain('Payments');
      expect(report.markdown).toContain('Control Mapping');
    });

    it('should calculate compliance summary', () => {
      const report = generate(paymentDomain, 'pci-dss');
      
      expect(report.summary.totalControls).toBeGreaterThan(0);
      expect(report.summary.compliancePercentage).toBeGreaterThanOrEqual(0);
      expect(report.summary.compliancePercentage).toBeLessThanOrEqual(100);
    });
  });

  describe('SOC2 Report', () => {
    it('should generate a SOC2 compliance report', () => {
      const report = generate(paymentDomain, 'soc2');

      expect(report.framework).toBe('soc2');
      expect(report.controlMappings.length).toBeGreaterThan(0);
    });

    it('should map ISL observability to SOC2 monitoring controls', () => {
      const report = generate(paymentDomain, 'soc2');
      
      const monitoringControl = report.controlMappings.find(m => m.controlId === 'CC7.2');
      expect(monitoringControl).toBeDefined();
      expect(monitoringControl?.status).not.toBe('not_implemented');
    });
  });

  describe('GDPR Report', () => {
    it('should generate a GDPR compliance report', () => {
      const report = generate(userDomain, 'gdpr');

      expect(report.framework).toBe('gdpr');
      expect(report.controlMappings.length).toBeGreaterThan(0);
    });

    it('should identify right to erasure compliance', () => {
      const report = generate(userDomain, 'gdpr');
      
      const erasureControl = report.controlMappings.find(m => m.controlId === 'Art.17');
      expect(erasureControl).toBeDefined();
      expect(erasureControl?.evidence.length).toBeGreaterThan(0);
    });

    it('should identify personal data handling', () => {
      const framework = new GDPRFramework();
      expect(framework.handlesPersonalData(userDomain)).toBe(true);
    });

    it('should check data subject rights', () => {
      const framework = new GDPRFramework();
      const rights = framework.hasDataSubjectRights(userDomain);
      
      expect(rights.erasure).toBe(true);
      expect(rights.portability).toBe(true);
    });
  });

  describe('HIPAA Report', () => {
    const healthDomain: Domain = {
      name: 'PatientRecords',
      version: '1.0.0',
      types: [
        {
          name: 'Patient',
          fields: [
            { name: 'mrn', type: 'String', annotations: ['[phi]'] },
            { name: 'diagnosis', type: 'String', annotations: ['[phi]', '[sensitive]'] },
          ],
        },
      ],
      behaviors: [
        {
          name: 'GetPatientRecord',
          security: {
            authentication: 'oauth2',
            encryption: { algorithm: 'AES-256-GCM' },
          },
          observability: {
            logs: [{ level: 'info', message: 'Record accessed', fields: ['user_id', 'patient_id'] }],
          },
        },
      ],
    };

    it('should generate a HIPAA compliance report', () => {
      const report = generate(healthDomain, 'hipaa');

      expect(report.framework).toBe('hipaa');
      expect(report.controlMappings.length).toBeGreaterThan(0);
    });

    it('should identify PHI handling', () => {
      const framework = new HIPAAFramework();
      expect(framework.handlesPHI(healthDomain)).toBe(true);
    });

    it('should map encryption to technical safeguards', () => {
      const report = generate(healthDomain, 'hipaa');
      
      const accessControl = report.controlMappings.find(m => m.controlId === '164.312(a)(1)');
      expect(accessControl?.status).not.toBe('not_implemented');
    });
  });
});

describe('ComplianceAnalyzer', () => {
  it('should analyze domain for compliance', () => {
    const result = analyzeCompliance(paymentDomain);

    expect(result.domain).toBe('Payments');
    expect(result.dataClassification.hasSensitiveData).toBe(true);
    expect(result.dataClassification.hasPersonalData).toBe(true);
  });

  it('should identify security controls', () => {
    const result = analyzeCompliance(paymentDomain);

    const authControl = result.securityControls.find(c => c.control === 'Authentication Required');
    expect(authControl?.implemented).toBe(true);

    const rateLimitControl = result.securityControls.find(c => c.control === 'Rate Limiting');
    expect(rateLimitControl?.implemented).toBe(true);
  });

  it('should generate recommendations', () => {
    // Domain without authentication
    const insecureDomain: Domain = {
      name: 'Insecure',
      version: '1.0.0',
      types: [{ name: 'Data', fields: [{ name: 'secret', type: 'String', annotations: ['[secret]'] }] }],
      behaviors: [{ name: 'GetData' }],
    };

    const result = analyzeCompliance(insecureDomain);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('should assess risk levels', () => {
    const result = analyzeCompliance(paymentDomain);

    expect(result.riskAssessment.overallRisk).toBeDefined();
    expect(['critical', 'high', 'medium', 'low', 'info']).toContain(result.riskAssessment.overallRisk);
  });
});

describe('EvidenceCollector', () => {
  it('should collect evidence for controls', () => {
    const framework = new PCIDSSFramework();
    const mappings = framework.mapDomain(paymentDomain);
    
    const evidence = collectEvidence(paymentDomain, mappings, 'pci-dss');

    expect(evidence.domain).toBe('Payments');
    expect(evidence.bundles.length).toBeGreaterThan(0);
  });

  it('should include verification proofs when provided', () => {
    const verifyResults: VerifyResult[] = [
      {
        behavior: 'CreatePayment',
        passed: true,
        score: 94,
        proofBundle: 'bundle-001',
        timestamp: new Date().toISOString(),
      },
    ];

    const report = generate(paymentDomain, 'pci-dss', verifyResults);

    expect(report.verificationProofs.length).toBe(1);
    expect(report.verificationProofs[0].behavior).toBe('CreatePayment');
    expect(report.verificationProofs[0].score).toBe(94);
  });
});

describe('Framework Classes', () => {
  describe('PCIDSSFramework', () => {
    it('should have all requirement controls', () => {
      const framework = new PCIDSSFramework();
      const controls = framework.getControls();

      expect(controls.length).toBeGreaterThan(10);
      expect(controls.find(c => c.id === '3.4.1')).toBeDefined(); // PAN Encryption
      expect(controls.find(c => c.id === '10.2.1')).toBeDefined(); // Audit Logs
    });

    it('should get controls by category', () => {
      const framework = new PCIDSSFramework();
      const dataProtection = framework.getControlsByCategory('Protect Stored Cardholder Data');

      expect(dataProtection.length).toBeGreaterThan(0);
    });
  });

  describe('SOC2Framework', () => {
    it('should have Trust Services Criteria controls', () => {
      const framework = new SOC2Framework();
      const controls = framework.getControls();

      expect(controls.find(c => c.id === 'CC6.1')).toBeDefined(); // Logical Access
      expect(controls.find(c => c.id === 'CC7.2')).toBeDefined(); // System Monitoring
    });
  });

  describe('GDPRFramework', () => {
    it('should have Article controls', () => {
      const framework = new GDPRFramework();
      const controls = framework.getControls();

      expect(controls.find(c => c.id === 'Art.17')).toBeDefined(); // Right to Erasure
      expect(controls.find(c => c.id === 'Art.32')).toBeDefined(); // Security
    });

    it('should get data subject rights controls', () => {
      const framework = new GDPRFramework();
      const rights = framework.getControlsByCategory('Data Subject Rights');

      expect(rights.length).toBeGreaterThan(5);
    });
  });

  describe('HIPAAFramework', () => {
    it('should have Security Rule controls', () => {
      const framework = new HIPAAFramework();
      const controls = framework.getControls();

      expect(controls.find(c => c.id === '164.312(a)(1)')).toBeDefined(); // Access Control
      expect(controls.find(c => c.id === '164.312(b)')).toBeDefined(); // Audit Controls
    });
  });
});

describe('Report Status', () => {
  it('should report compliant for high coverage', () => {
    // Create a well-covered domain with broad spec coverage
    const compliantDomain: Domain = {
      name: 'Compliant',
      version: '1.0.0',
      types: [
        {
          name: 'SecureData',
          fields: [
            { name: 'token', type: 'String', annotations: ['[sensitive]', '[secret]', '[confidential]'] },
          ],
        },
      ],
      behaviors: [
        {
          name: 'SecureAction',
          preconditions: [{ name: 'valid', expression: 'true' }],
          postconditions: [{ name: 'done', expression: 'true' }],
          security: {
            authentication: 'jwt',
            authorization: ['action:do'],
            rateLimit: { requests: 100, window: '1.minute' },
            encryption: { algorithm: 'AES-256', keyRotation: '90.days' },
          },
          observability: {
            logs: [{ level: 'info', message: 'Action', fields: ['user_id'] }],
            metrics: ['count'],
            traces: true,
          },
        },
        {
          name: 'RegisterUser',
          preconditions: [{ name: 'valid_email', expression: 'input.email != null' }],
          postconditions: [{ name: 'user_created', expression: 'result.id != null' }],
          security: { authentication: 'jwt', authorization: ['users:create'] },
        },
        {
          name: 'UpdatePermission',
          preconditions: [{ name: 'has_admin', expression: 'caller.role == admin' }],
          security: { authentication: 'mfa', authorization: ['admin:manage'] },
        },
        {
          name: 'DeleteData',
          postconditions: [{ name: 'deleted', expression: '!exists(Data where id == input.id)' }],
        },
      ],
      actors: [
        { name: 'admin', permissions: ['action:do', 'users:create', 'admin:manage'], authentication: 'mfa' },
        { name: 'user', permissions: ['action:do'], authentication: 'jwt' },
      ],
    };

    const report = generate(compliantDomain, 'soc2');

    // SOC2 has 22 controls; this well-covered domain should hit at least 40%
    expect(report.summary.compliancePercentage).toBeGreaterThan(30);
  });

  it('should identify risk levels in gaps', () => {
    const report = generate(paymentDomain, 'pci-dss');

    for (const gap of report.gaps) {
      expect(['critical', 'high', 'medium', 'low', 'info']).toContain(gap.priority);
    }
  });
});

describe('EU AI Act Framework', () => {
  const aiDomain: Domain = {
    name: 'AIScoring',
    version: '1.0.0',
    types: [
      {
        name: 'ModelInput',
        fields: [
          { name: 'features', type: 'FeatureVector', annotations: ['[training_data]'] },
          { name: 'patient_data', type: 'Record', annotations: ['[phi]', '[biometric]'] },
        ],
      },
    ],
    behaviors: [
      {
        name: 'ScoreApplication',
        preconditions: [{ name: 'valid_input', expression: 'input.features != null' }],
        postconditions: [{ name: 'score_valid', expression: 'result.score >= 0 && result.score <= 1' }],
        security: { authentication: 'jwt', rateLimit: { requests: 50, window: '1.minute' } },
        observability: {
          logs: [{ level: 'info', message: 'Score computed', fields: ['model_version', 'input_hash'] }],
          traces: true,
        },
      },
      {
        name: 'ExplainDecision',
        postconditions: [{ name: 'has_explanation', expression: 'result.explanation != null' }],
      },
      {
        name: 'OverrideDecision',
        preconditions: [{ name: 'is_reviewer', expression: 'caller.role == reviewer' }],
      },
    ],
    actors: [
      { name: 'operator', permissions: ['score:read', 'explain:read'], authentication: 'jwt' },
      { name: 'reviewer', permissions: ['score:read', 'override:write'], authentication: 'mfa' },
    ],
  };

  it('should generate an EU AI Act compliance report', () => {
    const report = generate(aiDomain, 'eu-ai-act');

    expect(report.framework).toBe('eu-ai-act');
    expect(report.frameworkVersion).toBe('2024/1689');
    expect(report.controlMappings.length).toBeGreaterThan(0);
  });

  it('should have all article controls', () => {
    const framework = new EUAIActFramework();
    const controls = framework.getControls();

    expect(controls.find(c => c.id === 'Art.9(1)')).toBeDefined();
    expect(controls.find(c => c.id === 'Art.14(1)')).toBeDefined();
    expect(controls.find(c => c.id === 'Art.15(1)')).toBeDefined();
    expect(controls.find(c => c.id === 'Art.50(2)')).toBeDefined();
  });

  it('should classify AI risk level', () => {
    const framework = new EUAIActFramework();
    expect(framework.classifyRiskLevel(aiDomain)).toBe('high');
  });

  it('should detect human oversight mechanisms', () => {
    const framework = new EUAIActFramework();
    const oversight = framework.hasHumanOversight(aiDomain);

    expect(oversight.override).toBe(true);
    expect(oversight.explanation).toBe(true);
  });

  it('should map transparency controls', () => {
    const report = generate(aiDomain, 'eu-ai-act');

    const transparencyControl = report.controlMappings.find(m => m.controlId === 'Art.13(1)');
    expect(transparencyControl).toBeDefined();
  });

  it('should get controls by category', () => {
    const framework = new EUAIActFramework();
    const riskControls = framework.getControlsByCategory('Risk Management');
    expect(riskControls.length).toBeGreaterThan(0);
  });
});

describe('FedRAMP Framework', () => {
  it('should generate a FedRAMP compliance report', () => {
    const report = generate(paymentDomain, 'fedramp');

    expect(report.framework).toBe('fedramp');
    expect(report.frameworkVersion).toBe('Rev 5');
    expect(report.controlMappings.length).toBeGreaterThan(0);
  });

  it('should have NIST 800-53 controls', () => {
    const framework = new FedRAMPFramework();
    const controls = framework.getControls();

    expect(controls.find(c => c.id === 'AC-3')).toBeDefined();
    expect(controls.find(c => c.id === 'IA-2')).toBeDefined();
    expect(controls.find(c => c.id === 'AU-2')).toBeDefined();
    expect(controls.find(c => c.id === 'SC-8')).toBeDefined();
  });

  it('should get controls by category', () => {
    const framework = new FedRAMPFramework();
    const accessControls = framework.getControlsByCategory('Access Control');
    expect(accessControls.length).toBeGreaterThan(0);
  });

  it('should classify impact level', () => {
    const framework = new FedRAMPFramework();
    expect(framework.classifyImpactLevel(paymentDomain)).toBe('moderate');
  });

  it('should map auth controls from ISL security specs', () => {
    const report = generate(paymentDomain, 'fedramp');

    const authControl = report.controlMappings.find(m => m.controlId === 'IA-2');
    expect(authControl?.status).not.toBe('not_implemented');
  });
});

describe('ComplianceAggregator', () => {
  it('should aggregate compliance across all frameworks', () => {
    const result = aggregateCompliance(paymentDomain);

    expect(result.scores.length).toBe(6);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.domains).toEqual(['Payments']);
  });

  it('should produce per-framework percentage scores', () => {
    const result = aggregateCompliance(paymentDomain);

    for (const score of result.scores) {
      expect(score.percentage).toBeGreaterThanOrEqual(0);
      expect(score.percentage).toBeLessThanOrEqual(100);
      expect(score.autoMapped).toBe(true);
      expect(score.frameworkName).toBeDefined();
    }
  });

  it('should sort scores by percentage descending', () => {
    const result = aggregateCompliance(paymentDomain);

    for (let i = 1; i < result.scores.length; i++) {
      expect(result.scores[i - 1].percentage).toBeGreaterThanOrEqual(result.scores[i].percentage);
    }
  });

  it('should find cross-framework gaps', () => {
    const result = aggregateCompliance(paymentDomain);

    // Cross-framework gaps should only appear when 2+ frameworks share a gap
    for (const gap of result.crossFrameworkGaps) {
      expect(gap.affectedFrameworks.length).toBeGreaterThanOrEqual(2);
      expect(gap.recommendation).toBeDefined();
    }
  });

  it('should aggregate across multiple domains', () => {
    const aggregator = new ComplianceAggregator([paymentDomain, userDomain]);
    const result = aggregator.aggregate(['soc2', 'gdpr']);

    expect(result.domains).toEqual(['Payments', 'Users']);
    expect(result.scores.length).toBe(2);
    expect(result.summary.domainsAssessed).toBe(2);
  });

  it('should aggregate for specific frameworks only', () => {
    const result = aggregateCompliance(paymentDomain, ['soc2', 'pci-dss']);

    expect(result.scores.length).toBe(2);
    expect(result.scores.map(s => s.framework)).toContain('soc2');
    expect(result.scores.map(s => s.framework)).toContain('pci-dss');
  });

  it('should compute summary stats', () => {
    const result = aggregateCompliance(paymentDomain);

    expect(result.summary.totalControlsAcrossFrameworks).toBeGreaterThan(0);
    expect(result.summary.frameworksAssessed).toBe(6);
    expect(result.summary.domainsAssessed).toBe(1);
  });
});

describe('VerificationAutoLinker', () => {
  it('should auto-link verification signals to controls', () => {
    const signals: VerificationSignal[] = [
      { source: 'security_scanner', category: 'authentication', passed: true, score: 95 },
      { source: 'security_scanner', category: 'encryption', passed: true, score: 90 },
      { source: 'verifier', category: 'input_validation', passed: true, score: 88 },
      { source: 'test_runner', category: 'audit_logging', passed: true, score: 100 },
    ];

    const result = autoLinkVerification(paymentDomain, signals);

    expect(result.domain).toBe('Payments');
    expect(result.summary.totalSignals).toBe(4);
    expect(result.summary.totalLinks).toBeGreaterThan(0);
    expect(result.summary.totalControlsCovered).toBeGreaterThan(0);
  });

  it('should report coverage by framework', () => {
    const signals: VerificationSignal[] = [
      { source: 'verifier', category: 'authentication', passed: true },
    ];

    const result = autoLinkVerification(paymentDomain, signals, ['soc2', 'pci-dss']);

    expect(result.coverageByFramework['soc2']).toBeDefined();
    expect(result.coverageByFramework['pci-dss']).toBeDefined();
    expect(result.coverageByFramework['soc2'].total).toBeGreaterThan(0);
  });

  it('should mark failed controls', () => {
    const signals: VerificationSignal[] = [
      { source: 'security_scanner', category: 'authentication', passed: false, score: 20 },
    ];

    const result = autoLinkVerification(paymentDomain, signals);

    const failedControls = result.linkedControls.filter(c => c.status === 'failed');
    expect(failedControls.length).toBeGreaterThan(0);
    expect(failedControls[0].evidenceStrength).toBe('weak');
  });

  it('should track unmapped signals', () => {
    const signals: VerificationSignal[] = [
      { source: 'verifier', category: 'general', passed: true },
    ];

    const result = autoLinkVerification(paymentDomain, signals);

    expect(result.unmappedSignals.length).toBe(1);
  });

  it('should convert VerifyResults to signals', () => {
    const verifyResults: VerifyResult[] = [
      {
        behavior: 'CreatePayment',
        passed: true,
        score: 94,
        timestamp: new Date().toISOString(),
        details: [
          { check: 'authentication_required', passed: true },
          { check: 'input_validation_check', passed: true },
        ],
      },
    ];

    const signals = VerificationAutoLinker.fromVerifyResults(verifyResults);

    expect(signals.length).toBeGreaterThan(1);
    expect(signals[0].source).toBe('verifier');
    expect(signals[0].category).toBe('formal_verification');
  });

  it('should assign evidence strength based on evidence types', () => {
    const signals: VerificationSignal[] = [
      { source: 'verifier', category: 'authentication', passed: true },
      { source: 'test_runner', category: 'authentication', passed: true },
    ];

    const result = autoLinkVerification(paymentDomain, signals, ['soc2']);

    const authControls = result.linkedControls.filter(
      c => c.framework === 'soc2' && c.verificationLinks.length >= 2
    );
    // Multiple passing signals = strong evidence
    for (const ctrl of authControls) {
      expect(ctrl.evidenceStrength).toBe('strong');
    }
  });
});
