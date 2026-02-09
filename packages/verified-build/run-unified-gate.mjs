#!/usr/bin/env node
/**
 * Unified gate CLI: runs spec gate (when spec exists) + firewall on files.
 * Reads config from env: PROJECT_ROOT, SPEC, IMPL, CHANGED_FILES (newline-separated).
 * Outputs CombinedVerdictResult JSON to stdout and exits with result.exitCode.
 */
import { runUnifiedGate } from './dist/index.js';

const projectRoot = process.env.PROJECT_ROOT || process.cwd();
const spec = process.env.SPEC || undefined;
const implementation = process.env.IMPL || '.';
const changedFilesRaw = process.env.CHANGED_FILES || '';
const filesToCheck = changedFilesRaw
  ? changedFilesRaw.split(/\r?\n/).map((p) => p.trim()).filter(Boolean)
  : undefined;

const result = await runUnifiedGate({
  projectRoot,
  spec,
  implementation,
  filesToCheck,
  evidencePath: './evidence',
  writeBundle: true,
  git: process.env.GITHUB_SHA ? { sha: process.env.GITHUB_SHA, branch: process.env.GITHUB_REF_NAME } : undefined,
  ci: process.env.GITHUB_RUN_ID ? { runId: String(process.env.GITHUB_RUN_ID), provider: 'github' } : undefined,
});

console.log(JSON.stringify(result, null, 2));
process.exit(result.exitCode);
