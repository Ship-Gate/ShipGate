# @isl-lang/crud-template

Parameterized CRUD golden template for Next.js App Router + Prisma + TypeScript + Zod + TanStack Query.

## Features

- **Backend**: API routes (GET list, POST create, GET/PUT/DELETE by id), service layer, Zod validators
- **Frontend**: List (Table with pagination/sort/search), Form (react-hook-form + zod), Detail view, TanStack Query hooks, typed API client
- **Parameterizable**: Entity name, fields, searchable/sortable/filterable, auth (public/authenticated/role), soft delete

## Usage

```ts
import { TemplateEngine } from '@isl-lang/crud-template';
import type { EntityDefinition } from '@isl-lang/crud-template';

const entity: EntityDefinition = {
  name: 'Post',
  plural: 'posts',
  fields: [
    { name: 'id', type: 'String', required: true },
    { name: 'title', type: 'String', required: true, searchable: true, sortable: true },
    { name: 'content', type: 'String', required: false },
    { name: 'published', type: 'Boolean', required: true, filterable: true },
    { name: 'createdAt', type: 'DateTime', required: true },
    { name: 'updatedAt', type: 'DateTime', required: true },
  ],
  auth: 'public',
  softDelete: false,
};

const engine = new TemplateEngine({ outputDir: 'src', apiPrefix: 'api' });
const files = engine.generate(entity);

for (const file of files) {
  // Write file.path with file.content
}
```

## CLI

From `packages/crud-template-examples`:

```bash
pnpm generate
```

Generates Post, Product, Invoice CRUD into the current directory.

## Generated Structure

```
src/
├── app/api/[entity]/route.ts          # GET list, POST create
├── app/api/[entity]/[id]/route.ts     # GET, PUT, DELETE
├── lib/validators/[entity].ts         # Zod schemas
├── lib/services/[entity].service.ts   # Prisma queries
├── lib/api/[entity].ts                # Typed fetch client
├── hooks/use[Entity].ts               # TanStack Query hooks
└── components/[entity]s/
    ├── [Entity]List.tsx
    ├── [Entity]Form.tsx
    └── [Entity]Detail.tsx
prisma/
└── schema.prisma                      # When includePrismaModel: true
```
