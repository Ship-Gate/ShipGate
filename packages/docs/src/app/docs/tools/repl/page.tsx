import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/docs/callout";

export const metadata = {
  title: "REPL",
  description: "Interactive ISL REPL for experimenting with specifications.",
};

export default function REPLPage() {
  return (
    <div>
      <h1>REPL</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        Interactive Read-Eval-Print Loop for experimenting with ISL.
      </p>

      <h2 id="starting">Starting the REPL</h2>
      <CodeBlock code="isl repl" language="bash" />

      <p>You&apos;ll see the ISL prompt:</p>
      <CodeBlock
        code={`ISL REPL v1.0.0
Type .help for available commands
> _`}
        language="bash"
      />

      <h2 id="basic-usage">Basic Usage</h2>
      <p>Enter ISL expressions and definitions directly:</p>

      <CodeBlock
        code={`> type Email = String where matches(/^[^@]+@[^@]+$/)
Defined type: Email

> intent ValidateEmail {
...   pre { input.length > 0 }
...   post { result.valid == isValidEmail(input) }
... }
Defined intent: ValidateEmail

> check "test@example.com" against Email
✓ Valid Email`}
        language="bash"
      />

      <h2 id="commands">REPL Commands</h2>
      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Command</th>
              <th className="text-left py-2 px-3">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>.help</code></td>
              <td className="py-2 px-3">Show available commands</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>.clear</code></td>
              <td className="py-2 px-3">Clear all definitions</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>.load &lt;file&gt;</code></td>
              <td className="py-2 px-3">Load an ISL file</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>.save &lt;file&gt;</code></td>
              <td className="py-2 px-3">Save current session to file</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>.list</code></td>
              <td className="py-2 px-3">List all defined types and intents</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>.type &lt;name&gt;</code></td>
              <td className="py-2 px-3">Show type definition</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>.exit</code></td>
              <td className="py-2 px-3">Exit the REPL</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="multi-line">Multi-line Input</h2>
      <p>
        The REPL automatically detects multi-line input when you open a block:
      </p>

      <CodeBlock
        code={`> intent CreateUser {
...   pre {
...     email != ""
...     !user.exists(email)
...   }
...   post {
...     result.id != null
...   }
... }
Defined intent: CreateUser`}
        language="bash"
      />

      <Callout type="tip">
        Press <kbd>Ctrl+C</kbd> to cancel multi-line input and return to the prompt.
      </Callout>

      <h2 id="validation">Live Validation</h2>
      <p>Test values against types in real-time:</p>

      <CodeBlock
        code={`> check "invalid-email" against Email
✗ Invalid: does not match email pattern

> check "user@example.com" against Email  
✓ Valid Email

> check 150 against type Age = Int where value >= 0 && value <= 120
✗ Invalid: value must be <= 120`}
        language="bash"
      />

      <h2 id="history">Command History</h2>
      <p>
        Use <kbd>↑</kbd> and <kbd>↓</kbd> arrows to navigate command history.
        History is persisted between sessions in <code>~/.isl_history</code>.
      </p>

      <h2 id="tab-completion">Tab Completion</h2>
      <p>
        Press <kbd>Tab</kbd> for auto-completion of:
      </p>
      <ul>
        <li>Keywords (<code>intent</code>, <code>pre</code>, <code>post</code>, etc.)</li>
        <li>Built-in types (<code>String</code>, <code>Number</code>, etc.)</li>
        <li>Defined types and intents</li>
        <li>REPL commands</li>
      </ul>
    </div>
  );
}
