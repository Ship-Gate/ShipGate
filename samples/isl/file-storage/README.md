# File / Storage Pipeline

File upload with virus scanning, processing pipeline, integrity checksums, and quota management.

## Coverage

| Feature | Present |
|---------|---------|
| Preconditions | ✅ |
| Postconditions | ✅ (checksum, quota, status transitions) |
| Invariants | ✅ (pipeline ordering, quarantine, quota cap, integrity) |
| Scenarios | ✅ (upload lifecycle, quarantine block) |
| Temporal | ✅ (upload ack, scan deadline, processing deadline) |

## Key invariants

- **Processing pipeline**: UPLOADING → SCANNING → PROCESSING → READY (strict order).
- **Quarantine**: malware-detected files are quarantined and never downloadable.
- **Integrity**: SHA-256 checksum verified on every download.
- **Quota**: `Bucket.used_size_bytes` never exceeds `max_size_bytes`; reclaimed on delete.

## Usage

```ts
import { samples } from '@isl/samples';
const fs = samples['file-storage'];
```
