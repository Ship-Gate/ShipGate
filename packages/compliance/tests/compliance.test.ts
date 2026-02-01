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
} from '../src';
import type { Domain, VerifyResult } from '../src/types';

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
    // Create a well-covered domain
    const compliantDomain: Domain = {
      name: 'Compliant',
      version: '1.0.0',
      types: [],
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
          },
        },
      ],
      actors: [
        { name: 'user', permissions: ['action:do'], authentication: 'jwt' },
      ],
    };

    const report = generate(compliantDomain, 'soc2');
    
    expect(report.summary.compliancePercentage).toBeGreaterThan(50);
  });

  it('should identify risk levels in gaps', () => {
    const report = generate(paymentDomain, 'pci-dss');
    
    for (const gap of report.gaps) {
      expect(['critical', 'high', 'medium', 'low', 'info']).toContain(gap.priority);
    }
  });
});
