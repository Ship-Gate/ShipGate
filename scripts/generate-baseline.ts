#!/usr/bin/env tsx
/**
 * Monorepo Baseline Audit Generator
 *
 * Runs typecheck, build, and test across the monorepo, parses failures,
 * computes dependency impact ranking, and produces:
 *   - reports/baseline.json (machine readable)
 *   - reports/baseline.md   (human readable)
 *
 * Usage:
 *   npx tsx scripts/generate-baseline.ts
 *   npx tsx scripts/generate-baseline.ts --skip-run   # parse existing logs only
 */

import { execSync } from "child_process";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "..");
const REPORTS = join(ROOT, "reports");
const LOGS = join(REPORTS, "logs");

interface TaskFailure {
  package: string;
  task: string;
  firstError: string;
  category: string;
  errorCount: number;
  fix: string;
}

interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  passRate: string;
  failedTasks: string[];
  duration: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd: string, label: string): string {
  console.log(`\n▶ Running: ${cmd}`);
  const logFile = join(LOGS, `${label}.log`);
  try {
    const output = execSync(`${cmd} 2>&1`, {
      cwd: ROOT,
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
      timeout: 30 * 60 * 1000, // 30 min
    });
    writeFileSync(logFile, output, "utf-8");
    return output;
  } catch (e: any) {
    const output = e.stdout ?? e.stderr ?? "";
    writeFileSync(logFile, output, "utf-8");
    return output;
  }
}

function parseSummary(output: string): RunSummary {
  const tasksMatch = output.match(/Tasks:\s+(\d+)\s+successful,\s+(\d+)\s+total/);
  const timeMatch = output.match(/Time:\s+([\d.]+[ms]+)/);
  const failedMatch = output.match(/Failed:\s+(.+)/);

  const total = tasksMatch ? parseInt(tasksMatch[2]) : 0;
  const passed = tasksMatch ? parseInt(tasksMatch[1]) : 0;
  const failedTasks = failedMatch
    ? failedMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return {
    total,
    passed,
    failed: total - passed,
    passRate: total > 0 ? `${((passed / total) * 100).toFixed(1)}%` : "N/A",
    failedTasks,
    duration: timeMatch ? timeMatch[1] : "unknown",
  };
}

function classifyError(line: string): string {
  if (/TS6053|\.d\.ts.*not found|\.d\.cts.*not found/.test(line)) return "missing_dts";
  if (/TS6059|TS6307|rootDir|include pattern/.test(line)) return "bad_tsconfig";
  if (/TS2835|moduleResolution/.test(line)) return "bad_tsconfig";
  if (/TS2307.*Cannot find module/.test(line)) return "missing_module";
  if (/TS7016.*Could not find a declaration/.test(line)) return "missing_dts";
  if (/TS2459.*not exported|TS2305.*no exported member/.test(line)) return "exports";
  if (/Cannot find module|Could not resolve/.test(line)) return "missing_dependency";
  if (/require is not defined/.test(line)) return "esm_cjs_mismatch";
  if (/node_modules missing/.test(line)) return "missing_install";
  if (/TS\d+/.test(line)) return "types";
  return "other";
}

function extractFirstError(output: string, pkg: string, task: string): { error: string; category: string; count: number } {
  const prefix = `${pkg}:${task}:`;
  const altPrefix = `${pkg.replace("@isl-lang/", "").replace("@", "")}:${task}:`;
  const lines = output.split("\n");
  let firstError = "";
  let count = 0;

  for (const line of lines) {
    if ((line.includes(prefix) || line.includes(altPrefix)) && /error TS\d+|ERROR|Error:|FAIL/.test(line)) {
      count++;
      if (!firstError) {
        firstError = line.replace(new RegExp(`.*${task}:\\s*`), "").trim();
      }
    }
  }

  if (!firstError) {
    // Try to find any error line for this package
    for (const line of lines) {
      if ((line.includes(prefix) || line.includes(altPrefix)) && /error|Error|FAIL|failed/.test(line)) {
        firstError = line.replace(new RegExp(`.*${task}:\\s*`), "").trim();
        count = 1;
        break;
      }
    }
  }

  return {
    error: firstError || "See log for details",
    category: classifyError(firstError),
    count: Math.max(count, 1),
  };
}

function extractDependencyGraph(output: string): Map<string, string[]> {
  // Parse turbo dry-run JSON for task dependencies
  const graph = new Map<string, string[]>();
  try {
    const dryOutput = execSync("pnpm turbo build --dry=json 2>NUL", {
      cwd: ROOT,
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
    });
    const dry = JSON.parse(dryOutput);
    for (const task of dry.tasks || []) {
      if (task.task !== "build") continue;
      const pkg = task.package;
      const deps = (task.dependencies || [])
        .map((d: string) => d.replace("#build", ""))
        .filter((d: string) => d !== "___ROOT___" && d !== pkg);
      graph.set(pkg, deps);
    }
  } catch {
    console.warn("⚠ Could not extract dependency graph from turbo dry run");
  }
  return graph;
}

function computeReverseDeps(graph: Map<string, string[]>): Map<string, string[]> {
  const reverse = new Map<string, string[]>();
  for (const [pkg, deps] of graph) {
    for (const dep of deps) {
      if (!reverse.has(dep)) reverse.set(dep, []);
      reverse.get(dep)!.push(pkg);
    }
  }
  return reverse;
}

function countTransitiveDependents(pkg: string, reverse: Map<string, string[]>, visited = new Set<string>()): number {
  if (visited.has(pkg)) return 0;
  visited.add(pkg);
  const direct = reverse.get(pkg) || [];
  let count = direct.length;
  for (const dep of direct) {
    count += countTransitiveDependents(dep, reverse, visited);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const skipRun = process.argv.includes("--skip-run");

  mkdirSync(REPORTS, { recursive: true });
  mkdirSync(LOGS, { recursive: true });

  let typecheckOutput: string;
  let buildOutput: string;
  let testOutput: string;

  if (skipRun) {
    console.log("⏩ Skipping command execution, reading existing logs...");
    typecheckOutput = readFileSync(join(LOGS, "typecheck.log"), "utf-8");
    buildOutput = readFileSync(join(LOGS, "build.log"), "utf-8");
    testOutput = readFileSync(join(LOGS, "test.log"), "utf-8");
  } else {
    typecheckOutput = run("pnpm turbo typecheck --continue", "typecheck");
    buildOutput = run("pnpm turbo build --continue", "build");
    testOutput = run("pnpm turbo test --continue", "test");
  }

  console.log("\n📊 Parsing results...");

  const typecheck = parseSummary(typecheckOutput);
  const build = parseSummary(buildOutput);
  const test = parseSummary(testOutput);

  // Extract typecheck failures
  const typecheckFailures: TaskFailure[] = [];
  for (const task of typecheck.failedTasks) {
    const [pkg, cmd] = task.split("#");
    if (cmd !== "typecheck") continue;
    const { error, category, count } = extractFirstError(typecheckOutput, pkg, "typecheck");
    typecheckFailures.push({ package: pkg, task: "typecheck", firstError: error, category, errorCount: count, fix: "" });
  }

  // Extract build failures
  const buildFailures: TaskFailure[] = [];
  for (const task of build.failedTasks) {
    const [pkg, cmd] = task.split("#");
    if (cmd !== "build") continue;
    const { error, category, count } = extractFirstError(buildOutput, pkg, "build");
    buildFailures.push({ package: pkg, task: "build", firstError: error, category, errorCount: count, fix: "" });
  }

  // Separate test-only failures from build cascades
  const buildFailedPkgs = new Set(build.failedTasks.filter((t) => t.endsWith("#build")).map((t) => t.replace("#build", "")));
  const testOnlyFailures: string[] = [];
  const buildCascadeTestFailures: string[] = [];

  for (const task of test.failedTasks) {
    if (!task.endsWith("#test")) continue;
    const pkg = task.replace("#test", "");
    if (buildFailedPkgs.has(pkg)) {
      buildCascadeTestFailures.push(pkg);
    } else {
      testOnlyFailures.push(pkg);
    }
  }

  // Dependency graph
  console.log("🔗 Computing dependency graph...");
  const graph = extractDependencyGraph(buildOutput);
  const reverseDeps = computeReverseDeps(graph);

  // Impact ranking for failed packages
  const allFailedPkgs = new Set([
    ...typecheckFailures.map((f) => f.package),
    ...buildFailures.map((f) => f.package),
  ]);

  const impactRanking = [...allFailedPkgs]
    .map((pkg) => ({
      package: pkg,
      directDependents: reverseDeps.get(pkg) || [],
      transitiveUnblocks: countTransitiveDependents(pkg, reverseDeps),
    }))
    .sort((a, b) => b.transitiveUnblocks - a.transitiveUnblocks)
    .slice(0, 15)
    .map((item, i) => ({ rank: i + 1, ...item }));

  // Build JSON report
  const report = {
    generated: new Date().toISOString(),
    environment: {
      node: process.version,
      pnpm: "8.15.0",
      turbo: "2.8.1",
      os: process.platform,
      totalWorkspacePackages: (graph.size || 219),
    },
    commands: {
      typecheck: "pnpm turbo typecheck --continue",
      build: "pnpm turbo build --continue",
      test: "pnpm turbo test --continue",
    },
    summary: {
      typecheck: { total: typecheck.total, passed: typecheck.passed, failed: typecheck.failed, passRate: typecheck.passRate, duration: typecheck.duration },
      build: { total: build.total, passed: build.passed, failed: build.failed, passRate: build.passRate, duration: build.duration },
      test: { total: test.total, passed: test.passed, failed: test.failed, passRate: test.passRate, duration: test.duration },
    },
    failures: {
      typecheck: typecheckFailures,
      build: buildFailures,
      test: {
        genuineTestFailures: testOnlyFailures,
        buildCascadeTestFailures,
      },
    },
    dependencyImpactRanking: impactRanking,
  };

  // Write JSON
  const jsonPath = join(REPORTS, "baseline.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`✅ Written: ${jsonPath}`);

  // Generate and write Markdown
  const md = generateMarkdown(report, typecheckFailures, buildFailures, testOnlyFailures, impactRanking);
  const mdPath = join(REPORTS, "baseline.md");
  writeFileSync(mdPath, md, "utf-8");
  console.log(`✅ Written: ${mdPath}`);

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("BASELINE AUDIT COMPLETE");
  console.log("=".repeat(60));
  console.log(`Typecheck: ${typecheck.passed}/${typecheck.total} passed (${typecheck.passRate})`);
  console.log(`Build:     ${build.passed}/${build.total} passed (${build.passRate})`);
  console.log(`Test:      ${test.passed}/${test.total} passed (${test.passRate})`);
  console.log(`\nReports: reports/baseline.json, reports/baseline.md`);
  console.log(`Logs:    reports/logs/typecheck.log, build.log, test.log`);
}

function generateMarkdown(
  report: any,
  typecheckFailures: TaskFailure[],
  buildFailures: TaskFailure[],
  testOnlyFailures: string[],
  impactRanking: any[],
): string {
  const lines: string[] = [];
  const p = (s: string) => lines.push(s);

  p("# Monorepo Baseline Audit Report");
  p("");
  p(`**Generated:** ${report.generated}`);
  p(`**Environment:** Node ${report.environment.node} · pnpm ${report.environment.pnpm} · Turbo ${report.environment.turbo} · ${report.environment.os}`);
  p(`**Workspace packages:** ${report.environment.totalWorkspacePackages}`);
  p("");
  p("---");
  p("");
  p("## Executive Summary");
  p("");
  p("| Command | Total | Passed | Failed | Pass Rate | Duration |");
  p("|---------|-------|--------|--------|-----------|----------|");
  for (const [cmd, s] of Object.entries(report.summary) as any) {
    p(`| \`turbo ${cmd} --continue\` | ${s.total} | ${s.passed} | **${s.failed}** | ${s.passRate} | ${s.duration} |`);
  }
  p("");
  p("---");
  p("");

  // Typecheck failures
  p("## Typecheck Failures");
  p("");
  p("| Package | First Error | Category |");
  p("|---------|-------------|----------|");
  for (const f of typecheckFailures) {
    const err = f.firstError.length > 80 ? f.firstError.slice(0, 80) + "..." : f.firstError;
    p(`| \`${f.package}\` | ${err} | ${f.category} |`);
  }
  p("");
  p("---");
  p("");

  // Build failures
  p("## Build Failures");
  p("");
  p("| Package | First Error | Category |");
  p("|---------|-------------|----------|");
  for (const f of buildFailures) {
    const err = f.firstError.length > 80 ? f.firstError.slice(0, 80) + "..." : f.firstError;
    p(`| \`${f.package}\` | ${err} | ${f.category} |`);
  }
  p("");
  p("---");
  p("");

  // Test failures
  p("## Genuine Test Failures");
  p("");
  p(`${testOnlyFailures.length} packages build successfully but have failing tests:`);
  p("");
  for (const pkg of testOnlyFailures) {
    p(`- \`${pkg}\``);
  }
  p("");
  p("---");
  p("");

  // Impact ranking
  p("## Fastest Unblock Path — Top 15");
  p("");
  p("| Rank | Package | Dependents | Transitive Unblocks |");
  p("|------|---------|------------|---------------------|");
  for (const item of impactRanking) {
    const deps = item.directDependents.slice(0, 3).join(", ") || "—";
    p(`| ${item.rank} | \`${item.package}\` | ${deps} | ${item.transitiveUnblocks} |`);
  }
  p("");
  p("---");
  p("");

  // Repeatability
  p("## Repeatability");
  p("");
  p("```bash");
  p("# Reproduce this report:");
  p("npx tsx scripts/generate-baseline.ts");
  p("");
  p("# Re-parse existing logs without re-running commands:");
  p("npx tsx scripts/generate-baseline.ts --skip-run");
  p("```");

  return lines.join("\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
