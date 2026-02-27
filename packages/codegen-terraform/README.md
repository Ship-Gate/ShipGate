# @isl-lang/codegen-terraform

Generate production-ready Terraform (AWS / GCP / Azure) from ISL domain specifications.
The generator inspects entities, behaviors, temporal specs, security rules, and compliance
annotations to **infer** the infrastructure a domain requires, then emits validated `.tf` files.

## Installation

```bash
pnpm add @isl-lang/codegen-terraform
```

## Quick Start

```typescript
import { generate, extractInfrastructureRequirements } from '@isl-lang/codegen-terraform';
import type { Domain } from '@isl-lang/parser';

// 1. Inspect what infra the domain needs (optional — useful for dry-run UIs)
const reqs = extractInfrastructureRequirements(domain, ['database', 'queue', 'storage', 'compute', 'api']);
console.log(reqs.database);  // { engine: 'postgres', encrypted: true, multiAz: true, … }
console.log(reqs.queue);     // { type: 'standard', encrypted: true, deadLetterQueue: true, … }

// 2. Generate Terraform files
const files = generate(domain, {
  provider: 'aws',                              // 'aws' | 'gcp' | 'azure'
  features: ['database', 'queue', 'storage', 'compute', 'api'],
  environment: 'production',
});

files.forEach((f) => writeFileSync(f.path, f.content));
// → main.tf, variables.tf, outputs.tf, terraform.tfvars.example, data.tf, api.tf
```

## How Inference Works

`extractInfrastructureRequirements(domain, features)` walks the ISL AST and derives
infrastructure needs from the domain model:

| ISL Signal | Inferred Requirement | AWS Resource |
|---|---|---|
| `entities` present | **Database** (RDS Postgres) | `module "database"` (terraform-aws-modules/rds) |
| `behaviors` present | **Queue** (async event bus) | `aws_sqs_queue` + dead-letter queue |
| `storage` feature flag | **Object Storage** | `aws_s3_bucket` + encryption + versioning |
| `behaviors` array | **Compute** (one function per behavior) | `aws_lambda_function` per behavior |
| `compliance: [pci_dss]` | Multi-AZ DB, VPC flow-logs, WAF, 30-day backup | Enhanced security posture |
| `compliance: [hipaa]` | Multi-AZ DB, VPC, encryption at rest | Enhanced security posture |
| `temporal: within 500ms p99` | CloudWatch latency alarm at threshold | `aws_cloudwatch_metric_alarm` |
| `security: rate_limit 1000` | API Gateway throttle + WAF | `aws_apigatewayv2_stage` throttle config |

### Inference Rules

1. **Database** — Generated when the domain has ≥ 1 entity and `database` is in the features list.
   Engine defaults to Postgres. PCI/HIPAA compliance triggers multi-AZ and extended backup retention (30 days).

2. **Queue** — Generated when the domain has ≥ 1 behavior and `queue` is in the features list.
   Always includes a dead-letter queue. Encryption enabled by default.

3. **Storage** — Generated when `storage` is in the features list.
   Versioning, server-side encryption (KMS), public-access blocking, and lifecycle rules are always on.

4. **Compute** — One Lambda / Cloud Run / Function App per behavior.
   Timeout derived from `temporal within` specs (3× buffer). Memory estimated from behavior complexity
   (preconditions, postconditions, input fields, error specs).

5. **Network** — VPC is auto-required when a database or compliance standard is present.
   PCI/HIPAA triggers NAT gateway and VPC flow-logs.

6. **Security** — WAF enabled when any compliance standard is present.
   Rate-limiting pulled from `security: rate_limit` annotations.

7. **Monitoring** — Alarms auto-generated from `temporal` SLO specs (latency percentile alarms)
   plus a standard error-rate alarm per behavior.

## Override Options

The `GenerateOptions` object controls generation:

```typescript
interface GenerateOptions {
  provider: 'aws' | 'gcp' | 'azure';   // Required — target cloud
  environment?: string;                  // Default: 'dev'
  features?: InfraFeature[];             // Default: ['database', 'api', 'compute']
  region?: string;                       // Provider region override
  multiAz?: boolean;                     // Force multi-AZ (overrides inference)
  enableEncryption?: boolean;            // Force encryption (default: true)
  enableLogging?: boolean;               // Force logging (default: true)
}

type InfraFeature = 'database' | 'queue' | 'storage' | 'cache' | 'cdn' | 'api' | 'compute';
```

**Feature toggles** are the primary override mechanism. Omitting a feature from the array
suppresses all related resources even if the domain signals a need for them:

```typescript
// Only database + compute, skip queue/storage/api
generate(domain, { provider: 'aws', features: ['database', 'compute'] });
```

## Generated Files

| File | Contents |
|---|---|
| `main.tf` | Provider config, network, database, compute, queue, storage, monitoring |
| `variables.tf` | All input variables with descriptions, types, defaults, and validations |
| `outputs.tf` | Resource endpoints, ARNs, IDs for downstream consumption |
| `terraform.tfvars.example` | Copy-pastable example values for every variable |
| `data.tf` | Data sources (caller identity, region, IAM policy docs) |
| `api.tf` | API Gateway / Cloud Endpoints / API Management + WAF (when `api` feature enabled) |

## Provider Support

| Provider | Database | Queue | Storage | Compute | API Gateway | WAF |
|---|---|---|---|---|---|---|
| **AWS** | RDS Postgres | SQS + DLQ | S3 | Lambda | API Gateway v2 | WAFv2 |
| **GCP** | Cloud SQL | Pub/Sub | GCS | Cloud Run | API Gateway | Cloud Armor |
| **Azure** | PostgreSQL Flexible Server | Service Bus | Blob Storage | Function App | API Management | (built-in) |

## Development

```bash
pnpm build        # Build the package
pnpm test         # Run tests (includes HCL validation + golden snapshots)
pnpm typecheck    # Type-check without emit
pnpm clean        # Remove dist/
```

### Test Structure

- `tests/fixtures.ts` — Reusable ISL domain builders (Payments, Inventory)
- `tests/generator.test.ts` — Unit tests for providers, resources, requirement extraction
- `tests/terraform-validate.test.ts` — HCL structural validation, golden snapshots, stability, feature toggles

### Validation Strategy

Since `terraform validate` requires provider plugins, tests use offline structural checks:
- Balanced braces / brackets / parens in all `.tf` output
- Deterministic output across repeated runs (stable diffs)
- Golden snapshot assertions for two reference domains (Payments, Inventory)
- Feature toggle isolation (enabling/disabling features suppresses correct sections)

## License

MIT
