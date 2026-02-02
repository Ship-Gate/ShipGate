/**
 * ISL Studio
 * 
 * Ship decisions with receipts.
 * 
 * @example
 * ```typescript
 * import { runGate, loadConfig } from 'islstudio';
 * 
 * const config = await loadConfig(process.cwd());
 * const result = await runGate(files, config);
 * 
 * if (result.verdict === 'SHIP') {
 *   console.log('Safe to merge!');
 * }
 * ```
 * 
 * @module islstudio
 */

export { runGate, type GateConfig, type GateFile, type GateResult } from './gate.js';
export { loadConfig, PRESETS } from './config.js';
export { formatTerminalOutput, formatJsonOutput } from './formatters.js';
export { generateHtmlReport } from './report.js';
