import { CodeBlock } from "@/components/CodeBlock";
import { CommandReference } from "@/components/docs/command-reference";
import { Callout } from "@/components/docs/callout";

export const metadata = {
  title: "CLI Reference",
  description: "Complete reference for the ISL command-line interface.",
};

export default function CLIPage() {
  return (
    <div>
      <h1>CLI Reference</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        The ISL command-line interface for checking, generating, and verifying specifications.
      </p>

      <h2 id="installation">Installation</h2>
      <CodeBlock code="npm install -g @isl/cli" language="bash" />

      <p>Verify installation:</p>
      <CodeBlock
        code={`$ isl --version
ISL CLI v1.0.0`}
        language="bash"
      />

      <CommandReference
        command="isl check"
        description="Validate ISL specification files"
        usage="isl check <files...> [options]"
        flags={[
          {
            name: "strict",
            alias: "s",
            type: "boolean",
            description: "Enable strict mode (warnings become errors)",
            default: "false",
          },
          {
            name: "format",
            alias: "f",
            type: "string",
            description: "Output format: text, json, or sarif",
            default: "text",
          },
          {
            name: "quiet",
            alias: "q",
            type: "boolean",
            description: "Only output errors, no success messages",
            default: "false",
          },
        ]}
        examples={[
          {
            description: "Check a single file",
            code: "isl check auth.isl",
          },
          {
            description: "Check multiple files with strict mode",
            code: "isl check src/**/*.isl --strict",
          },
          {
            description: "Output in JSON format for CI",
            code: "isl check . --format json",
          },
        ]}
      />

      <CommandReference
        command="isl generate"
        description="Generate code from ISL specifications"
        usage="isl generate <target> <files...> [options]"
        flags={[
          {
            name: "output",
            alias: "o",
            type: "string",
            description: "Output directory",
            default: "./generated",
          },
          {
            name: "watch",
            alias: "w",
            type: "boolean",
            description: "Watch for changes and regenerate",
            default: "false",
          },
          {
            name: "clean",
            type: "boolean",
            description: "Clean output directory before generating",
            default: "false",
          },
        ]}
        examples={[
          {
            description: "Generate TypeScript types",
            code: "isl generate typescript auth.isl -o ./src/types",
          },
          {
            description: "Generate Rust types",
            code: "isl generate rust auth.isl -o ./src/generated",
          },
          {
            description: "Generate with watch mode",
            code: "isl generate typescript src/**/*.isl -o ./types --watch",
          },
        ]}
      />

      <CommandReference
        command="isl verify"
        description="Run verification tests against implementations"
        usage="isl verify <spec> --impl <implementation> [options]"
        flags={[
          {
            name: "impl",
            alias: "i",
            type: "string",
            description: "Path to implementation file",
            required: true,
          },
          {
            name: "coverage",
            type: "boolean",
            description: "Generate coverage report",
            default: "false",
          },
          {
            name: "timeout",
            alias: "t",
            type: "number",
            description: "Test timeout in milliseconds",
            default: "5000",
          },
          {
            name: "verbose",
            alias: "v",
            type: "boolean",
            description: "Show detailed output",
            default: "false",
          },
        ]}
        examples={[
          {
            description: "Verify implementation matches spec",
            code: "isl verify auth.isl --impl ./src/auth.ts",
          },
          {
            description: "Run with coverage report",
            code: "isl verify auth.isl -i ./src/auth.ts --coverage",
          },
        ]}
      />

      <CommandReference
        command="isl init"
        description="Initialize a new ISL project"
        usage="isl init [directory] [options]"
        flags={[
          {
            name: "template",
            alias: "t",
            type: "string",
            description: "Project template: minimal, full, monorepo",
            default: "minimal",
          },
          {
            name: "force",
            alias: "f",
            type: "boolean",
            description: "Overwrite existing files",
            default: "false",
          },
        ]}
        examples={[
          {
            description: "Initialize in current directory",
            code: "isl init",
          },
          {
            description: "Initialize with full template",
            code: "isl init my-project --template full",
          },
        ]}
      />

      <h2 id="configuration">Configuration</h2>
      <p>
        Create an <code>isl.config.json</code> file to configure default options:
      </p>

      <CodeBlock
        code={`{
  "include": ["src/**/*.isl"],
  "exclude": ["**/node_modules/**"],
  "strict": true,
  "generate": {
    "typescript": {
      "output": "./src/generated",
      "options": {
        "runtime": "zod",
        "formatting": "prettier"
      }
    }
  }
}`}
        language="json"
        filename="isl.config.json"
      />

      <Callout type="tip">
        The CLI automatically looks for <code>isl.config.json</code> in the current
        directory and parent directories.
      </Callout>

      <h2 id="exit-codes">Exit Codes</h2>
      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Code</th>
              <th className="text-left py-2 px-3">Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>0</code></td>
              <td className="py-2 px-3">Success</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>1</code></td>
              <td className="py-2 px-3">Validation errors found</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>2</code></td>
              <td className="py-2 px-3">Configuration error</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>3</code></td>
              <td className="py-2 px-3">File not found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
