// ============================================================================
// Terraform Generator Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generate } from '../src/generator';
import { generateAwsProvider, generateAwsVpc, generateAwsRds, generateAwsLambda } from '../src/providers/aws';
import { generateGcpProvider, generateGcpCloudSql } from '../src/providers/gcp';
import { generateAzureProvider, generateAzurePostgres } from '../src/providers/azure';
import { extractComputeRequirements } from '../src/resources/compute';
import { extractDatabaseRequirements } from '../src/resources/database';
import { extractNetworkRequirements } from '../src/resources/network';
import type * as AST from '../../../master_contracts/ast';

// ============================================================================
// Test Fixtures
// ============================================================================

function loc(): AST.SourceLocation {
  return { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
}

const createMinimalDomain = (): AST.Domain => ({
  kind: 'Domain',
  name: { kind: 'Identifier', name: 'Payments', location: loc() },
  version: { kind: 'StringLiteral', value: '2.0.0', location: loc() },
  imports: [],
  types: [],
  entities: [createPaymentEntity()],
  behaviors: [createPaymentBehavior()],
  invariants: [],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
  location: loc(),
});

const createPaymentEntity = (): AST.Entity => ({
  kind: 'Entity',
  name: { kind: 'Identifier', name: 'Payment', location: loc() },
  fields: [
    {
      kind: 'Field',
      name: { kind: 'Identifier', name: 'id', location: loc() },
      type: { kind: 'PrimitiveType', name: 'UUID', location: loc() },
      optional: false,
      annotations: [],
      location: loc(),
    },
    {
      kind: 'Field',
      name: { kind: 'Identifier', name: 'amount', location: loc() },
      type: { kind: 'PrimitiveType', name: 'Decimal', location: loc() },
      optional: false,
      annotations: [],
      location: loc(),
    },
  ],
  invariants: [],
  location: loc(),
});

const createPaymentBehavior = (): AST.Behavior => ({
  kind: 'Behavior',
  name: { kind: 'Identifier', name: 'CreatePayment', location: loc() },
  input: {
    kind: 'InputSpec',
    fields: [
      {
        kind: 'Field',
        name: { kind: 'Identifier', name: 'amount', location: loc() },
        type: { kind: 'PrimitiveType', name: 'Decimal', location: loc() },
        optional: false,
        annotations: [],
        location: loc(),
      },
    ],
    location: loc(),
  },
  output: {
    kind: 'OutputSpec',
    success: { kind: 'ReferenceType', name: { kind: 'QualifiedName', parts: [{ kind: 'Identifier', name: 'Payment', location: loc() }], location: loc() }, location: loc() },
    errors: [],
    location: loc(),
  },
  preconditions: [],
  postconditions: [],
  invariants: [],
  temporal: [
    {
      kind: 'TemporalSpec',
      operator: 'within',
      predicate: { kind: 'Identifier', name: 'response', location: loc() },
      duration: { kind: 'DurationLiteral', value: 500, unit: 'ms', location: loc() },
      percentile: 99,
      location: loc(),
    },
  ],
  security: [
    {
      kind: 'SecuritySpec',
      type: 'rate_limit',
      details: { kind: 'NumberLiteral', value: 1000, isFloat: false, location: loc() },
      location: loc(),
    },
  ],
  compliance: [
    {
      kind: 'ComplianceSpec',
      standard: { kind: 'Identifier', name: 'pci_dss', location: loc() },
      requirements: [],
      location: loc(),
    },
  ],
  location: loc(),
});

// ============================================================================
// Generator Tests
// ============================================================================

describe('Terraform Generator', () => {
  describe('generate()', () => {
    it('should generate files for AWS provider', () => {
      const domain = createMinimalDomain();
      const files = generate(domain, { provider: 'aws' });

      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.path === 'main.tf')).toBe(true);
      expect(files.some((f) => f.path === 'variables.tf')).toBe(true);
      expect(files.some((f) => f.path === 'outputs.tf')).toBe(true);
    });

    it('should generate files for GCP provider', () => {
      const domain = createMinimalDomain();
      const files = generate(domain, { provider: 'gcp' });

      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.path === 'main.tf')).toBe(true);
    });

    it('should generate files for Azure provider', () => {
      const domain = createMinimalDomain();
      const files = generate(domain, { provider: 'azure' });

      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.path === 'main.tf')).toBe(true);
    });

    it('should include API gateway when api feature is enabled', () => {
      const domain = createMinimalDomain();
      const files = generate(domain, { provider: 'aws', features: ['api', 'compute'] });

      expect(files.some((f) => f.path === 'api.tf')).toBe(true);
    });

    it('should include database when database feature is enabled', () => {
      const domain = createMinimalDomain();
      const files = generate(domain, { provider: 'aws', features: ['database'] });

      const mainTf = files.find((f) => f.path === 'main.tf');
      expect(mainTf?.content).toContain('Database Infrastructure');
    });
  });
});

// ============================================================================
// AWS Provider Tests
// ============================================================================

describe('AWS Provider', () => {
  it('should generate valid provider configuration', () => {
    const result = generateAwsProvider('Payments', '2.0.0');

    expect(result).toContain('terraform {');
    expect(result).toContain('required_providers');
    expect(result).toContain('hashicorp/aws');
    expect(result).toContain('provider "aws"');
    expect(result).toContain('payments');
  });

  it('should generate VPC with flow logs', () => {
    const result = generateAwsVpc('Payments', true);

    expect(result).toContain('module "vpc"');
    expect(result).toContain('terraform-aws-modules/vpc/aws');
    expect(result).toContain('enable_flow_log');
  });

  it('should generate RDS with encryption', () => {
    const result = generateAwsRds('Payments', 'postgres', true, true);

    expect(result).toContain('module "database"');
    expect(result).toContain('storage_encrypted = true');
    expect(result).toContain('aws_kms_key');
  });

  it('should generate Lambda with VPC and tracing', () => {
    const result = generateAwsLambda('CreatePayment', 'Payments', 30, 512, true, true);

    expect(result).toContain('aws_lambda_function');
    expect(result).toContain('vpc_config');
    expect(result).toContain('tracing_config');
    expect(result).toContain('timeout     = 30');
  });
});

// ============================================================================
// GCP Provider Tests
// ============================================================================

describe('GCP Provider', () => {
  it('should generate valid provider configuration', () => {
    const result = generateGcpProvider('Payments', '2.0.0');

    expect(result).toContain('terraform {');
    expect(result).toContain('hashicorp/google');
    expect(result).toContain('provider "google"');
  });

  it('should generate Cloud SQL with encryption', () => {
    const result = generateGcpCloudSql('Payments', true, true);

    expect(result).toContain('google_sql_database_instance');
    expect(result).toContain('POSTGRES_15');
    expect(result).toContain('google_secret_manager_secret');
  });
});

// ============================================================================
// Azure Provider Tests
// ============================================================================

describe('Azure Provider', () => {
  it('should generate valid provider configuration', () => {
    const result = generateAzureProvider('Payments', '2.0.0');

    expect(result).toContain('terraform {');
    expect(result).toContain('hashicorp/azurerm');
    expect(result).toContain('provider "azurerm"');
    expect(result).toContain('azurerm_resource_group');
  });

  it('should generate PostgreSQL Flexible Server', () => {
    const result = generateAzurePostgres('Payments', true);

    expect(result).toContain('azurerm_postgresql_flexible_server');
    expect(result).toContain('azurerm_key_vault');
  });
});

// ============================================================================
// Requirements Extraction Tests
// ============================================================================

describe('Requirements Extraction', () => {
  describe('extractComputeRequirements()', () => {
    it('should extract timeout from temporal specs', () => {
      const behavior = createPaymentBehavior();
      const requirements = extractComputeRequirements(behavior, []);

      // 500ms * 3 buffer = 1500ms = ~2s, but minimum is higher
      expect(requirements.timeout).toBeGreaterThanOrEqual(2);
    });

    it('should enable VPC for PCI compliance', () => {
      const behavior = createPaymentBehavior();
      const requirements = extractComputeRequirements(behavior, ['pci_dss']);

      expect(requirements.vpcEnabled).toBe(true);
    });

    it('should enable tracing by default', () => {
      const behavior = createPaymentBehavior();
      const requirements = extractComputeRequirements(behavior, []);

      expect(requirements.tracingEnabled).toBe(true);
    });
  });

  describe('extractDatabaseRequirements()', () => {
    it('should return null when no entities', () => {
      const requirements = extractDatabaseRequirements(false, []);

      expect(requirements).toBeNull();
    });

    it('should enable multi-AZ for PCI compliance', () => {
      const requirements = extractDatabaseRequirements(true, ['pci_dss']);

      expect(requirements?.multiAz).toBe(true);
      expect(requirements?.backupRetention).toBe(30);
    });
  });

  describe('extractNetworkRequirements()', () => {
    it('should require VPC for compliance', () => {
      const requirements = extractNetworkRequirements(['pci_dss'], true, true);

      expect(requirements.vpcRequired).toBe(true);
      expect(requirements.flowLogs).toBe(true);
      expect(requirements.natGateway).toBe(true);
    });

    it('should require VPC for database', () => {
      const requirements = extractNetworkRequirements([], true, false);

      expect(requirements.vpcRequired).toBe(true);
    });
  });
});

// ============================================================================
// Output Validation Tests
// ============================================================================

describe('Output Validation', () => {
  it('should generate valid HCL syntax', () => {
    const domain = createMinimalDomain();
    const files = generate(domain, { provider: 'aws' });
    const mainTf = files.find((f) => f.path === 'main.tf');

    // Check for balanced braces
    const content = mainTf?.content || '';
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;

    expect(openBraces).toBe(closeBraces);
  });

  it('should include domain metadata in tags', () => {
    const domain = createMinimalDomain();
    const files = generate(domain, { provider: 'aws' });
    const mainTf = files.find((f) => f.path === 'main.tf');

    expect(mainTf?.content).toContain('Domain');
    expect(mainTf?.content).toContain('payments');
    expect(mainTf?.content).toContain('2.0.0');
  });
});
