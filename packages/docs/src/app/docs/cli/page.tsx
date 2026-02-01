import { CodeBlock } from "@/components/CodeBlock";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "CLI Reference - ISL Documentation",
  description: "Complete reference for the ISL command-line interface.",
};

export default function CLIPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>CLI Reference</h1>

        <p className="lead text-xl text-muted-foreground">
          The ISL CLI provides commands for checking, generating, and verifying 
          your specifications.
        </p>

        <h2>Installation</h2>

        <CodeBlock
          code={`npm install -g @intentos/cli

# Verify installation
isl --version`}
          language="bash"
        />

        <h2>Commands Overview</h2>

        <table className="my-6">
          <thead>
            <tr>
              <th>Command</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>isl init</code></td>
              <td>Initialize ISL in a project</td>
            </tr>
            <tr>
              <td><code>isl check</code></td>
              <td>Validate specification files</td>
            </tr>
            <tr>
              <td><code>isl generate</code></td>
              <td>Generate code from specifications</td>
            </tr>
            <tr>
              <td><code>isl verify</code></td>
              <td>Run verification tests</td>
            </tr>
            <tr>
              <td><code>isl watch</code></td>
              <td>Watch for changes and regenerate</td>
            </tr>
            <tr>
              <td><code>isl lint</code></td>
              <td>Lint specifications for best practices</td>
            </tr>
          </tbody>
        </table>

        <h2>Global Options</h2>

        <CodeBlock
          code={`--config, -c    Path to config file (default: isl.config.json)
--verbose, -v   Enable verbose output
--quiet, -q     Suppress non-error output
--help, -h      Show help
--version       Show version`}
          language="text"
        />

        <h2>Command Details</h2>

        <div className="not-prose grid gap-4 my-8">
          <Link
            href="/docs/cli/check"
            className="p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold group-hover:text-primary transition-colors">
                  isl check
                </h3>
                <p className="text-sm text-muted-foreground">
                  Validate ISL specification files for syntax and semantic errors
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Link>
          <Link
            href="/docs/cli/generate"
            className="p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold group-hover:text-primary transition-colors">
                  isl generate
                </h3>
                <p className="text-sm text-muted-foreground">
                  Generate TypeScript types, tests, and documentation
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Link>
          <Link
            href="/docs/cli/verify"
            className="p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold group-hover:text-primary transition-colors">
                  isl verify
                </h3>
                <p className="text-sm text-muted-foreground">
                  Run verification tests including runtime, chaos, and temporal
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Link>
        </div>

        <h2>Configuration File</h2>

        <p>
          The CLI reads from <code>isl.config.json</code> in the project root:
        </p>

        <CodeBlock
          code={`{
  "specsDir": "./specs",
  "outDir": "./src/generated",
  "generators": {
    "types": true,
    "tests": true,
    "docs": false
  },
  "verification": {
    "runtime": true,
    "chaos": false,
    "temporal": true
  },
  "strict": true
}`}
          language="json"
          filename="isl.config.json"
        />

        <h2>Exit Codes</h2>

        <table className="my-6">
          <thead>
            <tr>
              <th>Code</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>0</code></td>
              <td>Success</td>
            </tr>
            <tr>
              <td><code>1</code></td>
              <td>General error</td>
            </tr>
            <tr>
              <td><code>2</code></td>
              <td>Syntax error in specification</td>
            </tr>
            <tr>
              <td><code>3</code></td>
              <td>Type checking error</td>
            </tr>
            <tr>
              <td><code>4</code></td>
              <td>Verification failure</td>
            </tr>
            <tr>
              <td><code>5</code></td>
              <td>Configuration error</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
