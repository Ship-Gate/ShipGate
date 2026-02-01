import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/docs/callout";

export const metadata = {
  title: "CI/CD Integration",
  description: "Add ISL validation and verification to your CI/CD pipelines.",
};

export default function CICDIntegrationPage() {
  return (
    <div>
      <h1>CI/CD Integration</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        Add ISL checks to your CI/CD pipelines for automated verification.
      </p>

      <h2 id="github-actions">GitHub Actions</h2>
      <CodeBlock
        code={`name: ISL Verification

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install ISL CLI
        run: npm install -g @isl/cli
        
      - name: Check Specifications
        run: isl check src/**/*.isl --strict
        
      - name: Generate Types
        run: isl generate typescript src/**/*.isl -o ./generated
        
      - name: Verify Implementation
        run: isl verify src/**/*.isl --impl ./src --coverage
        
      - name: Upload Coverage
        uses: actions/upload-artifact@v4
        with:
          name: isl-coverage
          path: ./coverage/`}
        language="yaml"
        filename=".github/workflows/isl.yml"
        showLineNumbers
      />

      <h2 id="gitlab-ci">GitLab CI</h2>
      <CodeBlock
        code={`stages:
  - validate
  - verify

isl-check:
  stage: validate
  image: node:20
  script:
    - npm install -g @isl/cli
    - isl check src/**/*.isl --strict --format json > isl-report.json
  artifacts:
    reports:
      codequality: isl-report.json

isl-verify:
  stage: verify
  image: node:20
  script:
    - npm install -g @isl/cli
    - npm ci
    - isl verify src/**/*.isl --impl ./src
  only:
    - merge_requests
    - main`}
        language="yaml"
        filename=".gitlab-ci.yml"
        showLineNumbers
      />

      <h2 id="pre-commit">Pre-commit Hook</h2>
      <p>Run ISL checks before every commit:</p>

      <CodeBlock
        code={`#!/bin/sh
# .git/hooks/pre-commit

echo "Running ISL check..."

# Check all modified ISL files
MODIFIED_ISL=$(git diff --cached --name-only --diff-filter=ACM | grep '\\.isl$')

if [ -n "$MODIFIED_ISL" ]; then
  isl check $MODIFIED_ISL --strict
  if [ $? -ne 0 ]; then
    echo "ISL check failed. Please fix errors before committing."
    exit 1
  fi
fi

echo "ISL check passed!"`}
        language="bash"
        filename=".git/hooks/pre-commit"
      />

      <Callout type="tip">
        Use <code>husky</code> to manage Git hooks in your project for easier setup
        across the team.
      </Callout>

      <h2 id="output-formats">Output Formats</h2>
      <p>ISL supports multiple output formats for CI integration:</p>

      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Format</th>
              <th className="text-left py-2 px-3">Flag</th>
              <th className="text-left py-2 px-3">Use Case</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>text</code></td>
              <td className="py-2 px-3">--format text</td>
              <td className="py-2 px-3">Human-readable output</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>json</code></td>
              <td className="py-2 px-3">--format json</td>
              <td className="py-2 px-3">Machine-parseable output</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>sarif</code></td>
              <td className="py-2 px-3">--format sarif</td>
              <td className="py-2 px-3">GitHub Code Scanning</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>junit</code></td>
              <td className="py-2 px-3">--format junit</td>
              <td className="py-2 px-3">CI test result format</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="exit-codes">Exit Codes</h2>
      <p>Use exit codes to fail CI builds appropriately:</p>

      <CodeBlock
        code={`# Fail build if any errors
isl check src/**/*.isl --strict
if [ $? -ne 0 ]; then
  echo "ISL validation failed"
  exit 1
fi

# Continue with warnings
isl check src/**/*.isl || true`}
        language="bash"
      />

      <h2 id="best-practices">Best Practices</h2>
      <ul>
        <li><strong>Run early</strong> - Check specs before running expensive tests</li>
        <li><strong>Fail fast</strong> - Use <code>--strict</code> mode in CI</li>
        <li><strong>Cache dependencies</strong> - Cache npm to speed up ISL CLI install</li>
        <li><strong>Generate artifacts</strong> - Store reports and generated code</li>
        <li><strong>Block merges</strong> - Require ISL checks to pass before merging</li>
      </ul>
    </div>
  );
}
