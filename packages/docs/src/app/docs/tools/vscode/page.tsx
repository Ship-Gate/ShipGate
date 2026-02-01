import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/docs/callout";

export const metadata = {
  title: "VS Code Extension",
  description: "Full editor support for ISL in VS Code.",
};

export default function VSCodePage() {
  return (
    <div>
      <h1>VS Code Extension</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        Full editor support with syntax highlighting, diagnostics, and IntelliSense.
      </p>

      <h2 id="installation">Installation</h2>
      <p>Install from the VS Code Marketplace:</p>
      <ol>
        <li>Open VS Code</li>
        <li>Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)</li>
        <li>Search for &quot;ISL - Intent Specification Language&quot;</li>
        <li>Click Install</li>
      </ol>

      <p>Or install from the command line:</p>
      <CodeBlock code="code --install-extension intentos.isl-vscode" language="bash" />

      <h2 id="features">Features</h2>

      <h3>Syntax Highlighting</h3>
      <p>
        Full syntax highlighting for all ISL constructs:
      </p>
      <ul>
        <li>Keywords, types, and modifiers</li>
        <li>Strings, numbers, and comments</li>
        <li>Semantic highlighting for intents and types</li>
      </ul>

      <h3>Real-time Diagnostics</h3>
      <p>
        Errors and warnings are shown as you type:
      </p>
      <ul>
        <li>Parse errors with precise locations</li>
        <li>Type errors and undefined references</li>
        <li>Warnings for unused definitions</li>
        <li>Quick fixes for common issues</li>
      </ul>

      <h3>IntelliSense</h3>
      <ul>
        <li>Auto-completion for keywords and types</li>
        <li>Completion for defined intents and types</li>
        <li>Parameter hints for built-in functions</li>
        <li>Snippet suggestions</li>
      </ul>

      <h3>Navigation</h3>
      <ul>
        <li>Go to Definition (F12)</li>
        <li>Find All References (Shift+F12)</li>
        <li>Document Outline</li>
        <li>Breadcrumbs</li>
      </ul>

      <h3>Hover Information</h3>
      <p>Hover over identifiers to see:</p>
      <ul>
        <li>Type definitions</li>
        <li>Intent signatures</li>
        <li>Documentation comments</li>
      </ul>

      <h2 id="configuration">Configuration</h2>
      <p>Configure the extension in VS Code settings:</p>

      <CodeBlock
        code={`{
  // ISL extension settings
  "isl.validation.enabled": true,
  "isl.validation.onSave": true,
  "isl.validation.onType": true,
  "isl.format.onSave": true,
  "isl.diagnostics.severity": {
    "unusedDefinition": "warning",
    "deprecatedFeature": "information"
  }
}`}
        language="json"
        filename="settings.json"
      />

      <h3>Available Settings</h3>
      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Setting</th>
              <th className="text-left py-2 px-3">Default</th>
              <th className="text-left py-2 px-3">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>isl.validation.enabled</code></td>
              <td className="py-2 px-3">true</td>
              <td className="py-2 px-3">Enable/disable validation</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>isl.format.onSave</code></td>
              <td className="py-2 px-3">true</td>
              <td className="py-2 px-3">Format on save</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>isl.trace.server</code></td>
              <td className="py-2 px-3">off</td>
              <td className="py-2 px-3">Trace LSP communication</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="snippets">Snippets</h2>
      <p>Type these prefixes and press Tab:</p>

      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Prefix</th>
              <th className="text-left py-2 px-3">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>intent</code></td>
              <td className="py-2 px-3">New intent with pre/post</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>scenario</code></td>
              <td className="py-2 px-3">New scenario block</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>type</code></td>
              <td className="py-2 px-3">New type definition</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>invariant</code></td>
              <td className="py-2 px-3">New invariant</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>chaos</code></td>
              <td className="py-2 px-3">New chaos block</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Callout type="tip">
        Use <kbd>Ctrl+Space</kbd> / <kbd>Cmd+Space</kbd> to trigger IntelliSense
        manually at any position.
      </Callout>
    </div>
  );
}
