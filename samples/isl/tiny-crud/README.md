# Tiny CRUD

Minimal CRUD domain with a single `Todo` entity. Demonstrates the full create/read/update/delete lifecycle plus list-with-filter.

## Coverage

| Feature | Present |
|---------|---------|
| Preconditions | ✅ |
| Postconditions | ✅ |
| Invariants | ✅ (ARCHIVED terminal state) |
| Scenarios | ✅ (full lifecycle) |
| Error handling | ✅ |
| Pagination | ✅ |

## Key invariants

- `ARCHIVED` is a terminal status — cannot transition back to `OPEN`.
- `updated_at >= created_at` on every mutation.

## Usage

```ts
import { samples } from '@isl/samples';
const crud = samples['tiny-crud'];
```
