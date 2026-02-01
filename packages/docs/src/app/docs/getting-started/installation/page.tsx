import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/docs/callout";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Installation",
  description: "Install the ISL CLI and set up your development environment.",
};

export default function InstallationPage() {
  return (
    <div>
      <h1>Installation</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        Get ISL installed and configured in minutes.
      </p>

      <h2 id="cli-installation">CLI Installation</h2>
      <p>Install the ISL CLI globally using npm:</p>

      <CodeBlock code="npm install -g @isl/cli" language="bash" />

      <p>Or using pnpm:</p>
      <CodeBlock code="pnpm add -g @isl/cli" language="bash" />

      <p>Or using yarn:</p>
      <CodeBlock code="yarn global add @isl/cli" language="bash" />

      <h3>Verify Installation</h3>
      <CodeBlock
        code={`$ isl --version
ISL CLI v1.0.0

$ isl --help
Usage: isl [command] [options]

Commands:
  check     Validate ISL specification files
  generate  Generate code from specifications
  verify    Run verification tests
  init      Initialize a new ISL project
  repl      Start interactive REPL

Options:
  --version  Show version number
  --help     Show help`}
        language="bash"
      />

      <h2 id="project-setup">Project Setup</h2>
      <p>Initialize ISL in your project:</p>

      <CodeBlock code="isl init" language="bash" />

      <p>This creates:</p>
      <ul>
        <li><code>isl.config.json</code> - Configuration file</li>
        <li><code>specs/</code> - Directory for your ISL files</li>
        <li><code>specs/example.isl</code> - Example specification</li>
      </ul>

      <h2 id="vs-code-extension">VS Code Extension</h2>
      <p>Install the VS Code extension for the best development experience:</p>

      <ol>
        <li>Open VS Code</li>
        <li>Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)</li>
        <li>Search for &quot;ISL - Intent Specification Language&quot;</li>
        <li>Click Install</li>
      </ol>

      <p>Or install from command line:</p>
      <CodeBlock code="code --install-extension intentos.isl-vscode" language="bash" />

      <Callout type="tip">
        The VS Code extension provides syntax highlighting, real-time validation,
        and IntelliSense. It&apos;s highly recommended for writing ISL specs.
      </Callout>

      <h2 id="configuration">Configuration</h2>
      <p>
        The <code>isl.config.json</code> file controls CLI behavior:
      </p>

      <CodeBlock
        code={`{
  "include": ["specs/**/*.isl"],
  "exclude": ["**/node_modules/**"],
  "strict": false,
  "generate": {
    "typescript": {
      "output": "./src/generated",
      "options": {
        "runtime": "zod"
      }
    }
  }
}`}
        language="json"
        filename="isl.config.json"
      />

      <h2 id="requirements">System Requirements</h2>
      <ul>
        <li>Node.js 18 or later</li>
        <li>npm, pnpm, or yarn</li>
      </ul>

      <h2 id="next-steps">Next Steps</h2>
      <div className="not-prose grid gap-3 mt-6">
        <Link
          href="/docs/getting-started/quick-start"
          className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
        >
          <div>
            <div className="font-semibold group-hover:text-primary transition-colors">
              Quick Start
            </div>
            <div className="text-sm text-muted-foreground">
              Write your first ISL specification
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </Link>
        <Link
          href="/docs/tools/vscode"
          className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
        >
          <div>
            <div className="font-semibold group-hover:text-primary transition-colors">
              VS Code Setup
            </div>
            <div className="text-sm text-muted-foreground">
              Configure the editor extension
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </Link>
      </div>
    </div>
  );
}
