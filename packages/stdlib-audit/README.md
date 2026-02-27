# @intentos/stdlib-audit

ISL Standard Library for Audit Logging with Compliance Features.

## Overview

This package provides a comprehensive audit logging solution designed for compliance with SOC2, PCI-DSS, HIPAA, SOX, and GDPR requirements. It includes:

- **ISL Domain Definitions**: Complete audit event schema with behaviors
- **TypeScript Implementation**: Production-ready audit logger
- **Storage Adapters**: PostgreSQL, Elasticsearch, and S3 archive
- **Exporters**: CSV and JSON formats for compliance reporting
- **PII Handling**: Masking, redaction, and anonymization utilities
- **Integrity Verification**: Event hashing and Merkle tree verification
- **Retention Management**: Automated retention policies per compliance standards

## Installation

```bash
npm install @intentos/stdlib-audit
```

## Quick Start

```typescript
import { 
  createAuditLogger, 
  PostgresAuditStorage,
  EventCategory,
  EventOutcome,
  ActorType,
} from '@intentos/stdlib-audit';

// Create storage adapter
const storage = new PostgresAuditStorage({
  client: pgClient, // Your PostgreSQL client
  tableName: 'audit_events',
});

// Initialize the storage (creates table and indexes)
await storage.initialize();

// Create audit logger
const audit = createAuditLogger({
  storage,
  service: 'my-service',
  version: '1.0.0',
  environment: 'production',
});

// Log an authentication event
await audit.logAuthentication('login', {
  id: 'user-123',
  type: ActorType.USER,
  name: 'John Doe',
  email: 'john@example.com',
  ip_address: '192.168.1.100',
}, EventOutcome.SUCCESS);

// Log a data access event
await audit.logDataAccess('read', {
  id: 'user-123',
  type: ActorType.USER,
}, {
  type: 'customer',
  id: 'cust-456',
  name: 'Acme Corp',
}, EventOutcome.SUCCESS);

// Log a data modification event
await audit.logDataModification('update', {
  id: 'admin-1',
  type: ActorType.USER,
}, {
  type: 'order',
  id: 'order-789',
}, EventOutcome.SUCCESS, [
  { field: 'status', old_value: 'pending', new_value: 'shipped' },
]);
```

## Event Categories

| Category | Description | Default Retention |
|----------|-------------|-------------------|
| `AUTHENTICATION` | Login, logout, password changes | 365 days (SOC2) |
| `AUTHORIZATION` | Permission checks, role changes | 90 days |
| `DATA_ACCESS` | Read operations on sensitive data | 365 days (PCI-DSS) |
| `DATA_MODIFICATION` | Create, update, delete operations | 730 days (SOX) |
| `ADMIN_ACTION` | Administrative operations | 730 days (SOX) |
| `SYSTEM_EVENT` | System-level events | 30 days |
| `SECURITY_EVENT` | Security-related events | 365 days (SOC2) |

## Storage Adapters

### PostgreSQL

```typescript
import { PostgresAuditStorage } from '@intentos/stdlib-audit/storage/postgres';

const storage = new PostgresAuditStorage({
  client: pgClient,
  tableName: 'audit_events',
  schema: 'audit',
  createIndexes: true,
});

await storage.initialize();
```

### Elasticsearch

```typescript
import { ElasticsearchAuditStorage } from '@intentos/stdlib-audit/storage/elasticsearch';

const storage = new ElasticsearchAuditStorage({
  client: esClient,
  indexPrefix: 'audit-events',
  rolloverByMonth: true,
  numberOfShards: 3,
  numberOfReplicas: 1,
});

await storage.initialize();
```

### S3 Archive

```typescript
import { S3AuditArchive } from '@intentos/stdlib-audit/storage/s3';

const archive = new S3AuditArchive({
  client: s3Client,
  bucket: 'audit-archive',
  prefix: 'audit',
  partitionByDate: true,
  defaultCompression: 'GZIP',
});

// Archive events
await archive.archive(events, {
  format: ExportFormat.NDJSON,
  compression: CompressionType.GZIP,
});
```

## Exporting Audit Logs

### CSV Export

```typescript
import { CsvExporter } from '@intentos/stdlib-audit/exporters/csv';

const exporter = new CsvExporter({
  includeHeaders: true,
  delimiter: ',',
});

const output = await exporter.export(events, {
  include_pii: false,
  mask_pii: true,
  compression: CompressionType.GZIP,
});
```

### JSON/NDJSON Export

```typescript
import { JsonExporter, NdjsonExporter } from '@intentos/stdlib-audit/exporters/json';

// Array format
const jsonExporter = new JsonExporter({ pretty: true });

// Newline-delimited format (better for streaming)
const ndjsonExporter = new NdjsonExporter();
```

## PII Handling

```typescript
import { maskPii, redactPii, containsPii } from '@intentos/stdlib-audit/utils/pii';

// Check if event contains PII
if (containsPii(event)) {
  // Mask PII (e.g., "john@example.com" -> "j***@e******.com")
  const maskedEvent = maskPii(event);
  
  // Or completely redact
  const redactedEvent = redactPii(event);
}
```

## Integrity Verification

```typescript
import { 
  hashEvent, 
  verifyEventChain,
  buildMerkleTree,
  verifyMerkleProof,
} from '@intentos/stdlib-audit/utils/hashing';

// Verify chain integrity
const result = verifyEventChain(events);
if (!result.valid) {
  console.error('Chain broken:', result.errors);
}

// Build Merkle tree for batch verification
const tree = buildMerkleTree(events);
const proof = getMerkleProof(tree, eventIndex);
const isValid = verifyMerkleProof(proof);
```

## Retention Management

```typescript
import { 
  RetentionManager,
  DEFAULT_RETENTION_POLICIES,
  validateCompliance,
} from '@intentos/stdlib-audit/utils/retention';

// Validate compliance
const compliance = validateCompliance(policies, 'SOC2');
if (!compliance.compliant) {
  console.error('Compliance issues:', compliance.issues);
}

// Set up retention manager
const retention = new RetentionManager({
  storage,
  policies: DEFAULT_RETENTION_POLICIES,
  archiver: s3Archive,
  runIntervalHours: 24,
  onDelete: (count) => console.log(`Deleted ${count} events`),
});

// Start automated retention
retention.start();
```

## Querying Audit Logs

```typescript
// Query with filters
const result = await audit.query({
  filters: {
    actor_id: 'user-123',
    category: EventCategory.DATA_ACCESS,
    timestamp_start: new Date('2024-01-01'),
    timestamp_end: new Date('2024-12-31'),
  },
  pagination: { page: 1, page_size: 100 },
  sort: { field: 'timestamp', direction: 'DESC' },
});

// Get statistics
const stats = await audit.getStats({
  filters: { category: EventCategory.AUTHENTICATION },
  time_bucket: TimeBucket.DAY,
});
```

## ISL Domain

The package includes complete ISL definitions:

```
intents/
├── domain.isl           # Core types and entities
└── behaviors/
    ├── record.isl       # Record audit events
    ├── query.isl        # Query and search
    └── export.isl       # Export for compliance
```

### Example ISL Usage

```isl
import { Record, Query } from "@stdlib/audit"

behavior AuditedOperation {
  // Record audit event on success
  postconditions {
    success implies {
      AuditEvent.exists(
        action: "operation.performed",
        category: DATA_MODIFICATION,
        resource: { type: "entity", id: input.id }
      )
    }
  }
}
```

## Compliance Matrix

| Standard | Authentication | Data Access | Modifications | Admin Actions | Security |
|----------|---------------|-------------|---------------|---------------|----------|
| SOC2 | 1 year | 1 year | - | - | 1 year |
| PCI-DSS | 1 year | 1 year | - | 1 year | 1 year |
| HIPAA | - | 6 years | 6 years | - | - |
| SOX | - | - | 7 years | 7 years | - |
| GDPR | Min. | Min. | Min. | Min. | Min. |

## API Reference

### AuditLogger

| Method | Description |
|--------|-------------|
| `record(input)` | Record a custom audit event |
| `recordBatch(input)` | Record multiple events atomically |
| `logAuthentication(action, actor, outcome)` | Log auth events |
| `logDataAccess(action, actor, resource, outcome)` | Log data access |
| `logDataModification(action, actor, resource, outcome, changes)` | Log modifications |
| `logAdminAction(action, actor, outcome)` | Log admin actions |
| `logSecurityEvent(action, actor, outcome)` | Log security events |
| `query(input)` | Query audit events |
| `getById(id)` | Get single event by ID |
| `getStats(input)` | Get aggregated statistics |

### RecordInput

```typescript
interface RecordInput {
  action: string;
  category: EventCategory;
  outcome: EventOutcome;
  actor: Actor;
  source: Source;
  description?: string;
  resource?: Resource;
  metadata?: Record<string, unknown>;
  tags?: string[];
  changes?: Change[];
  duration_ms?: number;
  timestamp?: Date;
  idempotency_key?: string;
}
```

## License

MIT
