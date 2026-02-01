/**
 * Commands Index
 * 
 * Re-exports all CLI commands.
 */

export { check, printCheckResult, type CheckOptions, type CheckResult, type FileCheckResult } from './check.js';
export { generate, printGenerateResult, type GenerateOptions, type GenerateResult, type GeneratedFile } from './generate.js';
export { verify, printVerifyResult, type VerifyOptions, type VerifyResult } from './verify.js';
export { init, printInitResult, type InitOptions, type InitResult } from './init.js';
