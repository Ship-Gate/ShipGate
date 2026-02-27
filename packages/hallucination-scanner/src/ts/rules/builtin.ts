/**
 * Built-in Hallucination Rules
 *
 * Rule sets for: Next.js, Express, Fastify, React, Prisma, Stripe, Node.js,
 * plus core categories: phantom-api, env-vars, file-references,
 * confident-but-wrong, copy-paste-artifacts, stale-deprecated.
 *
 * @module @isl-lang/hallucination-scanner/ts/rules/builtin
 */

import * as path from 'node:path';
import type { HallucinationRule, RuleContext, RuleFinding } from '../hallucination-rules.js';
import type { RuleSetId } from '../hallucination-rules.js';
import { PHANTOM_API_SIGNATURES } from '../phantom-api-signatures.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function offsetToLocation(source: string, offset: number): { line: number; column: number } {
  const before = source.slice(0, offset);
  const lines = before.split('\n');
  return {
    line: lines.length,
    column: (lines[lines.length - 1] ?? '').length + 1,
  };
}

function getSnippet(source: string, line: number, contextLines = 1): string {
  const lines = source.split('\n');
  const start = Math.max(0, line - 1 - contextLines);
  const end = Math.min(lines.length, line + contextLines);
  return lines.slice(start, end).join('\n').trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Phantom API Rules ──────────────────────────────────────────────────────

const phantomApiRule: HallucinationRule = {
  id: 'phantom-api',
  name: 'Phantom API Hallucinations',
  package: 'general',
  run(ctx) {
    const findings: RuleFinding[] = [];
    for (const sig of PHANTOM_API_SIGNATURES) {
      const pattern = typeof sig.pattern === 'string'
        ? new RegExp(escapeRegex(sig.pattern) + '\\s*\\(', 'g')
        : sig.pattern;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(ctx.source)) !== null) {
        const { line, column } = offsetToLocation(ctx.source, match.index);
        findings.push({
          ruleId: `phantom-api-${sig.package}`,
          category: 'phantom_api',
          severity: sig.severity,
          message: `${sig.message} (${sig.package})`,
          suggestion: sig.suggestion,
          file: ctx.file,
          line,
          column,
          snippet: getSnippet(ctx.source, line),
          raw: match[0],
        });
      }
    }
    return findings;
  },
};

// ── Env Vars Rules ─────────────────────────────────────────────────────────

const envVarsRule: HallucinationRule = {
  id: 'env-vars',
  name: 'Hallucinated Environment Variables',
  run(ctx) {
    const findings: RuleFinding[] = [];
    const envRegex = /process\.env\.([A-Z_][A-Z0-9_]*)|process\.env\s*\[\s*['"`]([A-Za-z_][A-Za-z0-9_]*)['"`]\s*]/g;
    let match: RegExpExecArray | null;
    while ((match = envRegex.exec(ctx.source)) !== null) {
      const varName = match[1] ?? match[2] ?? '';
      if (!varName) continue;
      const { line, column } = offsetToLocation(ctx.source, match.index);
      if (!ctx.envVarsDefined.has(varName)) {
        findings.push({
          ruleId: 'env-var-undefined',
          category: 'env_var_undefined',
          severity: 'high',
          message: `Environment variable "${varName}" is referenced but never defined`,
          suggestion: 'Add the variable to .env.example and ensure it exists in deployment',
          file: ctx.file,
          line,
          column,
          snippet: getSnippet(ctx.source, line),
          raw: match[0],
        });
      } else if (ctx.envVarsInLocalOnly.has(varName)) {
        findings.push({
          ruleId: 'env-var-local-only',
          category: 'env_var_local_only',
          severity: 'medium',
          message: `"${varName}" is only in .env.local — won't exist in production`,
          suggestion: 'Add to .env.example and ensure CI/production sets it',
          file: ctx.file,
          line,
          column,
          snippet: getSnippet(ctx.source, line),
          raw: match[0],
        });
      }
    }
    return findings;
  },
};

// ── File References Rules ─────────────────────────────────────────────────

const fileReferencesRule: HallucinationRule = {
  id: 'file-references',
  name: 'Hallucinated File References',
  async run(ctx) {
    const findings: RuleFinding[] = [];
    const fromDir = ctx.fromDir;

    const resolveFile = async (specifier: string): Promise<string | null> => {
      if (specifier.startsWith('.')) {
        return path.resolve(fromDir, specifier);
      }
      return null;
    };

    const TS_JS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

    // Dynamic imports
    const dynamicImportRegex = /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = dynamicImportRegex.exec(ctx.source)) !== null) {
      const specifier = match[1]!;
      const resolved = await resolveFile(specifier);
      if (resolved) {
        let exists = await ctx.fileExists(resolved);
        if (!exists) {
          for (const ext of TS_JS_EXTENSIONS) {
            if (await ctx.fileExists(resolved + ext)) {
              exists = true;
              break;
            }
          }
        }
        if (!exists && !ctx.projectFiles.has(resolved)) {
          const { line, column } = offsetToLocation(ctx.source, match.index);
          findings.push({
            ruleId: 'file-ref-dynamic-import',
            category: 'file_reference',
            severity: 'high',
            message: `Dynamic import references non-existent file: "${specifier}"`,
            suggestion: 'Verify the file path exists in the project',
            file: ctx.file,
            line,
            column,
            snippet: getSnippet(ctx.source, line),
            raw: match[0],
          });
        }
      }
    }

    // fs.readFile / fs.readFileSync
    const fsReadRegex = /\b(?:fs|require\s*\(\s*['"]fs['"]\s*\))\s*\.\s*readFile(?:Sync)?\s*\(\s*['"`]([^'"`]+)['"`]/g;
    while ((match = fsReadRegex.exec(ctx.source)) !== null) {
      const filePath = match[1]!;
      const resolved = path.resolve(fromDir, filePath);
      if (!(await ctx.fileExists(resolved))) {
        const { line, column } = offsetToLocation(ctx.source, match.index);
        findings.push({
          ruleId: 'file-ref-fs-read',
          category: 'file_reference',
          severity: 'high',
          message: `fs.readFile references non-existent file: "${filePath}"`,
          suggestion: 'Verify the file path exists',
          file: ctx.file,
          line,
          column,
          snippet: getSnippet(ctx.source, line),
          raw: match[0],
        });
      }
    }

    // path.join with __dirname
    const pathJoinRegex = /\bpath\.join\s*\(\s*__dirname\s*,\s*['"`]([^'"`]+)['"`]/g;
    while ((match = pathJoinRegex.exec(ctx.source)) !== null) {
      const filePath = match[1]!;
      if (!filePath.includes('*') && !filePath.endsWith('/')) {
        const resolved = path.resolve(fromDir, filePath);
        if (!(await ctx.fileExists(resolved))) {
          const { line, column } = offsetToLocation(ctx.source, match.index);
          findings.push({
            ruleId: 'file-ref-path-join',
            category: 'file_reference',
            severity: 'high',
            message: `path.join references non-existent file: "${filePath}"`,
            suggestion: 'Verify the file path exists',
            file: ctx.file,
            line,
            column,
            snippet: getSnippet(ctx.source, line),
            raw: match[0],
          });
        }
      }
    }

    return findings;
  },
};

// ── Confident But Wrong Rules ───────────────────────────────────────────────

const confidentButWrongRule: HallucinationRule = {
  id: 'confident-but-wrong',
  name: 'Confident But Wrong Patterns',
  run(ctx) {
    const findings: RuleFinding[] = [];
    const lines = ctx.source.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNum = i + 1;

      // Loose equality
      if (/(?<![=!])==(?!=)/.test(line)) {
        const col = line.indexOf('==');
        if (col >= 0) {
          findings.push({
            ruleId: 'loose-equality',
            category: 'loose_equality',
            severity: 'medium',
            message: 'Using == instead of === (AI often generates loose equality)',
            suggestion: 'Use === for strict equality to avoid type coercion bugs',
            file: ctx.file,
            line: lineNum,
            column: col + 1,
            snippet: line.trim(),
            raw: '==',
          });
        }
      }

      // JSON.parse without try/catch
      if (line.includes('JSON.parse(')) {
        const blockBefore = lines.slice(Math.max(0, i - 5), i + 1).join('\n');
        if (!/\btry\s*\{/.test(blockBefore)) {
          const col = line.indexOf('JSON.parse');
          if (col >= 0) {
            findings.push({
              ruleId: 'json-parse-unsafe',
              category: 'json_parse_unsafe',
              severity: 'medium',
              message: 'JSON.parse() without try/catch — invalid JSON will throw',
              suggestion: 'Wrap in try/catch or use a safe parse utility',
              file: ctx.file,
              line: lineNum,
              column: col + 1,
              snippet: line.trim(),
              raw: 'JSON.parse',
            });
          }
        }
      }

      // Array.find() chained without null check
      const findChainMatch = line.match(/\.find\s*\([^)]*\)\s*\.\s*(\w+)/);
      if (findChainMatch) {
        const col = line.indexOf('.find');
        if (col >= 0) {
          findings.push({
            ruleId: 'array-find-unsafe',
            category: 'array_find_unsafe',
            severity: 'high',
            message: 'Array.find() can return undefined — chained property access may throw',
            suggestion: 'Add null check: const item = arr.find(...); if (item) { item.prop }',
            file: ctx.file,
            line: lineNum,
            column: col + 1,
            snippet: line.trim(),
            raw: findChainMatch[0],
          });
        }
      }

      // req.body.X without validation
      const reqBodyMatch = line.match(/req\.body\.([A-Za-z_][A-Za-z0-9_]*)/);
      if (reqBodyMatch) {
        const prop = reqBodyMatch[1]!;
        const block = lines.slice(Math.max(0, i - 5), i + 2).join('\n');
        const hasValidation = /\b(zod|yup|joi|validate|parse|schema)\b/i.test(block)
          || new RegExp(`req\\.body\\.${prop}\\s*===?\\s*undefined`).test(block);
        if (!hasValidation) {
          const col = line.indexOf('req.body');
          if (col >= 0) {
            findings.push({
              ruleId: 'req-body-unsafe',
              category: 'req_body_unsafe',
              severity: 'high',
              message: `req.body.${prop} accessed without validation or type guard`,
              suggestion: 'Validate req.body with Zod, Yup, or similar before use',
              file: ctx.file,
              line: lineNum,
              column: col + 1,
              snippet: line.trim(),
              raw: `req.body.${prop}`,
            });
          }
        }
      }

      // Async without try/catch
      if (line.includes('await ') && !line.includes('try') && !line.includes('catch')) {
        const block = lines.slice(Math.max(0, i - 3), i + 2).join('\n');
        if (!/\btry\s*\{[\s\S]*await/.test(block) && !/\.catch\s*\(/.test(block)) {
          const criticalAwait = /\bawait\s+(fetch|prisma|db|stripe|axios|fetch\()/i.test(line);
          if (criticalAwait) {
            const col = line.indexOf('await');
            if (col >= 0) {
              findings.push({
                ruleId: 'async-unhandled',
                category: 'async_unhandled',
                severity: 'medium',
                message: 'await without try/catch — unhandled rejection may crash the process',
                suggestion: 'Wrap in try/catch or add .catch() to handle errors',
                file: ctx.file,
                line: lineNum,
                column: col + 1,
                snippet: line.trim(),
                raw: 'await',
              });
            }
          }
        }
      }

      // Silent catch: catch(e) { } or catch { } with no body
      const silentCatchMatch = line.match(/\bcatch\s*(?:\(\s*\w*\s*\))?\s*\{\s*\}/);
      if (silentCatchMatch) {
        const col = line.indexOf('catch');
        if (col >= 0) {
          findings.push({
            ruleId: 'silent-catch',
            category: 'silent_catch',
            severity: 'medium',
            message: 'Empty catch block swallows errors silently',
            suggestion: 'Log the error or rethrow: catch (e) { logger.error(e); throw e; }',
            file: ctx.file,
            line: lineNum,
            column: col + 1,
            snippet: line.trim(),
            raw: 'catch',
          });
        }
      }
    }

    return findings;
  },
};

// ── Copy-Paste Artifacts Rules ─────────────────────────────────────────────

const PLACEHOLDER_PATTERNS = [
  { pattern: /\b(TODO|FIXME|XXX|HACK)\b/, severity: 'high' as const, id: 'placeholder-todo' },
  { pattern: /\bYOUR_[A-Z_]+\b/, severity: 'high' as const, id: 'placeholder-your' },
  { pattern: /\bREPLACE_THIS\b/, severity: 'high' as const, id: 'placeholder-replace' },
  { pattern: /example\.com(?![a-zA-Z])/, severity: 'high' as const, id: 'placeholder-url' },
  { pattern: /Lorem\s+ipsum/i, severity: 'high' as const, id: 'placeholder-lorem' },
];

const TEMPLATE_VAR_PATTERNS = [
  { pattern: /\{\{[^}]+\}\}/, severity: 'high' as const, id: 'template-mustache' },
  { pattern: /<PLACEHOLDER>/, severity: 'high' as const, id: 'template-angle' },
  { pattern: /__[A-Z_]+__/, severity: 'high' as const, id: 'template-underscore' },
];

const copyPasteArtifactsRule: HallucinationRule = {
  id: 'copy-paste-artifacts',
  name: 'Copy-Paste Artifacts',
  run(ctx) {
    const findings: RuleFinding[] = [];
    const lines = ctx.source.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNum = i + 1;

      for (const { pattern, severity, id } of PLACEHOLDER_PATTERNS) {
        const match = line.match(pattern);
        if (match) {
          const col = line.indexOf(match[0]!);
          if (col >= 0) {
            findings.push({
              ruleId: id,
              category: 'placeholder_text',
              severity,
              message: `Placeholder "${match[0]}" left in production code`,
              suggestion: 'Replace with actual implementation or remove',
              file: ctx.file,
              line: lineNum,
              column: col + 1,
              snippet: line.trim(),
              raw: match[0],
            });
          }
        }
      }

      for (const { pattern, severity, id } of TEMPLATE_VAR_PATTERNS) {
        const match = line.match(pattern);
        if (match) {
          const col = line.indexOf(match[0]!);
          if (col >= 0) {
            findings.push({
              ruleId: id,
              category: 'template_variable',
              severity,
              message: `Unresolved template variable "${match[0]}"`,
              suggestion: 'Replace with actual value or remove',
              file: ctx.file,
              line: lineNum,
              column: col + 1,
              snippet: line.trim(),
              raw: match[0],
            });
          }
        }
      }
    }

    // Duplicated logic: same route handler pattern repeated (simplified heuristic)
    const handlerRegex = /(?:app|router|fastify)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const handlers: Array<{ method: string; path: string; index: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = handlerRegex.exec(ctx.source)) !== null) {
      handlers.push({
        method: m[1]!,
        path: m[2]!,
        index: m.index,
      });
    }
    const pathCount = new Map<string, number>();
    for (const h of handlers) {
      const key = `${h.method}:${h.path}`;
      pathCount.set(key, (pathCount.get(key) ?? 0) + 1);
    }
    const reported = new Set<string>();
    for (const h of handlers) {
      const key = `${h.method}:${h.path}`;
      const count = pathCount.get(key) ?? 0;
      if (count > 1 && !reported.has(key)) {
        reported.add(key);
        const { line, column } = offsetToLocation(ctx.source, h.index);
        findings.push({
          ruleId: 'duplicated-handler',
          category: 'duplicated_logic',
          severity: 'medium',
          message: `Duplicate route handler: ${h.method} "${h.path}" appears ${count} times`,
          suggestion: 'Consolidate duplicate handlers',
          file: ctx.file,
          line,
          column,
          snippet: getSnippet(ctx.source, line),
          raw: `${h.method}("${h.path}")`,
        });
      }
    }

    return findings;
  },
};

// ── Stale/Deprecated Pattern Rules ────────────────────────────────────────

const STALE_PATTERNS = [
  {
    pattern: /getServerSideProps\s*(?:\|\||&&|,|\))/,
    id: 'nextjs-gssp-app-router',
    message: 'getServerSideProps is for Pages Router; use Server Components in App Router',
    suggestion: 'Use async Server Components or server actions in app/',
    severity: 'medium' as const,
    package: 'next',
  },
  {
    pattern: /componentDidMount\s*\(/,
    id: 'react-componentDidMount-fn',
    message: 'componentDidMount is for class components only',
    suggestion: 'Use useEffect(() => {...}, []) in function components',
    severity: 'high' as const,
    package: 'react',
  },
  {
    pattern: /app\.use\s*\(\s*bodyParser\s*\(\s*\)\s*\)/,
    id: 'express-bodyParser',
    message: 'bodyParser() is deprecated; built into Express 4.16+',
    suggestion: 'Use app.use(express.json()) and app.use(express.urlencoded({ extended: true }))',
    severity: 'medium' as const,
    package: 'express',
  },
  {
    pattern: /fs\.readFileSync\s*\([^)]+\)(?!\s*;?\s*$)/,
    id: 'node-readFileSync-handler',
    message: 'fs.readFileSync blocks the event loop',
    suggestion: 'Use fs.promises.readFile() or fs.readFile() with callback in async handlers',
    severity: 'high' as const,
    package: 'node',
  },
  {
    pattern: /React\.createClass\s*\(/,
    id: 'react-createClass',
    message: 'React.createClass was removed in React 16',
    suggestion: 'Use class Component extends React.Component or function components',
    severity: 'critical' as const,
    package: 'react',
  },
];

const staleDeprecatedRule: HallucinationRule = {
  id: 'stale-deprecated',
  name: 'Stale/Deprecated Pattern Detection',
  run(ctx) {
    const findings: RuleFinding[] = [];
    const lines = ctx.source.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNum = i + 1;

      for (const { pattern, id, message, suggestion, severity, package: pkg } of STALE_PATTERNS) {
        const match = line.match(pattern);
        if (match) {
          const col = line.indexOf(match[0]!);
          if (col >= 0) {
            findings.push({
              ruleId: id,
              category: 'stale_pattern',
              severity,
              message,
              suggestion,
              file: ctx.file,
              line: lineNum,
              column: col + 1,
              snippet: line.trim(),
              raw: match[0],
            });
          }
        }
      }

      // fs.readFileSync in request handler context (has req, res, etc.)
      if (/fs\.readFileSync/.test(line)) {
        const block = lines.slice(Math.max(0, i - 10), i + 3).join('\n');
        if (/\b(req|res|request|response|ctx)\b/.test(block)) {
          const col = line.indexOf('readFileSync');
          if (col >= 0) {
            findings.push({
              ruleId: 'node-readFileSync-blocking',
              category: 'blocking_sync',
              severity: 'high',
              message: 'fs.readFileSync in request handler blocks the event loop',
              suggestion: 'Use fs.promises.readFile() or async/await',
              file: ctx.file,
              line: lineNum,
              column: col + 1,
              snippet: line.trim(),
              raw: 'readFileSync',
            });
          }
        }
      }
    }

    return findings;
  },
};

// ── Rule Set Mapping ──────────────────────────────────────────────────────

const ALL_RULES: HallucinationRule[] = [
  phantomApiRule,
  envVarsRule,
  fileReferencesRule,
  confidentButWrongRule,
  copyPasteArtifactsRule,
  staleDeprecatedRule,
];

const RULE_SET_MAP: Record<RuleSetId, HallucinationRule[]> = {
  nextjs: [phantomApiRule, envVarsRule, fileReferencesRule, confidentButWrongRule, copyPasteArtifactsRule, staleDeprecatedRule],
  express: [phantomApiRule, envVarsRule, fileReferencesRule, confidentButWrongRule, copyPasteArtifactsRule, staleDeprecatedRule],
  fastify: [phantomApiRule, envVarsRule, fileReferencesRule, confidentButWrongRule, copyPasteArtifactsRule],
  react: [phantomApiRule, envVarsRule, confidentButWrongRule, copyPasteArtifactsRule, staleDeprecatedRule],
  prisma: [phantomApiRule, envVarsRule, confidentButWrongRule, copyPasteArtifactsRule],
  stripe: [phantomApiRule, envVarsRule, confidentButWrongRule, copyPasteArtifactsRule],
  node: [envVarsRule, fileReferencesRule, confidentButWrongRule, copyPasteArtifactsRule, staleDeprecatedRule],
  'phantom-api': [phantomApiRule],
  'env-vars': [envVarsRule],
  'file-references': [fileReferencesRule],
  'confident-but-wrong': [confidentButWrongRule],
  'copy-paste-artifacts': [copyPasteArtifactsRule],
  'stale-deprecated': [staleDeprecatedRule],
};

function getRulesForSet(id: RuleSetId): HallucinationRule[] {
  return RULE_SET_MAP[id] ?? ALL_RULES;
}

export function getBuiltinRules(ruleSetIds?: RuleSetId[]): HallucinationRule[] {
  if (!ruleSetIds || ruleSetIds.length === 0) {
    return ALL_RULES;
  }
  const seen = new Set<string>();
  const result: HallucinationRule[] = [];
  for (const id of ruleSetIds) {
    for (const rule of getRulesForSet(id)) {
      if (!seen.has(rule.id)) {
        seen.add(rule.id);
        result.push(rule);
      }
    }
  }
  return result;
}

export { ALL_RULES, phantomApiRule, envVarsRule, fileReferencesRule, confidentButWrongRule, copyPasteArtifactsRule, staleDeprecatedRule };
