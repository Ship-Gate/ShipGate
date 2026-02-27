# Database Reality Verifier (Agent 30)

Detects hallucinated DB schema usage: tables/columns/relations that don't exist.

## Features

- **Schema Parsing**: Supports Prisma, Drizzle, and raw SQL migrations
- **Query Extraction**: Extracts queries from ORM calls and SQL strings
- **Reality Checking**: Compares queries against schema models
- **Typo Detection**: Provides "closest match" suggestions for typos
- **Confidence Gating**: Avoids false positives with dynamic query builders

## Usage

```typescript
import { verifyDatabaseQueries } from '@isl-lang/db-reality-verifier';

const results = await verifyDatabaseQueries({
  schemaFiles: ['prisma/schema.prisma'],
  sourceFiles: ['src/**/*.ts'],
});

for (const mismatch of results.mismatches) {
  console.error(`Hallucination detected: ${mismatch.message}`);
  if (mismatch.suggestion) {
    console.log(`Did you mean: ${mismatch.suggestion}`);
  }
}
```

## Supported Schemas

- **Prisma**: `schema.prisma` files
- **Drizzle**: TypeScript schema files
- **SQL Migrations**: Best-effort parsing of CREATE TABLE statements

## Query Extraction

- Prisma ORM calls: `prisma.user.findMany()`
- Drizzle queries: `db.select().from(users)`
- SQL template literals: `sql\`SELECT * FROM users\``
- Raw SQL strings: `"SELECT * FROM users"`
