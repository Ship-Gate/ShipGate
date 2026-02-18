import Link from 'next/link'
import { ArrowRight, CheckCircle2, Shield, FileCode, Lock } from 'lucide-react'

export default function Home() {
  return (
    <div className="prose max-w-none">
      <div className="not-prose mb-12">
        <h1 className="text-5xl font-bold mb-4">ISL Verify Proof Bundles</h1>
        <p className="text-xl text-muted-foreground mb-6">
          Cryptographic proof that AI-generated code is safe, correct, and ready to ship.
        </p>
        <div className="flex gap-4">
          <Link 
            href="/quickstart" 
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition"
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
          <Link 
            href="/specification" 
            className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-6 py-3 rounded-lg font-medium hover:bg-secondary/80 transition"
          >
            Read Specification
          </Link>
        </div>
      </div>

      <div className="not-prose grid md:grid-cols-2 gap-6 mb-12">
        <div className="border rounded-lg p-6">
          <Shield className="w-8 h-8 text-primary mb-3" />
          <h3 className="text-xl font-semibold mb-2">Definitive Verification</h3>
          <p className="text-muted-foreground">
            Static analysis + runtime testing proves properties like import integrity, auth coverage, SQL injection prevention.
          </p>
        </div>
        <div className="border rounded-lg p-6">
          <FileCode className="w-8 h-8 text-primary mb-3" />
          <h3 className="text-xl font-semibold mb-2">Tamper-Proof Evidence</h3>
          <p className="text-muted-foreground">
            Every proof bundle is signed with HMAC-SHA256 and contains file hashes - any code change invalidates the bundle.
          </p>
        </div>
        <div className="border rounded-lg p-6">
          <Lock className="w-8 h-8 text-primary mb-3" />
          <h3 className="text-xl font-semibold mb-2">Explicit Residual Risk</h3>
          <p className="text-muted-foreground">
            Proof bundles list exactly what was NOT verified - no false confidence, only honest transparency.
          </p>
        </div>
        <div className="border rounded-lg p-6">
          <CheckCircle2 className="w-8 h-8 text-primary mb-3" />
          <h3 className="text-xl font-semibold mb-2">CI/CD Ready</h3>
          <p className="text-muted-foreground">
            Drop into any CI pipeline in 5 minutes - GitHub Actions, GitLab CI, or any system that runs Node.js.
          </p>
        </div>
      </div>

      <h2>What is a Proof Bundle?</h2>
      <p>
        A <strong>proof bundle</strong> is a JSON document containing cryptographic evidence that your code satisfies specific security and correctness properties. Unlike traditional testing which shows "it works for these inputs," proof bundles provide <em>definitive verification</em> through:
      </p>
      <ul>
        <li><strong>Static AST analysis</strong> - Parse TypeScript/JavaScript and verify imports resolve, types are sound, auth is applied</li>
        <li><strong>Pattern matching</strong> - Detect SQL injection vectors, hardcoded secrets, XSS vulnerabilities</li>
        <li><strong>Runtime HTTP testing</strong> - Actually call endpoints and verify auth blocks unauthenticated requests</li>
        <li><strong>TypeScript compilation</strong> - Run <code>tsc</code> in strict mode and verify zero errors</li>
      </ul>

      <h2>Quick Example</h2>
      <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`npx isl-verify . --proof-bundle

✓ Import Integrity: 127/127 imports resolve
✓ Auth Coverage: All 8 protected routes have auth checks
✓ SQL Injection: All 15 DB queries use parameterized queries
✓ Secret Exposure: No hardcoded secrets detected
✓ Type Safety: TypeScript strict mode passes

Trust Score: 95/100 (A+)
Overall Verdict: VERIFIED

Proof bundle saved to .isl-verify/proof-bundle.json
Signature: 8f4a2c9b... (valid)`}
      </pre>

      <h2>Use Cases</h2>
      <ul>
        <li><strong>AI Code Review</strong> - After Cursor/Copilot generates code, run <code>isl-verify</code> to catch hallucinated imports, missing auth, SQL injection</li>
        <li><strong>CI/CD Gate</strong> - Block PRs that fail critical properties (auth-coverage, sql-injection, import-integrity)</li>
        <li><strong>SOC 2 Compliance</strong> - Generate audit-ready reports mapping ISL properties to SOC 2 controls</li>
        <li><strong>Third-Party Verification</strong> - Bundle signature + file hashes prove code hasn't changed since verification</li>
      </ul>

      <h2>Next Steps</h2>
      <div className="not-prose grid gap-4">
        <Link href="/quickstart" className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">1</div>
          <div>
            <div className="font-semibold">Quick Start</div>
            <div className="text-sm text-muted-foreground">Generate your first proof bundle in 60 seconds</div>
          </div>
        </Link>
        <Link href="/specification" className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">2</div>
          <div>
            <div className="font-semibold">Proof Bundle Specification</div>
            <div className="text-sm text-muted-foreground">Understand the authoritative proof bundle format</div>
          </div>
        </Link>
        <Link href="/guides/ci-integration" className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">3</div>
          <div>
            <div className="font-semibold">CI Integration</div>
            <div className="text-sm text-muted-foreground">Add to GitHub Actions in 5 minutes</div>
          </div>
        </Link>
      </div>
    </div>
  )
}
