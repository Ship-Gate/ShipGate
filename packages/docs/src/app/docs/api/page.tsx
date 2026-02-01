import { CodeBlock } from "@/components/CodeBlock";
import { APIReference } from "@/components/docs/api-reference";

export const metadata = {
  title: "API Reference",
  description: "Programmatic API for working with ISL.",
};

export default function APIPage() {
  return (
    <div>
      <h1>API Reference</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        Use ISL programmatically from your Node.js or TypeScript applications.
      </p>

      <h2 id="installation">Installation</h2>
      <CodeBlock code="npm install @isl/core" language="bash" />

      <h2 id="parsing">Parsing</h2>
      <APIReference
        name="parse"
        description="Parse ISL source code into an AST"
        signature="function parse(source: string, options?: ParseOptions): ParseResult"
        parameters={[
          {
            name: "source",
            type: "string",
            description: "ISL source code to parse",
            required: true,
          },
          {
            name: "options",
            type: "ParseOptions",
            description: "Parsing options",
            required: false,
          },
        ]}
        returns={{
          type: "ParseResult",
          description: "AST and any parse errors",
        }}
        example={`import { parse } from '@isl/core';

const result = parse(\`
  intent CreateUser {
    pre { email != "" }
    post { result.id != null }
  }
\`);

if (result.errors.length === 0) {
  console.log(result.ast);
}`}
      />

      <h2 id="validation">Validation</h2>
      <APIReference
        name="check"
        description="Validate ISL source code for errors"
        signature="function check(source: string, options?: CheckOptions): CheckResult"
        parameters={[
          {
            name: "source",
            type: "string",
            description: "ISL source code to check",
            required: true,
          },
          {
            name: "options",
            type: "CheckOptions",
            description: "Validation options including strict mode",
            required: false,
          },
        ]}
        returns={{
          type: "CheckResult",
          description: "Validation errors and warnings",
        }}
        example={`import { check } from '@isl/core';

const result = check(source, { strict: true });

if (!result.valid) {
  result.errors.forEach(err => {
    console.error(\`\${err.line}:\${err.column}: \${err.message}\`);
  });
}`}
      />

      <h2 id="code-generation">Code Generation</h2>
      <APIReference
        name="generate"
        description="Generate code from ISL AST"
        signature="function generate(ast: ISLAst, target: GenerationTarget, options?: GenerateOptions): GenerateResult"
        parameters={[
          {
            name: "ast",
            type: "ISLAst",
            description: "Parsed ISL AST",
            required: true,
          },
          {
            name: "target",
            type: "GenerationTarget",
            description: "'typescript' | 'rust' | 'go' | 'openapi'",
            required: true,
          },
          {
            name: "options",
            type: "GenerateOptions",
            description: "Target-specific generation options",
            required: false,
          },
        ]}
        returns={{
          type: "GenerateResult",
          description: "Generated code files",
        }}
        example={`import { parse, generate } from '@isl/core';

const { ast } = parse(source);
const result = generate(ast, 'typescript', {
  runtime: 'zod',
  strict: true,
});

result.files.forEach(file => {
  writeFileSync(file.path, file.content);
});`}
      />

      <h2 id="verification">Verification</h2>
      <APIReference
        name="verify"
        description="Verify implementation against ISL specification"
        signature="async function verify(spec: ISLAst, impl: Implementation, options?: VerifyOptions): Promise<VerifyResult>"
        parameters={[
          {
            name: "spec",
            type: "ISLAst",
            description: "Parsed ISL specification",
            required: true,
          },
          {
            name: "impl",
            type: "Implementation",
            description: "Implementation to verify",
            required: true,
          },
          {
            name: "options",
            type: "VerifyOptions",
            description: "Verification options",
            required: false,
          },
        ]}
        returns={{
          type: "Promise<VerifyResult>",
          description: "Verification results with pass/fail for each condition",
        }}
        example={`import { parse, verify } from '@isl/core';
import { createUserImpl } from './impl';

const { ast } = parse(specSource);
const result = await verify(ast, {
  CreateUser: createUserImpl,
});

console.log(\`Trust Score: \${result.trustScore}%\`);`}
      />

      <h2 id="types">TypeScript Types</h2>
      <CodeBlock
        code={`import type {
  ISLAst,
  Intent,
  Precondition,
  Postcondition,
  Invariant,
  Scenario,
  Type,
  ParseOptions,
  ParseResult,
  CheckOptions,
  CheckResult,
  GenerateOptions,
  GenerateResult,
  VerifyOptions,
  VerifyResult,
} from '@isl/core';`}
        language="typescript"
      />
    </div>
  );
}
