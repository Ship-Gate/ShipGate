import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/docs/callout";

export const metadata = {
  title: "MCP Server",
  description: "Model Context Protocol server for AI assistant integration.",
};

export default function MCPPage() {
  return (
    <div>
      <h1>MCP Server</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        Integrate ISL with AI assistants using the Model Context Protocol.
      </p>

      <h2 id="overview">Overview</h2>
      <p>
        The ISL MCP server allows AI assistants like Cursor and Claude to understand
        and work with ISL specifications. This enables AI to:
      </p>
      <ul>
        <li>Validate ISL specifications in real-time</li>
        <li>Generate code that matches your specs</li>
        <li>Suggest fixes for specification errors</li>
        <li>Create new specifications from requirements</li>
      </ul>

      <h2 id="installation">Installation</h2>
      <CodeBlock code="npm install -g @isl/mcp-server" language="bash" />

      <h2 id="cursor-setup">Cursor Setup</h2>
      <p>
        Add the ISL MCP server to your Cursor configuration:
      </p>

      <CodeBlock
        code={`{
  "mcpServers": {
    "isl": {
      "command": "isl-mcp-server",
      "args": ["--workspace", "."],
      "env": {}
    }
  }
}`}
        language="json"
        filename=".cursor/mcp.json"
      />

      <p>Or in your global Cursor settings:</p>
      <CodeBlock
        code={`{
  "mcp.servers": {
    "isl": {
      "command": "isl-mcp-server"
    }
  }
}`}
        language="json"
      />

      <h2 id="available-tools">Available Tools</h2>
      <p>The MCP server provides these tools to AI assistants:</p>

      <h3>isl_check</h3>
      <p>Validate ISL specification content.</p>
      <CodeBlock
        code={`{
  "name": "isl_check",
  "arguments": {
    "content": "intent CreateUser { ... }"
  }
}`}
        language="json"
      />

      <h3>isl_generate</h3>
      <p>Generate code from ISL specifications.</p>
      <CodeBlock
        code={`{
  "name": "isl_generate",
  "arguments": {
    "spec": "intent CreateUser { ... }",
    "target": "typescript"
  }
}`}
        language="json"
      />

      <h3>isl_suggest</h3>
      <p>Get suggestions for fixing specification errors.</p>
      <CodeBlock
        code={`{
  "name": "isl_suggest",
  "arguments": {
    "content": "intent CreateUser { ... }",
    "error": "Unknown type 'Emal'"
  }
}`}
        language="json"
      />

      <h2 id="resources">Available Resources</h2>
      <p>The MCP server exposes these resources:</p>

      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Resource</th>
              <th className="text-left py-2 px-3">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>isl://specs</code></td>
              <td className="py-2 px-3">List of all ISL files in workspace</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>isl://types</code></td>
              <td className="py-2 px-3">All defined types</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>isl://intents</code></td>
              <td className="py-2 px-3">All defined intents</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>isl://builtins</code></td>
              <td className="py-2 px-3">Built-in types and functions</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="prompts">Available Prompts</h2>
      <p>Pre-defined prompts for common tasks:</p>

      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Prompt</th>
              <th className="text-left py-2 px-3">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>create_spec</code></td>
              <td className="py-2 px-3">Create a new specification from requirements</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>improve_spec</code></td>
              <td className="py-2 px-3">Suggest improvements to existing spec</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>add_scenarios</code></td>
              <td className="py-2 px-3">Generate test scenarios for an intent</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>add_chaos</code></td>
              <td className="py-2 px-3">Add chaos testing to an intent</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Callout type="tip" title="Best Practice">
        Include your ISL specifications in your AI assistant&apos;s context when asking
        for code changes. This helps ensure generated code matches your specifications.
      </Callout>

      <h2 id="example-workflow">Example Workflow</h2>
      <p>Here&apos;s how to use ISL with an AI assistant:</p>

      <ol>
        <li>Write your specification in ISL</li>
        <li>Ask the AI to generate implementation code</li>
        <li>The AI uses the MCP server to validate the spec</li>
        <li>Generated code follows the specification&apos;s contracts</li>
        <li>Run <code>isl verify</code> to confirm compliance</li>
      </ol>
    </div>
  );
}
