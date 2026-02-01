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
