import { CodeBlock } from "@/components/CodeBlock";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Installation - ISL Documentation",
  description: "Install the ISL CLI and VS Code extension.",
};

export default function InstallationPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>Installation</h1>

        <p className="lead text-xl text-muted-foreground">
          Get ISL up and running in your development environment.
        </p>

        <h2>Prerequisites</h2>

        <ul>
          <li>Node.js 18.0 or later</li>
          <li>npm, yarn, or pnpm</li>
        </ul>

        <h2>Install the CLI</h2>

        <p>Install the ISL CLI globally using your preferred package manager:</p>

        <div className="not-prose space-y-3 my-6">
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">npm</div>
            <CodeBlock code="npm install -g @intentos/cli" language="bash" />
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">yarn</div>
            <CodeBlock code="yarn global add @intentos/cli" language="bash" />
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">pnpm</div>
            <CodeBlock code="pnpm add -g @intentos/cli" language="bash" />
          </div>
        </div>

        <p>Verify the installation:</p>

        <CodeBlock
          code={`$ isl --version
@intentos/cli v1.0.0`}
          language="bash"
        />

        <h2>VS Code Extension</h2>

        <p>
          For the best development experience, install the ISL VS Code extension 
          which provides:
        </p>

        <ul>
          <li>Syntax highlighting for <code>.isl</code> files</li>
          <li>IntelliSense and autocompletion</li>
          <li>Real-time error checking</li>
          <li>Go to definition</li>
          <li>Hover documentation</li>
        </ul>

        <p>Install from the VS Code marketplace:</p>

        <CodeBlock
          code="code --install-extension intentos.isl-vscode"
          language="bash"
        />

        <p>
          Or search for &quot;ISL&quot; in the VS Code Extensions panel.
        </p>

        <h2>Project Setup</h2>

        <p>
          Initialize ISL in your project to create a configuration file:
        </p>

        <CodeBlock
          code={`$ cd your-project
$ isl init

Created isl.config.json
Created specs/ directory`}
          language="bash"
        />

        <p>This creates a default configuration:</p>

        <CodeBlock
          code={`{
  "specsDir": "./specs",
  "outDir": "./src/generated",
  "generators": {
    "types": true,
    "tests": true,
    "docs": false
  },
  "strict": true
}`}
          language="json"
          filename="isl.config.json"
        />

        <h2>Configuration Options</h2>

        <table className="my-6">
          <thead>
            <tr>
              <th>Option</th>
              <th>Default</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>specsDir</code></td>
              <td><code>./specs</code></td>
              <td>Directory containing ISL specification files</td>
            </tr>
            <tr>
              <td><code>outDir</code></td>
              <td><code>./src/generated</code></td>
              <td>Output directory for generated code</td>
            </tr>
            <tr>
              <td><code>generators.types</code></td>
              <td><code>true</code></td>
              <td>Generate TypeScript types</td>
            </tr>
            <tr>
              <td><code>generators.tests</code></td>
              <td><code>true</code></td>
              <td>Generate verification tests</td>
            </tr>
            <tr>
              <td><code>generators.docs</code></td>
              <td><code>false</code></td>
              <td>Generate documentation</td>
            </tr>
            <tr>
              <td><code>strict</code></td>
              <td><code>true</code></td>
              <td>Enable strict mode for type checking</td>
            </tr>
          </tbody>
        </table>

        <h2>Next Steps</h2>

        <div className="not-prose">
          <Link
            href="/docs/getting-started/first-spec"
            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <div>
              <div className="font-semibold group-hover:text-primary transition-colors">
                Your First Spec
              </div>
              <div className="text-sm text-muted-foreground">
                Write and validate your first ISL specification
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}
