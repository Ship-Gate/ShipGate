/**
 * HallucinationDetector — AI-specific code hallucination detection
 *
 * Detects behavioral hallucinations that traditional linters miss:
 * - Phantom API calls (methods that don't exist on npm packages)
 * - Hallucinated environment variables
 * - Hallucinated file references
 * - Confident-but-wrong patterns (loose equality, unsafe JSON.parse, etc.)
 * - Copy-paste artifacts (placeholders, template variables)
 * - Stale/deprecated patterns
 *
 * Extensible via HallucinationRule interface and custom rule loader.
 *
 * @module @isl-lang/hallucination-scanner/ts/hallucination-detector
 */

import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { loadRules } from './rule-loader.js';
import type { HallucinationRule, RuleContext, RuleSetId } from './hallucination-rules.js';
import type {
  HallucinationFinding,
  HallucinationScanResult,
  HallucinationSeverity,
  Finding,
} from './hallucination-types.js';
import type { RuleLoaderOptions } from './rule-loader.js';

export type { HallucinationRule, RuleContext, RuleSetId } from './hallucination-rules.js';
export type { RuleLoaderOptions } from './rule-loader.js';

export interface HallucinationDetectorOptions extends RuleLoaderOptions {
  projectRoot: string;
  /** Files to scan; defaults to discovering .ts/.tsx/.js/.jsx in projectRoot */
  entries?: string[];
  /** Custom file reader (for testing) */
  readFile?: (filePath: string) => Promise<string>;
  /** Custom file existence check (for testing) */
  fileExists?: (filePath: string) => Promise<boolean>;
  /** Enable/disable specific check categories (legacy; prefer ruleSets) */
  checks?: {
    phantomApi?: boolean;
    envVars?: boolean;
    fileReferences?: boolean;
    confidentButWrong?: boolean;
    copyPasteArtifacts?: boolean;
    staleDeprecated?: boolean;
  };
}

const TS_JS_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.turbo', '.next', 'coverage', '.nuxt']);
const ENV_FILES = ['.env', '.env.example', '.env.local', '.env.development', '.env.production'];

export class HallucinationDetector {
  private projectRoot: string;
  private entries: string[];
  private readFile: (p: string) => Promise<string>;
  private fileExists: (p: string) => Promise<boolean>;
  private ruleLoaderOptions: RuleLoaderOptions;
  private checks?: HallucinationDetectorOptions['checks'];

  private envVarsDefined: Set<string> = new Set();
  private envVarsInLocalOnly: Set<string> = new Set();
  private projectFiles: Set<string> = new Set();
  private rules: HallucinationRule[] = [];

  constructor(options: HallucinationDetectorOptions) {
    this.projectRoot = path.resolve(options.projectRoot);
    this.entries = options.entries ?? [];
    this.readFile = options.readFile ?? ((p) => fs.readFile(p, 'utf-8'));
    this.fileExists = options.fileExists ?? (async (p) => {
      try {
        await fs.access(p);
        return true;
      } catch {
        return false;
      }
    });
    this.ruleLoaderOptions = {
      ...(options.ruleSets !== undefined && { ruleSets: options.ruleSets }),
      ...(options.customRules !== undefined && { customRules: options.customRules }),
      ...(options.rulesFile !== undefined && { rulesFile: options.rulesFile }),
    };
    this.checks = options.checks;
  }

  /**
   * Run all hallucination checks and return aggregated result.
   */
  async scan(): Promise<HallucinationScanResult> {
    this.rules = await loadRules(this.ruleLoaderOptions);

    const files = this.entries.length > 0
      ? this.entries
      : await this.discoverFiles();

    await this.loadEnvVars();
    await this.loadProjectFiles();

    const findings: HallucinationFinding[] = [];

    for (const file of files) {
      let source: string;
      try {
        source = await this.readFile(file);
      } catch {
        continue;
      }

      const ctx: RuleContext = {
        source,
        file,
        fromDir: path.dirname(file),
        envVarsDefined: this.envVarsDefined,
        envVarsInLocalOnly: this.envVarsInLocalOnly,
        projectFiles: this.projectFiles,
        fileExists: this.fileExists,
        readFile: this.readFile,
      };

      for (const rule of this.rules) {
        if (this.shouldRunRule(rule)) {
          try {
            const ruleFindings = await Promise.resolve(rule.run(ctx));
            for (const rf of ruleFindings) {
              findings.push(this.ruleFindingToHallucinationFinding(rf));
            }
          } catch (err) {
            // Rule threw — log and continue (don't fail entire scan)
            if (process.env.DEBUG?.includes('hallucination')) {
              console.error(`Rule ${rule.id} failed:`, err);
            }
          }
        }
      }
    }

    const summary = this.computeSummary(findings);
    return {
      success: findings.length === 0,
      findings,
      summary,
    };
  }

  /**
   * Scan and return findings in the Finding[] format (compatible with spec-implementation-verifier / ISL Gate).
   */
  async scanAsFindings(): Promise<Finding[]> {
    const result = await this.scan();
    return toFindings(result.findings);
  }

  private shouldRunRule(rule: HallucinationRule): boolean {
    if (!this.checks) return true;
    const ruleToCheck: Record<string, keyof NonNullable<typeof this.checks>> = {
      'phantom-api': 'phantomApi',
      'env-vars': 'envVars',
      'file-references': 'fileReferences',
      'confident-but-wrong': 'confidentButWrong',
      'copy-paste-artifacts': 'copyPasteArtifacts',
      'stale-deprecated': 'staleDeprecated',
    };
    const checkKey = ruleToCheck[rule.id];
    if (!checkKey) return true;
    const enabled = this.checks[checkKey];
    return enabled !== false;
  }

  private ruleFindingToHallucinationFinding(rf: import('./hallucination-rules.js').RuleFinding): HallucinationFinding {
    const f: HallucinationFinding = {
      category: rf.category as HallucinationFinding['category'],
      severity: rf.severity,
      message: rf.message,
      file: rf.file,
      line: rf.line,
      column: rf.column,
    };
    if (rf.suggestion !== undefined) f.suggestion = rf.suggestion;
    if (rf.snippet !== undefined) f.snippet = rf.snippet;
    if (rf.raw !== undefined) f.raw = rf.raw;
    return f;
  }

  private async discoverFiles(): Promise<string[]> {
    const results: string[] = [];

    async function walk(dir: string): Promise<void> {
      let entries: Array<{ name: string; isDirectory: () => boolean }>;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (SKIP_DIRS.has(entry.name)) continue;
          await walk(fullPath);
        } else if (TS_JS_EXTENSIONS.has(path.extname(entry.name))) {
          results.push(fullPath);
        }
      }
    }

    await walk(this.projectRoot);
    return results;
  }

  private async loadEnvVars(): Promise<void> {
    const root = this.projectRoot;
    const inExample = new Set<string>();
    const inLocal = new Set<string>();

    for (const envFile of ENV_FILES) {
      const fullPath = path.join(root, envFile);
      try {
        const content = await this.readFile(fullPath);
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const eq = trimmed.indexOf('=');
            if (eq > 0) {
              const name = trimmed.slice(0, eq).trim();
              this.envVarsDefined.add(name);
              if (envFile === '.env.example') inExample.add(name);
              if (envFile === '.env.local') inLocal.add(name);
            }
          }
        }
      } catch {
        // File doesn't exist
      }
    }

    for (const v of inLocal) {
      if (!inExample.has(v)) {
        this.envVarsInLocalOnly.add(v);
      }
    }
  }

  private async loadProjectFiles(): Promise<void> {
    const files = await this.discoverFiles();
    for (const f of files) {
      this.projectFiles.add(path.resolve(f));
    }
  }

  private computeSummary(findings: HallucinationFinding[]): HallucinationScanResult['summary'] {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    for (const f of findings) {
      if (f.severity === 'critical') critical++;
      else if (f.severity === 'high') high++;
      else if (f.severity === 'medium') medium++;
      else low++;
    }
    return { critical, high, medium, low };
  }
}

/**
 * Convert HallucinationFinding[] to Finding[] (spec-implementation-verifier / ISL Gate format).
 */
export function toFindings(hallucinationFindings: HallucinationFinding[]): Finding[] {
  return hallucinationFindings.map((f, i) => {
    const finding: Finding = {
      id: `hallucination-${f.category}-${i}-${f.line ?? 0}`,
      checker: 'hallucination-detector',
      ruleId: f.category,
      severity: f.severity as Finding['severity'],
      message: f.message,
      file: f.file,
      line: f.line,
      column: f.column,
      blocking: f.severity === 'critical' || f.severity === 'high',
    };
    if (f.suggestion !== undefined) finding.recommendation = f.suggestion;
    if (f.snippet !== undefined) finding.snippet = f.snippet;
    if (f.raw !== undefined) finding.context = { raw: f.raw };
    return finding;
  });
}
