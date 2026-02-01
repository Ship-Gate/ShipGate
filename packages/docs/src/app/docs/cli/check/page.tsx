import { CodeBlock } from "@/components/CodeBlock";

export const metadata = {
  title: "isl check - ISL Documentation",
  description: "Validate ISL specification files.",
};

export default function CheckPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>isl check</h1>

        <p className="lead text-xl text-muted-foreground">
          Validate ISL specification files for syntax and semantic errors.
        </p>

        <h2>Usage</h2>

        <CodeBlock
          code={`isl check [files...] [options]`}
          language="bash"
        />

        <h2>Arguments</h2>

        <table className="my-6">
          <thead>
            <tr>
              <th>Argument</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>files</code></td>
              <td>ISL files or directories to check (default: specsDir from config)</td>
            </tr>
          </tbody>
        </table>

        <h2>Options</h2>

        <table className="my-6">
          <thead>
            <tr>
              <th>Option</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>--strict</code></td>
              <td>Enable strict mode (treat warnings as errors)</td>
            </tr>
            <tr>
              <td><code>--format</code></td>
              <td>Output format: <code>pretty</code>, <code>json</code>, <code>compact</code></td>
            </tr>
            <tr>
              <td><code>--fix</code></td>
              <td>Automatically fix fixable issues</td>
            </tr>
            <tr>
              <td><code>--stats</code></td>
              <td>Show statistics about the specifications</td>
            </tr>
          </tbody>
        </table>

        <h2>Examples</h2>

        <h3>Check a single file</h3>

        <CodeBlock
          code={`$ isl check specs/auth.isl

Checking specs/auth.isl...

✓ Syntax valid
✓ Types resolved
✓ Invariants consistent
✓ Lifecycles valid
✓ Behaviors complete

All checks passed!`}
          language="bash"
        />

        <h3>Check all specs with statistics</h3>

        <CodeBlock
          code={`$ isl check specs/ --stats

Checking 5 files in specs/...

specs/auth.isl ✓
specs/payments.isl ✓
specs/orders.isl ✓
specs/inventory.isl ✓
specs/notifications.isl ✓

Statistics:
  Domains: 5
  Types: 23
  Enums: 8
  Entities: 15
  Behaviors: 42
  Scenarios: 67
  
  Lines of spec: 2,847
  Estimated coverage: 94%

All checks passed!`}
          language="bash"
        />

        <h3>Check with errors</h3>

        <CodeBlock
          code={`$ isl check specs/broken.isl

Checking specs/broken.isl...

✗ Type error at line 15:
  Unknown type 'UserID'. Did you mean 'UserId'?
  
    14 |   entity Order {
  > 15 |     user_id: UserID
       |              ^^^^^^
    16 |   }

✗ Invariant error at line 28:
  Invariant references undefined field 'total'
  
    27 |   invariants {
  > 28 |     total >= 0
       |     ^^^^^
    29 |   }

2 errors found`}
          language="bash"
        />

        <h3>JSON output for CI</h3>

        <CodeBlock
          code={`$ isl check specs/ --format json

{
  "success": false,
  "files": [
    {
      "path": "specs/auth.isl",
      "valid": true,
      "errors": [],
      "warnings": []
    },
    {
      "path": "specs/broken.isl",
      "valid": false,
      "errors": [
        {
          "line": 15,
          "column": 14,
          "message": "Unknown type 'UserID'. Did you mean 'UserId'?",
          "severity": "error",
          "code": "E001"
        }
      ],
      "warnings": []
    }
  ],
  "summary": {
    "total": 2,
    "passed": 1,
    "failed": 1
  }
}`}
          language="json"
        />

        <h2>Validation Phases</h2>

        <p>The <code>check</code> command runs these validation phases:</p>

        <ol>
          <li><strong>Syntax</strong> - Parse the ISL file and check for syntax errors</li>
          <li><strong>Types</strong> - Resolve type references and check type compatibility</li>
          <li><strong>Invariants</strong> - Verify invariant expressions are valid</li>
          <li><strong>Lifecycles</strong> - Check state machine validity</li>
          <li><strong>Behaviors</strong> - Validate behavior contracts</li>
          <li><strong>Scenarios</strong> - Check scenario definitions</li>
        </ol>

        <h2>Auto-fix</h2>

        <p>Some issues can be automatically fixed:</p>

        <CodeBlock
          code={`$ isl check specs/ --fix

Checking specs/...

Fixed 3 issues:
  - specs/auth.isl:15 - Added missing semicolon
  - specs/auth.isl:28 - Fixed indentation
  - specs/orders.isl:45 - Sorted imports

All checks passed after fixes!`}
          language="bash"
        />
      </div>
    </div>
  );
}
