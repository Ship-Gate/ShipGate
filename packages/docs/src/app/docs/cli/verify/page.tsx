import { CodeBlock } from "@/components/CodeBlock";

export const metadata = {
  title: "isl verify - ISL Documentation",
  description: "Run verification tests against ISL specifications.",
};

export default function VerifyPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>isl verify</h1>

        <p className="lead text-xl text-muted-foreground">
          Run verification tests to ensure your implementation matches the 
          specifications.
        </p>

        <h2>Usage</h2>

        <CodeBlock
          code={`isl verify [files...] [options]`}
          language="bash"
        />

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
              <td><code>--runtime</code></td>
              <td>Run runtime verification (preconditions, postconditions)</td>
            </tr>
            <tr>
              <td><code>--chaos</code></td>
              <td>Run chaos testing scenarios</td>
            </tr>
            <tr>
              <td><code>--temporal</code></td>
              <td>Run temporal property verification</td>
            </tr>
            <tr>
              <td><code>--all</code></td>
              <td>Run all verification types</td>
            </tr>
            <tr>
              <td><code>--samples</code></td>
              <td>Number of test samples (default: 1000)</td>
            </tr>
            <tr>
              <td><code>--timeout</code></td>
              <td>Test timeout (default: 30s)</td>
            </tr>
            <tr>
              <td><code>--min-trust-score</code></td>
              <td>Minimum required trust score (0-100)</td>
            </tr>
            <tr>
              <td><code>--report</code></td>
              <td>Generate report: <code>text</code>, <code>json</code>, <code>html</code></td>
            </tr>
          </tbody>
        </table>

        <h2>Basic Verification</h2>

        <CodeBlock
          code={`$ isl verify specs/

Running verification...

Runtime Verification:
  ✓ auth.isl: 24/24 postconditions
  ✓ payments.isl: 18/18 postconditions
  ✓ orders.isl: 32/32 postconditions

Invariant Verification:
  ✓ User: 5/5 invariants
  ✓ Payment: 4/4 invariants
  ✓ Order: 8/8 invariants

Trust Score: 96.4%

All verifications passed!`}
          language="bash"
        />

        <h2>Runtime Verification</h2>

        <CodeBlock
          code={`$ isl verify specs/auth.isl --runtime --samples 5000

Runtime Verification (5000 samples)
===================================

Behavior: Login
  Preconditions:
    ✓ email.is_valid_format (5000/5000)
    ✓ password.length >= 8 (5000/5000)
  Postconditions:
    ✓ success implies Session.exists (4234/4234)
    ✓ success implies User.last_login updated (4234/4234)
    ✓ failure implies no Session created (766/766)

Behavior: Register
  Preconditions:
    ✓ not User.exists_by_email (5000/5000)
  Postconditions:
    ✓ success implies User.exists (4891/4891)
    ✗ success implies email_sent (4756/4891)
    
1 failure found:
  Register postcondition "email_sent" failed in 135 cases
  Sample failure: User created but email service timed out`}
          language="bash"
        />

        <h2>Chaos Testing</h2>

        <CodeBlock
          code={`$ isl verify specs/payments.isl --chaos

Chaos Testing
=============

Scenario: Network Failure (10% injection rate)
  ✓ ProcessPayment handles timeout correctly
  ✓ No duplicate charges on retry
  ✓ Transactions properly rolled back

Scenario: Database Unavailable
  ✓ Graceful error handling
  ⚠ Slow recovery after reconnect (15s vs 5s expected)

Scenario: Payment Processor Down
  ✓ Circuit breaker activates
  ✓ Fallback to queued processing
  ✓ Customer notified of delay

Chaos Score: 92%`}
          language="bash"
        />

        <h2>Temporal Verification</h2>

        <CodeBlock
          code={`$ isl verify specs/ --temporal

Temporal Verification
=====================

ProcessPayment:
  p50:  67ms  ✓ (target: 100ms)
  p95: 234ms  ✓ (target: 500ms)
  p99: 567ms  ✓ (target: 2s)
  
  Eventually properties:
    ✓ audit log within 5s (avg: 1.2s)
    ✓ receipt email within 30s (avg: 8s)

GetUserProfile:
  p50:  12ms  ✓ (target: 50ms)
  p95:  45ms  ✓ (target: 100ms)
  p99: 189ms  ⚠ (target: 150ms)

1 warning: GetUserProfile p99 exceeded target`}
          language="bash"
        />

        <h2>Full Verification</h2>

        <CodeBlock
          code={`$ isl verify specs/ --all --report html

Running full verification suite...

Phase 1: Runtime Verification
  ✓ 156 postconditions verified
  ✓ 47 invariants verified

Phase 2: Chaos Testing
  ✓ 24 chaos scenarios passed
  ⚠ 2 warnings

Phase 3: Temporal Verification
  ✓ 18 timing requirements met
  ⚠ 1 warning

Trust Score: 94.2%

Report generated: .isl/reports/verification.html`}
          language="bash"
        />

        <h2>CI Integration</h2>

        <CodeBlock
          code={`$ isl verify specs/ \\
    --all \\
    --min-trust-score 90 \\
    --report json \\
    --fail-on-warning

# Exit code 0 if trust score >= 90 and no warnings
# Exit code 4 if verification fails`}
          language="bash"
        />

        <h2>JSON Report</h2>

        <CodeBlock
          code={`$ isl verify specs/ --report json

{
  "trustScore": 94.2,
  "runtime": {
    "postconditions": { "passed": 156, "failed": 0 },
    "invariants": { "passed": 47, "failed": 0 }
  },
  "chaos": {
    "scenarios": { "passed": 24, "failed": 0, "warnings": 2 }
  },
  "temporal": {
    "requirements": { "passed": 18, "failed": 0, "warnings": 1 }
  },
  "failures": [],
  "warnings": [
    {
      "type": "chaos",
      "scenario": "Database Unavailable",
      "message": "Slow recovery (15s vs 5s expected)"
    }
  ]
}`}
          language="json"
        />
      </div>
    </div>
  );
}
