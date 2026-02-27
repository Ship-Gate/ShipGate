// ============================================================================
// Terraform Generator – Validation & Golden-Output Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generate, extractInfrastructureRequirements } from '../src/index';
import { createPaymentsDomain, createInventoryDomain } from './fixtures';
import type { GeneratedFile, InfraFeature } from '../src/types';

// ============================================================================
// Helpers
// ============================================================================

function assertBalancedBraces(content: string, label: string): void {
  const open = (content.match(/{/g) || []).length;
  const close = (content.match(/}/g) || []).length;
  expect(open, `Unbalanced braces in ${label}: open=${open} close=${close}`).toBe(close);
}

function assertBalancedBrackets(content: string, label: string): void {
  const open = (content.match(/\[/g) || []).length;
  const close = (content.match(/\]/g) || []).length;
  expect(open, `Unbalanced brackets in ${label}: open=${open} close=${close}`).toBe(close);
}

function assertBalancedParens(content: string, label: string): void {
  const open = (content.match(/\(/g) || []).length;
  const close = (content.match(/\)/g) || []).length;
  expect(open, `Unbalanced parens in ${label}: open=${open} close=${close}`).toBe(close);
}

/** Structural HCL checks that substitute for offline `terraform fmt -check` */
function assertValidHclStructure(content: string, label: string): void {
  assertBalancedBraces(content, label);
  assertBalancedBrackets(content, label);
  assertBalancedParens(content, label);
}

function assertRequiredFiles(files: GeneratedFile[]): void {
  const paths = files.map((f) => f.path);
  expect(paths).toContain('main.tf');
  expect(paths).toContain('variables.tf');
  expect(paths).toContain('outputs.tf');
  expect(paths).toContain('terraform.tfvars.example');
}

const ALL_FEATURES: InfraFeature[] = ['database', 'queue', 'storage', 'compute', 'api'];

// ============================================================================
// 1. extractInfrastructureRequirements – public API
// ============================================================================

describe('extractInfrastructureRequirements()', () => {
  it('infers database from entities', () => {
    const reqs = extractInfrastructureRequirements(createPaymentsDomain(), ['database']);
    expect(reqs.database).not.toBeNull();
    expect(reqs.database!.engine).toBe('postgres');
  });

  it('returns null database when feature not requested', () => {
    const reqs = extractInfrastructureRequirements(createPaymentsDomain(), ['compute']);
    expect(reqs.database).toBeNull();
  });

  it('infers queue from behaviors', () => {
    const reqs = extractInfrastructureRequirements(createInventoryDomain(), ['queue']);
    expect(reqs.queue).not.toBeNull();
    expect(reqs.queue!.deadLetterQueue).toBe(true);
  });

  it('infers storage when feature requested', () => {
    const reqs = extractInfrastructureRequirements(createInventoryDomain(), ['storage']);
    expect(reqs.storage).not.toBeNull();
    expect(reqs.storage!.encrypted).toBe(true);
  });

  it('derives PCI compliance from behaviors', () => {
    const reqs = extractInfrastructureRequirements(createPaymentsDomain(), ['database', 'compute']);
    expect(reqs.security.compliance).toContain('pci_dss');
    expect(reqs.database!.multiAz).toBe(true);
  });

  it('computes monitoring alarms from temporal specs', () => {
    const reqs = extractInfrastructureRequirements(createPaymentsDomain(), ['compute']);
    expect(reqs.monitoring.alarms.length).toBeGreaterThan(0);
    const latencyAlarm = reqs.monitoring.alarms.find((a) => a.name.includes('latency'));
    expect(latencyAlarm).toBeDefined();
  });

  it('no compliance → simpler requirements', () => {
    const reqs = extractInfrastructureRequirements(createInventoryDomain(), ['database', 'compute']);
    expect(reqs.security.compliance).toHaveLength(0);
    expect(reqs.database!.multiAz).toBe(false);
    expect(reqs.network.flowLogs).toBe(false);
  });
});

// ============================================================================
// 2. HCL Structural Validation (offline terraform fmt -check substitute)
// ============================================================================

describe('HCL Structural Validation', () => {
  const providers = ['aws', 'gcp', 'azure'] as const;
  const domains = [
    { name: 'Payments', factory: createPaymentsDomain },
    { name: 'Inventory', factory: createInventoryDomain },
  ];

  for (const prov of providers) {
    for (const { name, factory } of domains) {
      describe(`${name} × ${prov}`, () => {
        const files = generate(factory(), { provider: prov, features: [...ALL_FEATURES] });

        it('generates the required file set', () => {
          assertRequiredFiles(files);
        });

        it('all .tf files have balanced braces, brackets, parens', () => {
          for (const f of files) {
            if (f.path.endsWith('.tf')) {
              assertValidHclStructure(f.content, `${name}/${prov}/${f.path}`);
            }
          }
        });

        it('main.tf contains provider block', () => {
          const main = files.find((f) => f.path === 'main.tf')!;
          expect(main.content).toContain('terraform {');
          expect(main.content).toContain('required_providers');
        });

        it('variables.tf contains environment variable', () => {
          const vars = files.find((f) => f.path === 'variables.tf')!;
          expect(vars.content).toContain('variable "environment"');
        });

        it('outputs.tf contains at least one output block', () => {
          const out = files.find((f) => f.path === 'outputs.tf')!;
          expect(out.content).toContain('output "');
        });

        it('tfvars.example references environment', () => {
          const tfvars = files.find((f) => f.path === 'terraform.tfvars.example')!;
          expect(tfvars.content.length).toBeGreaterThan(50);
          expect(tfvars.content).toContain('environment');
        });
      });
    }
  }
});

// ============================================================================
// 3. AWS Resource Content
// ============================================================================

describe('AWS Resource Content', () => {
  it('Payments: RDS Postgres with KMS', () => {
    const main = generate(createPaymentsDomain(), { provider: 'aws', features: ['database', 'compute'] })
      .find((f) => f.path === 'main.tf')!;
    expect(main.content).toContain('aws_kms_key');
    expect(main.content).toContain('storage_encrypted = true');
    expect(main.content).toContain('module "database"');
    expect(main.content).toContain('postgres');
  });

  it('Payments: SQS with DLQ', () => {
    const main = generate(createPaymentsDomain(), { provider: 'aws', features: ['queue'] })
      .find((f) => f.path === 'main.tf')!;
    expect(main.content).toContain('aws_sqs_queue');
    expect(main.content).toContain('dlq');
    expect(main.content).toContain('redrive_policy');
  });

  it('Payments: S3 with encryption + versioning + public-access block', () => {
    const main = generate(createPaymentsDomain(), { provider: 'aws', features: ['storage'] })
      .find((f) => f.path === 'main.tf')!;
    expect(main.content).toContain('aws_s3_bucket');
    expect(main.content).toContain('aws_s3_bucket_versioning');
    expect(main.content).toContain('aws_s3_bucket_server_side_encryption_configuration');
    expect(main.content).toContain('aws_s3_bucket_public_access_block');
  });

  it('Inventory: Lambda per behavior', () => {
    const main = generate(createInventoryDomain(), { provider: 'aws', features: ['compute'] })
      .find((f) => f.path === 'main.tf')!;
    expect(main.content).toContain('aws_lambda_function');
    expect(main.content).toContain('addproduct');
    expect(main.content).toContain('uploadimage');
  });
});

// ============================================================================
// 4. Stable Output / Deterministic Diffs
// ============================================================================

describe('Stable Output', () => {
  const combos = [
    { label: 'Payments×AWS', factory: createPaymentsDomain, provider: 'aws' as const },
    { label: 'Inventory×AWS', factory: createInventoryDomain, provider: 'aws' as const },
    { label: 'Payments×GCP', factory: createPaymentsDomain, provider: 'gcp' as const },
    { label: 'Inventory×Azure', factory: createInventoryDomain, provider: 'azure' as const },
  ];

  for (const { label, factory, provider } of combos) {
    it(`${label} is deterministic across runs`, () => {
      const opts = { provider, features: [...ALL_FEATURES] };
      const run1 = generate(factory(), opts);
      const run2 = generate(factory(), opts);
      expect(run1.length).toBe(run2.length);
      for (let i = 0; i < run1.length; i++) {
        expect(run1[i]!.path, `file path mismatch at index ${i}`).toBe(run2[i]!.path);
        expect(run1[i]!.content, `content mismatch in ${run1[i]!.path}`).toBe(run2[i]!.content);
      }
    });
  }
});

// ============================================================================
// 5. Golden Snapshot – Payments × AWS
// ============================================================================

describe('Golden Snapshot: Payments × AWS', () => {
  const files = generate(createPaymentsDomain(), { provider: 'aws', features: [...ALL_FEATURES] });

  it('main.tf structural markers', () => {
    const main = files.find((f) => f.path === 'main.tf')!;
    expect(main.content).toContain('required_version = ">= 1.0"');
    expect(main.content).toContain('hashicorp/aws');
    expect(main.content).toContain('Domain      = "payments"');
    expect(main.content).toContain('Version     = "2.0.0"');
    expect(main.content).toContain('# Database Infrastructure');
    expect(main.content).toContain('# Queue Infrastructure');
    expect(main.content).toContain('# Storage Infrastructure');
    expect(main.content).toContain('# Compute Infrastructure');
  });

  it('variables.tf has all sections', () => {
    const vars = files.find((f) => f.path === 'variables.tf')!;
    expect(vars.content).toContain('variable "environment"');
    expect(vars.content).toContain('variable "aws_region"');
    expect(vars.content).toContain('variable "terraform_state_bucket"');
    expect(vars.content).toContain('variable "db_instance_class"');
    expect(vars.content).toContain('variable "lambda_package_path"');
    expect(vars.content).toContain('variable "sqs_visibility_timeout"');
    expect(vars.content).toContain('variable "s3_versioning_enabled"');
  });

  it('outputs.tf has expected outputs', () => {
    const out = files.find((f) => f.path === 'outputs.tf')!;
    expect(out.content).toContain('output "vpc_id"');
    expect(out.content).toContain('output "database_endpoint"');
    expect(out.content).toContain('output "createpayment_function_name"');
    expect(out.content).toContain('output "events_queue_url"');
    expect(out.content).toContain('output "data_bucket_name"');
  });

  it('terraform.tfvars.example content', () => {
    const tfvars = files.find((f) => f.path === 'terraform.tfvars.example')!;
    expect(tfvars.content).toContain('environment = "dev"');
    expect(tfvars.content).toContain('aws_region');
    expect(tfvars.content).toContain('db_instance_class');
  });
});

// ============================================================================
// 6. Golden Snapshot – Inventory × AWS
// ============================================================================

describe('Golden Snapshot: Inventory × AWS', () => {
  const files = generate(createInventoryDomain(), { provider: 'aws', features: [...ALL_FEATURES] });

  it('main.tf structural markers', () => {
    const main = files.find((f) => f.path === 'main.tf')!;
    expect(main.content).toContain('Domain      = "inventory"');
    expect(main.content).toContain('Version     = "1.0.0"');
    expect(main.content).toContain('addproduct');
    expect(main.content).toContain('uploadimage');
    expect(main.content).toContain('module "database"');
    expect(main.content).toContain('aws_s3_bucket');
    expect(main.content).toContain('aws_sqs_queue');
  });

  it('variables.tf has all section headers', () => {
    const vars = files.find((f) => f.path === 'variables.tf')!;
    expect(vars.content).toContain('# Database Variables');
    expect(vars.content).toContain('# Compute Variables');
    expect(vars.content).toContain('# Queue Variables');
    expect(vars.content).toContain('# Storage Variables');
  });

  it('outputs.tf has per-function outputs', () => {
    const out = files.find((f) => f.path === 'outputs.tf')!;
    expect(out.content).toContain('output "database_endpoint"');
    expect(out.content).toContain('output "addproduct_function_name"');
    expect(out.content).toContain('output "uploadimage_function_name"');
  });
});

// ============================================================================
// 7. Feature Toggle Tests
// ============================================================================

describe('Feature Toggles', () => {
  it('empty features → only provider block', () => {
    const main = generate(createPaymentsDomain(), { provider: 'aws', features: [] })
      .find((f) => f.path === 'main.tf')!;
    expect(main.content).toContain('provider "aws"');
    expect(main.content).not.toContain('module "database"');
    expect(main.content).not.toContain('aws_sqs_queue');
    expect(main.content).not.toContain('aws_s3_bucket');
    expect(main.content).not.toContain('aws_lambda_function');
  });

  it('only database → no queue or storage', () => {
    const main = generate(createPaymentsDomain(), { provider: 'aws', features: ['database'] })
      .find((f) => f.path === 'main.tf')!;
    expect(main.content).toContain('module "database"');
    expect(main.content).not.toContain('aws_sqs_queue');
    expect(main.content).not.toContain('aws_s3_bucket');
  });

  it('only queue + storage → no database', () => {
    const main = generate(createPaymentsDomain(), { provider: 'aws', features: ['queue', 'storage'] })
      .find((f) => f.path === 'main.tf')!;
    expect(main.content).not.toContain('module "database"');
    expect(main.content).toContain('aws_sqs_queue');
    expect(main.content).toContain('aws_s3_bucket');
  });
});
