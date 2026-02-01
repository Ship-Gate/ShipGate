import { CodeBlock } from "@/components/CodeBlock";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Verification - ISL Documentation",
  description: "Runtime verification, chaos testing, and temporal properties.",
};

export default function VerificationPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>Verification</h1>

        <p className="lead text-xl text-muted-foreground">
          ISL provides comprehensive verification tools to ensure your 
          implementation matches your specifications.
        </p>

        <h2>Verification Methods</h2>

        <div className="not-prose grid md:grid-cols-3 gap-4 my-8">
          <Link
            href="/docs/verification/runtime"
            className="p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
              Runtime
            </h3>
            <p className="text-sm text-muted-foreground">
              Verify preconditions, postconditions, and invariants
            </p>
          </Link>
          <Link
            href="/docs/verification/chaos"
            className="p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
              Chaos
            </h3>
            <p className="text-sm text-muted-foreground">
              Test behavior under failure conditions
            </p>
          </Link>
          <Link
            href="/docs/verification/temporal"
            className="p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
              Temporal
            </h3>
            <p className="text-sm text-muted-foreground">
              Verify timing and performance requirements
            </p>
          </Link>
        </div>

        <h2>Quick Start</h2>

        <p>
          Run verification tests with the <code>isl verify</code> command:
        </p>

        <CodeBlock
          code={`$ isl verify specs/auth.isl

Running verification for auth.isl...

Runtime Verification:
  ✓ Login: 12 postconditions verified
  ✓ Register: 8 postconditions verified
  ✓ Logout: 4 postconditions verified
  ✓ User entity: 5 invariants verified

Temporal Verification:
  ✓ Login: p50 < 100ms (actual: 45ms)
  ✓ Login: p99 < 500ms (actual: 312ms)
  ⚠ Register: p99 < 1s (actual: 1.2s)

Trust Score: 94.2%

Summary:
  24 postconditions passed
  5 invariants verified
  2/3 temporal requirements met
  1 warning`}
          language="bash"
        />

        <h2>Trust Score</h2>

        <p>
          The Trust Score is a composite metric showing how well your 
          implementation matches the specification:
        </p>

        <CodeBlock
          code={`Trust Score Breakdown:
  Postconditions:  96% (24/25 verified)
  Invariants:     100% (5/5 holding)
  Temporal:        67% (2/3 met)
  Coverage:        85% (17/20 paths tested)
  
  Overall: 94.2%`}
          language="text"
        />

        <h3>Score Components</h3>

        <table className="my-6">
          <thead>
            <tr>
              <th>Component</th>
              <th>Weight</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Postconditions</td>
              <td>40%</td>
              <td>Percentage of postconditions that hold</td>
            </tr>
            <tr>
              <td>Invariants</td>
              <td>30%</td>
              <td>Percentage of invariants that always hold</td>
            </tr>
            <tr>
              <td>Temporal</td>
              <td>15%</td>
              <td>Percentage of timing requirements met</td>
            </tr>
            <tr>
              <td>Coverage</td>
              <td>15%</td>
              <td>Percentage of code paths tested</td>
            </tr>
          </tbody>
        </table>

        <h2>Continuous Verification</h2>

        <p>
          Run verification in CI/CD pipelines:
        </p>

        <CodeBlock
          code={`# .github/workflows/verify.yml
name: ISL Verification

on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run ISL verification
        run: |
          npx isl verify specs/ \\
            --min-trust-score 90 \\
            --fail-on-warning
            
      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: verification-report
          path: .isl/reports/`}
          language="yaml"
        />

        <h2>Configuration</h2>

        <p>
          Configure verification in <code>isl.config.json</code>:
        </p>

        <CodeBlock
          code={`{
  "verification": {
    "runtime": {
      "enabled": true,
      "sampleSize": 1000,
      "timeout": "30s"
    },
    "chaos": {
      "enabled": true,
      "scenarios": ["network_failure", "timeout", "data_corruption"]
    },
    "temporal": {
      "enabled": true,
      "percentiles": [50, 95, 99]
    },
    "reporting": {
      "format": "html",
      "outputDir": ".isl/reports"
    },
    "thresholds": {
      "minTrustScore": 90,
      "maxFailures": 0
    }
  }
}`}
          language="json"
        />

        <h2>Next Steps</h2>

        <div className="not-prose">
          <Link
            href="/docs/verification/runtime"
            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <div>
              <div className="font-semibold group-hover:text-primary transition-colors">
                Runtime Verification
              </div>
              <div className="text-sm text-muted-foreground">
                Deep dive into runtime verification
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}
