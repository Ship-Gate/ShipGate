import { CodeBlock, CodeTabs } from "@/components/CodeBlock";
import { Callout } from "@/components/docs/callout";

export const metadata = {
  title: "TypeScript Generation",
  description: "Generate TypeScript types, validators, and contracts from ISL.",
};

export default function TypeScriptPage() {
  return (
    <div>
      <h1>TypeScript Generation</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        Generate type-safe TypeScript code from ISL specifications.
      </p>

      <h2 id="basic-usage">Basic Usage</h2>
      <CodeBlock
        code="isl generate typescript auth.isl -o ./src/generated"
        language="bash"
      />

      <h2 id="generated-files">Generated Files</h2>
      <p>For each ISL file, the generator creates:</p>
      <ul>
        <li><code>*.types.ts</code> - TypeScript interfaces and types</li>
        <li><code>*.validators.ts</code> - Zod schemas for validation</li>
        <li><code>*.contracts.ts</code> - Runtime contract checkers</li>
      </ul>

      <h2 id="example">Example</h2>
      <p>Given this ISL specification:</p>

      <CodeBlock
        code={`intent CreateUser {
  pre {
    email != ""
    email.matches(/^[^@]+@[^@]+$/)
    password.length >= 8
  }
  
  post {
    result.id != null
    result.email == email
    result.createdAt <= now()
  }
}

type User {
  id: UUID [immutable]
  email: Email [unique]
  passwordHash: String [sensitive]
  createdAt: Timestamp [immutable]
}`}
        language="isl"
        filename="user.isl"
        showLineNumbers
      />

      <p>The generator produces:</p>

      <CodeBlock
        code={`// user.types.ts
export interface User {
  readonly id: string;
  readonly email: string;
  /** @sensitive - Do not log or expose */
  passwordHash: string;
  readonly createdAt: Date;
}

export interface CreateUserInput {
  email: string;
  password: string;
}

export interface CreateUserOutput {
  id: string;
  email: string;
  createdAt: Date;
}`}
        language="typescript"
        filename="user.types.ts"
      />

      <CodeBlock
        code={`// user.validators.ts
import { z } from "zod";

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  passwordHash: z.string(),
  createdAt: z.coerce.date(),
});

export const CreateUserInputSchema = z.object({
  email: z.string().email().min(1),
  password: z.string().min(8),
});

export type User = z.infer<typeof UserSchema>;
export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;`}
        language="typescript"
        filename="user.validators.ts"
      />

      <CodeBlock
        code={`// user.contracts.ts
import type { CreateUserInput, CreateUserOutput } from "./user.types";

export interface CreateUserContract {
  checkPreconditions(input: CreateUserInput): ValidationResult;
  checkPostconditions(input: CreateUserInput, output: CreateUserOutput): ValidationResult;
}

export function createUserContract(): CreateUserContract {
  return {
    checkPreconditions(input) {
      const errors: string[] = [];
      
      if (input.email === "") {
        errors.push("email must not be empty");
      }
      if (!/^[^@]+@[^@]+$/.test(input.email)) {
        errors.push("email must be valid format");
      }
      if (input.password.length < 8) {
        errors.push("password must be at least 8 characters");
      }
      
      return { valid: errors.length === 0, errors };
    },
    
    checkPostconditions(input, output) {
      const errors: string[] = [];
      
      if (output.id == null) {
        errors.push("result.id must not be null");
      }
      if (output.email !== input.email) {
        errors.push("result.email must equal input email");
      }
      if (output.createdAt > new Date()) {
        errors.push("result.createdAt must be in the past");
      }
      
      return { valid: errors.length === 0, errors };
    }
  };
}`}
        language="typescript"
        filename="user.contracts.ts"
      />

      <h2 id="options">Configuration Options</h2>
      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Option</th>
              <th className="text-left py-2 px-3">Default</th>
              <th className="text-left py-2 px-3">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>runtime</code></td>
              <td className="py-2 px-3">zod</td>
              <td className="py-2 px-3">Validation library: zod, yup, or none</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>strict</code></td>
              <td className="py-2 px-3">true</td>
              <td className="py-2 px-3">Enable strict TypeScript mode</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>readonly</code></td>
              <td className="py-2 px-3">true</td>
              <td className="py-2 px-3">Mark immutable fields as readonly</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>formatting</code></td>
              <td className="py-2 px-3">prettier</td>
              <td className="py-2 px-3">Code formatter: prettier, eslint, or none</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Callout type="tip">
        The generated validators can be used with Express, Fastify, or any
        TypeScript backend to validate incoming requests.
      </Callout>
    </div>
  );
}
