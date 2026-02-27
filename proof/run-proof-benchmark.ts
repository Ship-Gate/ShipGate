#!/usr/bin/env npx tsx
/**
 * ISL Proof Benchmark
 *
 * Runs the gate against known-good and known-bad implementations to prove:
 * - Good code → SHIP
 * - Bad code → NO-SHIP (ISL catches the bugs)
 *
 * This is the data for "ISL catches X% of known AI-generated bugs."
 *
 * Run: pnpm exec tsx proof/run-proof-benchmark.ts
 * Output: proof/report.json, proof/PROOF_REPORT.md
 */

import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ISL = path.join(ROOT, 'packages/cli/dist/index.js');

interface CorpusSpec {
  id: string;
  name: string;
  specPath: string;
  goodImpl: string;
  badImpl: string;
  knownBugs: string[];
}

interface GateResult {
  verdict: 'SHIP' | 'NO-SHIP';
  score: number;
  output: string;
  exitCode: number;
}

async function runGate(specPath: string, implPath: string): Promise<GateResult> {
  return new Promise((resolve) => {
    const specAbs = path.isAbsolute(specPath) ? specPath : path.join(ROOT, specPath);
    const implAbs = path.isAbsolute(implPath) ? implPath : path.join(ROOT, implPath);

    const proc = spawn(process.execPath, [ISL, 'gate', specAbs, '--impl', implAbs, '--threshold', '0', '--format', 'json'], {
      cwd: ROOT,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d) => (stdout += d.toString()));
    proc.stderr?.on('data', (d) => (stderr += d.toString()));

    proc.on('close', (code) => {
      const output = stdout || stderr;
      let verdict: 'SHIP' | 'NO-SHIP' = 'NO-SHIP';
      let score = 0;

      try {
        const json = JSON.parse(stdout);
        verdict = json.decision ?? json.verdict ?? 'NO-SHIP';
        score = json.trustScore ?? json.score ?? 0;
      } catch {
        if (output.includes('SHIP') && !output.includes('NO-SHIP')) verdict = 'SHIP';
        const scoreMatch = output.match(/Trust Score[:\s]+(\d+)/i) ?? output.match(/(\d+)\s*%/);
        if (scoreMatch) score = parseInt(scoreMatch[1]!, 10);
      }

      resolve({
        verdict: verdict === 'SHIP' ? 'SHIP' : 'NO-SHIP',
        score,
        output,
        exitCode: code ?? 1,
      });
    });
  });
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  ISL Proof Benchmark                                         ║
║  Proving that ISL catches bad code and approves good code    ║
╚══════════════════════════════════════════════════════════════╝
`);

  const corpusPath = path.join(__dirname, 'corpus.json');
  const corpus = JSON.parse(await fs.readFile(corpusPath, 'utf-8'));
  const specs: CorpusSpec[] = corpus.specs;

  const results: Array<{
    id: string;
    name: string;
    goodImpl: { verdict: string; score: number; passed: boolean };
    badImpl: { verdict: string; score: number; caught: boolean };
    knownBugs: string[];
  }> = [];

  for (const spec of specs) {
    console.log(`\n━━━ ${spec.name} ━━━`);
    console.log(`   Spec: ${spec.specPath}`);
    console.log(`   Known bugs: ${spec.knownBugs.length}`);

    const goodResult = await runGate(spec.specPath, spec.goodImpl);
    const badResult = await runGate(spec.specPath, spec.badImpl);

    const goodPassed = goodResult.verdict === 'SHIP';
    const badCaught = badResult.verdict === 'NO-SHIP';

    console.log(`   Good impl: ${goodPassed ? '✓ SHIP' : '✗ NO-SHIP'} (score: ${goodResult.score})`);
    console.log(`   Bad impl:  ${badCaught ? '✓ NO-SHIP (caught!)' : '✗ SHIP (missed!)'} (score: ${badResult.score})`);

    results.push({
      id: spec.id,
      name: spec.name,
      goodImpl: {
        verdict: goodResult.verdict,
        score: goodResult.score,
        passed: goodPassed,
      },
      badImpl: {
        verdict: badResult.verdict,
        score: badResult.score,
        caught: badCaught,
      },
      knownBugs: spec.knownBugs,
    });
  }

  // Summary
  const goodPassCount = results.filter((r) => r.goodImpl.passed).length;
  const badCaughtCount = results.filter((r) => r.badImpl.caught).length;
  const totalBugs = results.reduce((sum, r) => sum + r.knownBugs.length, 0);

  console.log(`
═══════════════════════════════════════════════════════════════
  PROOF SUMMARY
═══════════════════════════════════════════════════════════════

  Good code approved:  ${goodPassCount}/${results.length} (${Math.round((100 * goodPassCount) / results.length)}%)
  Bad code caught:     ${badCaughtCount}/${results.length} (${Math.round((100 * badCaughtCount) / results.length)}%)
  Total known bugs:    ${totalBugs}

  Primary proof (bad code caught): ${badCaughtCount}/${results.length} = ${Math.round((100 * badCaughtCount) / results.length)}%
  Secondary (good code approved):   ${goodPassCount}/${results.length}

  Verdict: ${badCaughtCount === results.length ? '✓ PROOF: ISL catches all known bad code' : '✗ Gaps: some bad code not caught'}
═══════════════════════════════════════════════════════════════
`);

  // Write report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalSpecs: results.length,
      goodApproved: goodPassCount,
      badCaught: badCaughtCount,
      totalKnownBugs: totalBugs,
      proofValid: badCaughtCount === results.length,
    },
    results,
  };

  await fs.mkdir(__dirname, { recursive: true });
  await fs.writeFile(path.join(__dirname, 'report.json'), JSON.stringify(report, null, 2));

  const md = `# ISL Proof Benchmark Report

**Generated:** ${report.timestamp}

## Summary

| Metric | Value |
|--------|-------|
| Specs tested | ${report.summary.totalSpecs} |
| Good code approved (SHIP) | ${report.summary.goodApproved}/${report.summary.totalSpecs} |
| Bad code caught (NO-SHIP) | ${report.summary.badCaught}/${report.summary.totalSpecs} |
| Total known bugs in corpus | ${report.summary.totalKnownBugs} |
| **Proof valid** | ${report.summary.proofValid ? '✓ Yes' : '✗ No'} |

## Results by Spec

${results
  .map(
    (r) => `### ${r.name}
- **Good impl:** ${r.goodImpl.passed ? '✓ SHIP' : '✗ NO-SHIP'} (score: ${r.goodImpl.score})
- **Bad impl:** ${r.badImpl.caught ? '✓ NO-SHIP (caught)' : '✗ SHIP (missed)'} (score: ${r.badImpl.score})
- **Known bugs:** ${r.knownBugs.length}
  - ${r.knownBugs.join('\n  - ')}
`
  )
  .join('\n')}

## How to Run

\`\`\`bash
pnpm exec tsx proof/run-proof-benchmark.ts
\`\`\`
`;

  await fs.writeFile(path.join(__dirname, 'PROOF_REPORT.md'), md);
  console.log(`\nReport written to proof/report.json and proof/PROOF_REPORT.md\n`);

  // Exit 0 if bad code is caught (primary proof); 1 if any bad code slipped through
  process.exit(badCaughtCount === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
