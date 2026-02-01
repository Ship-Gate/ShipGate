import { CodeBlock } from "@/components/CodeBlock";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Code Generation - ISL Documentation",
  description: "Generate TypeScript types, tests, and documentation from ISL specs.",
};

export default function GeneratePage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>Code Generation</h1>

        <p className="lead text-xl text-muted-foreground">
          Generate TypeScript types, validation tests, and documentation from 
          your ISL specifications.
        </p>

        <h2>Generate TypeScript Types</h2>

        <p>
          The <code>isl generate types</code> command creates TypeScript interfaces 
          and Zod schemas from your specs:
        </p>

        <CodeBlock
          code={`$ isl generate types specs/todo.isl -o src/generated

Generating TypeScript from specs/todo.isl...

Created:
  src/generated/types.ts      - TypeScript interfaces
  src/generated/schemas.ts    - Zod validation schemas
  src/generated/index.ts      - Barrel export

Generated 4 types, 1 enum, 3 behavior types`}
          language="bash"
        />

        <h3>Generated Types</h3>

        <p>
          Here&apos;s what gets generated from our todo spec:
        </p>

        <CodeBlock
          code={`// src/generated/types.ts

// Enums
export enum TodoStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  ARCHIVED = "ARCHIVED",
}

// Entity types
export interface Todo {
  id: string;
  title: string;
  description?: string;
  status: TodoStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// Behavior input/output types
export interface CreateTodoInput {
  title: string;
  description?: string;
}

export interface CreateTodoOutput {
  success: Todo;
}

export interface CreateTodoErrors {
  TITLE_EMPTY: { code: "TITLE_EMPTY"; message: string };
}

export type CreateTodoResult = 
  | { ok: true; data: Todo }
  | { ok: false; error: CreateTodoErrors[keyof CreateTodoErrors] };`}
          language="typescript"
          filename="src/generated/types.ts"
          showLineNumbers
        />

        <h3>Generated Schemas</h3>

        <CodeBlock
          code={`// src/generated/schemas.ts
import { z } from "zod";
import { TodoStatus } from "./types";

export const TodoIdSchema = z.string().uuid();

export const TitleSchema = z.string().min(1).max(200);

export const DescriptionSchema = z.string().max(2000);

export const TodoSchema = z.object({
  id: TodoIdSchema,
  title: TitleSchema,
  description: DescriptionSchema.optional(),
  status: z.nativeEnum(TodoStatus),
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().optional(),
});

export const CreateTodoInputSchema = z.object({
  title: TitleSchema,
  description: DescriptionSchema.optional(),
});`}
          language="typescript"
          filename="src/generated/schemas.ts"
        />

        <h2>Generate Tests</h2>

        <p>
          Generate verification tests that check your implementation against 
          the behavioral contracts:
        </p>

        <CodeBlock
          code={`$ isl generate tests specs/todo.isl -o src/tests

Generating tests from specs/todo.isl...

Created:
  src/tests/todo.preconditions.test.ts
  src/tests/todo.postconditions.test.ts
  src/tests/todo.invariants.test.ts

Generated 12 test cases for 3 behaviors`}
          language="bash"
        />

        <h3>Generated Test Example</h3>

        <CodeBlock
          code={`// src/tests/todo.postconditions.test.ts
import { describe, it, expect } from "vitest";
import { CreateTodoInput, Todo } from "../generated/types";

describe("CreateTodo postconditions", () => {
  it("success implies Todo.exists(result.id)", async () => {
    const input: CreateTodoInput = {
      title: "Test todo",
    };

    const result = await createTodo(input);

    if (result.ok) {
      const exists = await todoExists(result.data.id);
      expect(exists).toBe(true);
    }
  });

  it("success implies result.title == input.title", async () => {
    const input: CreateTodoInput = {
      title: "My test title",
    };

    const result = await createTodo(input);

    if (result.ok) {
      expect(result.data.title).toBe(input.title);
    }
  });

  it("success implies result.status == PENDING", async () => {
    const input: CreateTodoInput = {
      title: "New todo",
    };

    const result = await createTodo(input);

    if (result.ok) {
      expect(result.data.status).toBe("PENDING");
    }
  });
});`}
          language="typescript"
          filename="src/tests/todo.postconditions.test.ts"
        />

        <h2>Generate Documentation</h2>

        <p>
          Generate API documentation from your specs:
        </p>

        <CodeBlock
          code={`$ isl generate docs specs/ -o docs/api

Generating documentation...

Created:
  docs/api/todo.md
  docs/api/index.md

Generated documentation for 1 domain, 3 behaviors`}
          language="bash"
        />

        <h2>Watch Mode</h2>

        <p>
          Use watch mode during development to regenerate on file changes:
        </p>

        <CodeBlock
          code={`$ isl generate types specs/ -o src/generated --watch

Watching specs/ for changes...
Press Ctrl+C to stop.

[12:34:56] Changed: specs/todo.isl
[12:34:56] Regenerated src/generated/`}
          language="bash"
        />

        <h2>Configuration</h2>

        <p>
          Configure generation options in <code>isl.config.json</code>:
        </p>

        <CodeBlock
          code={`{
  "specsDir": "./specs",
  "outDir": "./src/generated",
  "generators": {
    "types": {
      "enabled": true,
      "format": "typescript",
      "schemas": "zod",
      "strictNullChecks": true
    },
    "tests": {
      "enabled": true,
      "framework": "vitest",
      "coverage": true
    },
    "docs": {
      "enabled": true,
      "format": "markdown"
    }
  }
}`}
          language="json"
          filename="isl.config.json"
        />

        <h2>Next Steps</h2>

        <div className="not-prose flex flex-col gap-3">
          <Link
            href="/docs/verification"
            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <div>
              <div className="font-semibold group-hover:text-primary transition-colors">
                Verification
              </div>
              <div className="text-sm text-muted-foreground">
                Run and customize verification tests
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
          <Link
            href="/docs/language"
            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <div>
              <div className="font-semibold group-hover:text-primary transition-colors">
                Language Reference
              </div>
              <div className="text-sm text-muted-foreground">
                Complete guide to ISL syntax and features
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}
