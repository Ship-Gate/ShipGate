# @isl-lang/spec-inference

**ISL Verify** — Automatic behavioral spec inference from TypeScript/JavaScript codebases.

Reverse-engineers what the code *should* do, then verifies it actually does it. This is the opposite of the old approach (write spec → generate code). Now: **read code → infer spec → verify code against spec**.

## Features

- **Entity inference** — Prisma, Zod, TypeScript interfaces, Mongoose, Drizzle, TypeORM
- **Endpoint inference** — Next.js App Router, Express, Fastify
- **Behavior inference** — Service functions, CRUD, pre/post conditions, side effects
- **Actor inference** — Auth middleware, role checks
- **Framework detection** — Next.js, Express, Fastify, Hono, Koa, NestJS + ORM (Prisma, Mongoose, Drizzle, TypeORM)
- **Confidence scoring** — High (explicit types/schemas), medium (usage patterns), low (heuristics)

## Usage

```ts
import { SpecInferenceEngine } from '@isl-lang/spec-inference';

const engine = new SpecInferenceEngine({
  projectRoot: './my-app',
  domainName: 'MyApp',
});

const result = await engine.infer();
// result.spec - full InferredSpec
// result.confidenceScore - 0-1
// Writes to .isl-verify/inferred-spec.isl by default
```

## API

- `SpecInferenceEngine` — Main orchestrator
- `detectFramework(projectRoot)` — Auto-detect web framework and ORM
- `inferEntities`, `inferEndpoints`, `inferBehaviors`, `inferActors` — Individual inferrers
- `writeInferredSpec(spec, outputPath)` — Write ISL with confidence comments

## Output

Generates `.isl-verify/inferred-spec.isl` with:

- `domain` block
- `entity` blocks (from Prisma/Zod/TS)
- `enum` blocks
- `behavior` blocks
- `api` block with endpoints
- Confidence comments per block: `# [high] inferred from prisma`

## License

MIT
