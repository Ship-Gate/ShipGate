/**
 * Commands Index
 * 
 * Re-exports all CLI commands.
 */

export { check, printCheckResult, type CheckOptions, type CheckResult, type FileCheckResult } from './check.js';
export { generate, printGenerateResult, type GenerateOptions, type GenerateResult, type GeneratedFile } from './generate.js';
export { verify, verifyWithDiscovery, printVerifyResult, getVerifyExitCode, type VerifyOptions, type VerifyResult, type EvidenceScore } from './verify.js';
export { init, printInitResult, type InitOptions, type InitResult } from './init.js';
export { parse, printParseResult, getParseExitCode, type ParseOptions, type ParseResult } from './parse.js';
export { gen, printGenResult, getGenExitCode, VALID_TARGETS, type GenOptions, type GenResult, type GenerationTarget } from './gen.js';
export { repl, type ReplOptions } from './repl.js';
export { fmt, printFmtResult, getFmtExitCode, type FmtOptions, type FmtResult } from './fmt.js';
export { lint, printLintResult, getLintExitCode, type LintOptions, type LintResult, type LintIssue } from './lint.js';
export { spec, printSpecResult, getSpecExitCode, listTemplates, getTemplate, TEMPLATES, type SpecOptions, type SpecResult, type TemplateInfo } from './spec.js';
export { gate, printGateResult, getGateExitCode, type GateOptions, type GateResult } from './gate.js';
export { heal, printHealResult, getHealExitCode, type HealOptions, type HealResult } from './heal.js';
export { verifyProof, printProofVerifyResult, getProofVerifyExitCode, type ProofVerifyCommandOptions, type ProofVerifyResult } from './proof.js';
export { createPolicyBundle, printCreateBundleResult, getCreateBundleExitCode, verifyPolicyBundle, printVerifyBundleResult, getVerifyBundleExitCode, type CreateBundleOptions, type CreateBundleResult, type VerifyBundleOptions, type VerifyBundleResult } from './policy-bundle.js';
export { watch, type WatchOptions, type WatchResult } from './watch.js';
