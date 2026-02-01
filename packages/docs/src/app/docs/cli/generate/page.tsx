import { CodeBlock } from "@/components/CodeBlock";

export const metadata = {
  title: "isl generate - ISL Documentation",
  description: "Generate code from ISL specifications.",
};

export default function GeneratePage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>isl generate</h1>

        <p className="lead text-xl text-muted-foreground">
          Generate TypeScript types, validation tests, and documentation from 
          ISL specifications.
        </p>

        <h2>Usage</h2>

        <CodeBlock
          code={`isl generate <target> [files...] [options]`}
          language="bash"
        />

        <h2>Targets</h2>

        <table className="my-6">
          <thead>
            <tr>
              <th>Target</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>types</code></td>
              <td>Generate TypeScript interfaces and Zod schemas</td>
            </tr>
            <tr>
              <td><code>tests</code></td>
              <td>Generate verification test files</td>
            </tr>
            <tr>
              <td><code>docs</code></td>
              <td>Generate API documentation</td>
            </tr>
            <tr>
              <td><code>all</code></td>
              <td>Generate all targets</td>
            </tr>
          </tbody>
        </table>

        <h2>Options</h2>

        <table className="my-6">
          <thead>
            <tr>
              <th>Option</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>-o, --output</code></td>
              <td>Output directory</td>
            </tr>
            <tr>
              <td><code>--watch</code></td>
              <td>Watch for changes and regenerate</td>
            </tr>
            <tr>
              <td><code>--clean</code></td>
              <td>Clean output directory before generating</td>
            </tr>
            <tr>
              <td><code>--dry-run</code></td>
              <td>Show what would be generated without writing files</td>
            </tr>
          </tbody>
        </table>

        <h2>Generate Types</h2>

        <CodeBlock
          code={`$ isl generate types specs/ -o src/generated

Generating TypeScript from 5 spec files...

Created:
  src/generated/types.ts        - TypeScript interfaces
  src/generated/schemas.ts      - Zod validation schemas
  src/generated/enums.ts        - Enum definitions
  src/generated/index.ts        - Barrel export

Summary:
  23 types generated
  8 enums generated
  15 entity types generated
  42 behavior types generated`}
          language="bash"
        />

        <h3>Type Generation Options</h3>

        <CodeBlock
          code={`$ isl generate types specs/ \\
    --output src/generated \\
    --schema zod \\
    --strict-null-checks \\
    --readonly-types`}
          language="bash"
        />

        <h2>Generate Tests</h2>

        <CodeBlock
          code={`$ isl generate tests specs/ -o src/tests

Generating tests from 5 spec files...

Created:
  src/tests/auth.preconditions.test.ts
  src/tests/auth.postconditions.test.ts
  src/tests/auth.invariants.test.ts
  src/tests/payments.preconditions.test.ts
  src/tests/payments.postconditions.test.ts
  src/tests/payments.invariants.test.ts
  ...

Summary:
  156 test cases generated
  42 behaviors covered
  15 entities covered`}
          language="bash"
        />

        <h3>Test Generation Options</h3>

        <CodeBlock
          code={`$ isl generate tests specs/ \\
    --output src/tests \\
    --framework vitest \\
    --coverage \\
    --mocks`}
          language="bash"
        />

        <h2>Generate Documentation</h2>

        <CodeBlock
          code={`$ isl generate docs specs/ -o docs/api

Generating documentation...

Created:
  docs/api/index.md
  docs/api/auth.md
  docs/api/payments.md
  docs/api/orders.md
  docs/api/entities/
  docs/api/behaviors/

Summary:
  5 domain docs generated
  15 entity docs generated
  42 behavior docs generated`}
          language="bash"
        />

        <h3>Documentation Options</h3>

        <CodeBlock
          code={`$ isl generate docs specs/ \\
    --output docs/api \\
    --format mdx \\
    --with-examples \\
    --with-diagrams`}
          language="bash"
        />

        <h2>Generate All</h2>

        <CodeBlock
          code={`$ isl generate all specs/

Generating all outputs...

Types:
  ✓ src/generated/types.ts
  ✓ src/generated/schemas.ts

Tests:
  ✓ src/tests/*.test.ts (156 files)

Docs:
  ✓ docs/api/*.md (62 files)

All generation complete!`}
          language="bash"
        />

        <h2>Watch Mode</h2>

        <CodeBlock
          code={`$ isl generate types specs/ -o src/generated --watch

Watching specs/ for changes...
Press Ctrl+C to stop.

[12:34:56] specs/auth.isl changed
[12:34:56] Regenerating...
[12:34:57] Done. Updated 4 files.

[12:35:12] specs/payments.isl changed
[12:35:12] Regenerating...
[12:35:13] Done. Updated 2 files.`}
          language="bash"
        />

        <h2>Dry Run</h2>

        <CodeBlock
          code={`$ isl generate types specs/ -o src/generated --dry-run

Would generate:
  src/generated/types.ts (23 interfaces)
  src/generated/schemas.ts (23 schemas)
  src/generated/enums.ts (8 enums)
  src/generated/index.ts (barrel export)

Total: 4 files, ~2,400 lines`}
          language="bash"
        />
      </div>
    </div>
  );
}
