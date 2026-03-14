/**
 * Inline Analyzer Service
 *
 * Runs lightweight regex-based security and quality checks on document change.
 * Produces VS Code diagnostics in real-time without requiring compilation.
 *
 * Performance target: < 100ms for a 500-line file.
 */

import * as vscode from 'vscode';

const SUPPORTED_LANGUAGES = new Set([
  'typescript', 'typescriptreact', 'javascript', 'javascriptreact',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Pattern definitions
// ─────────────────────────────────────────────────────────────────────────────

interface PatternRule {
  id: string;
  pattern: RegExp;
  severity: vscode.DiagnosticSeverity;
  message: string;
  remediation: string;
}

const SECURITY_PATTERNS: PatternRule[] = [
  {
    id: 'SG001',
    pattern: /(?:query|execute|raw)\s*\(\s*(?:`[^`]*\$\{|['"][^'"]*['"]\s*\+)/g,
    severity: vscode.DiagnosticSeverity.Error,
    message: 'Potential SQL injection: string concatenation/interpolation in query',
    remediation: 'Use parameterized queries or an ORM instead of string concatenation.',
  },
  {
    id: 'SG002',
    pattern: /(?:['"`])(?:sk_live_|sk_test_|ghp_|gho_|AKIA[A-Z0-9]{12,})[A-Za-z0-9_\-]{4,}/g,
    severity: vscode.DiagnosticSeverity.Error,
    message: 'Hardcoded secret detected',
    remediation: 'Move secrets to environment variables or a secrets manager.',
  },
  {
    id: 'SG003',
    pattern: /\beval\s*\(/g,
    severity: vscode.DiagnosticSeverity.Error,
    message: 'Use of eval() is a code injection risk',
    remediation: 'Replace eval() with a safe alternative (JSON.parse, Function constructor with validation, etc.).',
  },
  {
    id: 'SG004',
    pattern: /new\s+Function\s*\(/g,
    severity: vscode.DiagnosticSeverity.Error,
    message: 'new Function() can execute arbitrary code',
    remediation: 'Avoid dynamic code generation. Use static dispatch or a safe parser.',
  },
  {
    id: 'SG005',
    pattern: /\.innerHTML\s*=(?!=)/g,
    severity: vscode.DiagnosticSeverity.Error,
    message: 'Direct innerHTML assignment is an XSS risk',
    remediation: 'Use textContent, innerText, or a sanitizer like DOMPurify.',
  },
  {
    id: 'SG006',
    pattern: /(?:exec|execSync|spawn)\s*\([^)]*(?:\+|\$\{)/g,
    severity: vscode.DiagnosticSeverity.Error,
    message: 'Potential command injection — use parameterized arguments instead of string concatenation',
    remediation: 'Pass command arguments as an array to avoid shell interpretation.',
  },
  {
    id: 'SG007',
    pattern: /(?:readFile|readFileSync|writeFile|open|createReadStream)\s*\([^)]*(?:\.\.\/|\.\.\\)/g,
    severity: vscode.DiagnosticSeverity.Warning,
    message: 'Potential path traversal — validate and sanitize file paths',
    remediation: 'Use path.resolve() and validate the resolved path is within the expected directory.',
  },
  {
    id: 'SG008',
    pattern: /(?:fetch|axios\.\w+|http\.get)\s*\(\s*req\./g,
    severity: vscode.DiagnosticSeverity.Error,
    message: 'Potential SSRF — validate URLs against an allowlist before making requests',
    remediation: 'Parse and validate the URL hostname against an allowlist.',
  },
  {
    id: 'SG009',
    pattern: /JSON\.parse\s*\(\s*req\.body/g,
    severity: vscode.DiagnosticSeverity.Warning,
    message: 'Unsafe deserialization — validate parsed data with a schema (zod, joi, yup)',
    remediation: 'Parse the data then validate against a schema before use.',
  },
];

const TAINT_PATTERNS: PatternRule[] = [
  {
    id: 'SG010',
    pattern: /(?:req\.body|req\.query|req\.params)\s*[\[.]\s*\w+.*(?:exec|eval|query|execute|raw|innerHTML|\.html\()/g,
    severity: vscode.DiagnosticSeverity.Warning,
    message: 'User input (req.body/query/params) flows into a dangerous sink',
    remediation: 'Validate and sanitize user input before passing it to exec, query, or DOM APIs.',
  },
  {
    id: 'SG011',
    pattern: /(?:exec|execSync|spawn|spawnSync)\s*\(.*(?:req\.body|req\.query|req\.params)/g,
    severity: vscode.DiagnosticSeverity.Warning,
    message: 'User input flows into a shell command — command injection risk',
    remediation: 'Use parameterized command execution or an allowlist of permitted commands.',
  },
  {
    id: 'SG012',
    pattern: /res\.redirect\s*\(\s*req\./g,
    severity: vscode.DiagnosticSeverity.Warning,
    message: 'Potential open redirect — user input directly controls redirect destination',
    remediation: 'Validate redirect URLs against an allowlist of permitted destinations.',
  },
];

const MOCK_PATTERNS: PatternRule[] = [
  {
    id: 'SG020',
    pattern: /return\s*\{\s*success\s*:\s*true\s*\}/g,
    severity: vscode.DiagnosticSeverity.Warning,
    message: 'Suspicious stub: returning { success: true } without real logic',
    remediation: 'Ensure this is intentional. In production code, implement real validation and business logic.',
  },
  {
    id: 'SG021',
    pattern: /(?:const|let|var)\s+\w+\s*=\s*\[\s*\{\s*id\s*:\s*(?:1|['"]1['"])\s*,\s*(?:name|title)\s*:\s*['"](?:test|example|sample|placeholder|todo|foo|bar)/gi,
    severity: vscode.DiagnosticSeverity.Warning,
    message: 'Placeholder data detected — likely a mock or stub',
    remediation: 'Replace placeholder data with real data sources before shipping.',
  },
];

const AUTH_PATTERNS: PatternRule[] = [
  {
    id: 'SG050',
    pattern: /jwt\.sign\s*\([^,]+,\s*['"]/g,
    severity: vscode.DiagnosticSeverity.Error,
    message: 'Hardcoded JWT secret — use an environment variable (process.env.JWT_SECRET)',
    remediation: 'Store JWT secrets in environment variables, never in source code.',
  },
  {
    id: 'SG051',
    pattern: /(?:password\s*===\s|===\s*password)/g,
    severity: vscode.DiagnosticSeverity.Warning,
    message: 'Timing-unsafe password comparison — use crypto.timingSafeEqual() or bcrypt.compare()',
    remediation: 'Use a constant-time comparison function to prevent timing attacks.',
  },
  {
    id: 'SG052',
    pattern: /(?:\[['"]__proto__['"]\]|\[['"]constructor['"]\]\s*\[['"]prototype['"]\]|__proto__\s*=)/g,
    severity: vscode.DiagnosticSeverity.Error,
    message: 'Potential prototype pollution — validate and sanitize object keys',
    remediation: 'Filter or reject keys like __proto__, constructor, and prototype.',
  },
  {
    id: 'SG053',
    pattern: /(?:cors\s*\(\s*\)|origin\s*:\s*(?:true|['"]?\*['"]?))/g,
    severity: vscode.DiagnosticSeverity.Warning,
    message: 'Overly permissive CORS — restrict allowed origins to specific domains',
    remediation: 'Configure CORS with an explicit list of allowed origins.',
  },
];

const SUPPLY_CHAIN_PATTERNS: PatternRule[] = [
  {
    id: 'SG031',
    pattern: /(?:\bfs\.exists\b\s*\(|url\.parse\s*\(|new\s+Buffer\s*\()/g,
    severity: vscode.DiagnosticSeverity.Warning,
    message: 'Deprecated Node.js API — use the modern equivalent (fs.access, new URL(), Buffer.from())',
    remediation: 'Replace deprecated APIs with their modern counterparts.',
  },
  {
    id: 'SG032',
    pattern: /\brequire\s*\(\s*[^'"]/g,
    severity: vscode.DiagnosticSeverity.Warning,
    message: 'Dynamic require with variable — potential security risk and import resolution issue',
    remediation: 'Use static imports or validate the module path against an allowlist.',
  },
  {
    id: 'SG033',
    pattern: /new\s+RegExp\s*\(\s*(?:req\.|request\.|params\.)/g,
    severity: vscode.DiagnosticSeverity.Warning,
    message: 'Potential ReDoS — user input used in RegExp constructor',
    remediation: 'Validate and sanitize regex input, or use a safe regex library.',
  },
];

const IMPORT_ISSUE_PATTERN = /^import\s+(?:.*\s+from\s+)?['"]([^./][^'"]*)['"]/;

// ─────────────────────────────────────────────────────────────────────────────
// Analyzer
// ─────────────────────────────────────────────────────────────────────────────

let diagnosticCollection: vscode.DiagnosticCollection;
let debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
let disposed = false;
const DEBOUNCE_MS = 500;

function analyzeDocument(document: vscode.TextDocument): vscode.Diagnostic[] {
  const text = document.getText();
  const diagnostics: vscode.Diagnostic[] = [];
  const allPatterns = [...SECURITY_PATTERNS, ...TAINT_PATTERNS, ...MOCK_PATTERNS, ...AUTH_PATTERNS, ...SUPPLY_CHAIN_PATTERNS];

  for (const rule of allPatterns) {
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(text)) !== null) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPos, endPos);

      const diag = new vscode.Diagnostic(
        range,
        `${rule.message}. ${rule.remediation}`,
        rule.severity,
      );
      diag.source = 'ShipGate';
      diag.code = rule.id;
      diagnostics.push(diag);
    }
  }

  checkImports(document, text, diagnostics);
  checkMultiLinePatterns(document, text, diagnostics);

  return diagnostics;
}

function checkImports(
  document: vscode.TextDocument,
  text: string,
  diagnostics: vscode.Diagnostic[],
): void {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!workspaceFolder) return;

  let packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null = null;

  try {
    const fs = require('fs');
    const pathMod = require('path');
    let dir = pathMod.dirname(document.uri.fsPath);
    const root = workspaceFolder.uri.fsPath;

    while (dir.length >= root.length) {
      const pkgPath = pathMod.join(dir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        break;
      }
      const parent = pathMod.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    return;
  }

  if (!packageJson) return;

  const allDeps = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
    'path', 'fs', 'os', 'url', 'util', 'crypto', 'http', 'https', 'stream',
    'events', 'buffer', 'child_process', 'net', 'tls', 'dns', 'zlib',
    'querystring', 'assert', 'timers', 'console', 'process', 'worker_threads',
    'perf_hooks', 'readline', 'cluster', 'v8', 'vm',
    'node:path', 'node:fs', 'node:os', 'node:url', 'node:util', 'node:crypto',
    'node:http', 'node:https', 'node:stream', 'node:events', 'node:buffer',
    'node:child_process', 'node:net', 'node:tls', 'node:dns', 'node:zlib',
    'node:querystring', 'node:assert', 'node:timers', 'node:console',
    'node:process', 'node:worker_threads', 'node:perf_hooks', 'node:readline',
    'node:cluster', 'node:v8', 'node:vm', 'node:test',
  ]);

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const match = IMPORT_ISSUE_PATTERN.exec(line);
    if (!match) continue;

    const pkgName = match[1]!;
    const resolved = pkgName.startsWith('@') ? pkgName.split('/').slice(0, 2).join('/') : pkgName.split('/')[0]!;

    if (!allDeps.has(resolved)) {
      const startCol = line.indexOf(pkgName);
      const range = new vscode.Range(i, startCol, i, startCol + pkgName.length);
      const diag = new vscode.Diagnostic(
        range,
        `Import "${resolved}" not found in nearest package.json. Possible hallucinated dependency.`,
        vscode.DiagnosticSeverity.Warning,
      );
      diag.source = 'ShipGate';
      diag.code = 'SG030';
      diagnostics.push(diag);
    }
  }
}

function checkMultiLinePatterns(
  document: vscode.TextDocument,
  text: string,
  diagnostics: vscode.Diagnostic[],
): void {
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // SG040: Module-level mutable state (let/var at indentation level 0)
    if (/^(?:let|var)\s+\w+\s*=/.test(line)) {
      const range = new vscode.Range(i, 0, i, line.length);
      const diag = new vscode.Diagnostic(
        range,
        'Module-level mutable state — may cause race conditions in concurrent request handlers. Consider using const or scoping state inside functions.',
        vscode.DiagnosticSeverity.Warning,
      );
      diag.source = 'ShipGate';
      diag.code = 'SG040';
      diagnostics.push(diag);
    }

    // SG041: Read-then-write without transaction
    if (/await\s+\w+\.find/.test(line)) {
      const end = Math.min(i + 10, lines.length - 1);
      for (let j = i + 1; j <= end; j++) {
        if (/await\s+\w+\.(?:save|update)/.test(lines[j]!)) {
          const range = new vscode.Range(j, 0, j, lines[j]!.length);
          const diag = new vscode.Diagnostic(
            range,
            'Read-then-write without transaction — potential race condition. Wrap in a transaction.',
            vscode.DiagnosticSeverity.Warning,
          );
          diag.source = 'ShipGate';
          diag.code = 'SG041';
          diagnostics.push(diag);
          break;
        }
      }
    }

    // SG042: TOCTOU (time-of-check-to-time-of-use)
    if (/existsSync\s*\(/.test(line)) {
      const end = Math.min(i + 5, lines.length - 1);
      for (let j = i + 1; j <= end; j++) {
        if (/(?:readFileSync|readFile)\s*\(/.test(lines[j]!)) {
          const range = new vscode.Range(j, 0, j, lines[j]!.length);
          const diag = new vscode.Diagnostic(
            range,
            'Time-of-check-to-time-of-use — file may change between check and use. Use fs.access() with a try/catch around the read instead.',
            vscode.DiagnosticSeverity.Warning,
          );
          diag.source = 'ShipGate';
          diag.code = 'SG042';
          diagnostics.push(diag);
          break;
        }
      }
    }
  }
}

function onDocumentChange(event: vscode.TextDocumentChangeEvent): void {
  if (disposed) return;
  const doc = event.document;
  if (!SUPPORTED_LANGUAGES.has(doc.languageId)) return;

  const config = vscode.workspace.getConfiguration('shipgate');
  if (!config.get('inlineAnalysis.enabled', true)) return;

  const key = doc.uri.toString();
  const existing = debounceTimers.get(key);
  if (existing) clearTimeout(existing);

  debounceTimers.set(
    key,
    setTimeout(() => {
      debounceTimers.delete(key);
      if (disposed) return;
      const diagnostics = analyzeDocument(doc);
      diagnosticCollection.set(doc.uri, diagnostics);
    }, DEBOUNCE_MS),
  );
}

function onDocumentClose(document: vscode.TextDocument): void {
  diagnosticCollection.delete(document.uri);
  const key = document.uri.toString();
  const timer = debounceTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    debounceTimers.delete(key);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
  disposed = false;
  diagnosticCollection = vscode.languages.createDiagnosticCollection('shipgate-inline');
  context.subscriptions.push(diagnosticCollection);

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(onDocumentChange),
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(onDocumentClose),
  );

  for (const editor of vscode.window.visibleTextEditors) {
    if (SUPPORTED_LANGUAGES.has(editor.document.languageId)) {
      const diagnostics = analyzeDocument(editor.document);
      diagnosticCollection.set(editor.document.uri, diagnostics);
    }
  }
}

export function deactivate(): void {
  disposed = true;
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();
  if (diagnosticCollection) {
    diagnosticCollection.dispose();
  }
}
