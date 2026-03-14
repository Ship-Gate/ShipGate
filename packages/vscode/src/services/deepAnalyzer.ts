import * as vscode from 'vscode';

const deepDiagnostics = vscode.languages.createDiagnosticCollection('shipgate-deep');

interface DeepFinding {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  engine: string;
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(deepDiagnostics);

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      const config = vscode.workspace.getConfiguration('shipgate');
      if (!config.get('deepAnalysis.onSave', false)) return;

      const lang = doc.languageId;
      if (!['typescript', 'typescriptreact', 'javascript', 'javascriptreact'].includes(lang)) return;

      await runDeepAnalysis(doc);
    })
  );
}

async function runDeepAnalysis(doc: vscode.TextDocument): Promise<void> {
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Window, title: 'ShipGate: Deep analysis...' },
    async () => {
      try {
        const content = doc.getText();
        const findings: DeepFinding[] = [];

        runSecurityDeepChecks(content, doc.uri.fsPath, findings);
        runTaintDetection(content, doc.uri.fsPath, findings);

        const diagnostics: vscode.Diagnostic[] = findings.map(f => {
          const line = Math.max(0, f.line - 1);
          const range = new vscode.Range(line, 0, line, doc.lineAt(Math.min(line, doc.lineCount - 1)).text.length);
          const severity = f.severity === 'error' ? vscode.DiagnosticSeverity.Error
            : f.severity === 'warning' ? vscode.DiagnosticSeverity.Warning
            : vscode.DiagnosticSeverity.Information;
          const diag = new vscode.Diagnostic(range, f.message, severity);
          diag.source = 'ShipGate (deep)';
          diag.code = { value: f.code, target: vscode.Uri.parse(`https://shipgate.dev/docs/rules/${f.code}`) };
          return diag;
        });

        deepDiagnostics.set(doc.uri, diagnostics);
      } catch {
        // Deep analysis failure should never block the developer
      }
    }
  );
}

function runSecurityDeepChecks(content: string, filePath: string, findings: DeepFinding[]): void {
  const lines = content.split('\n');

  const sqlVarPattern = /(?:const|let|var)\s+(\w+)\s*=\s*(?:`[^`]*\$\{|['"][^'"]*\+)/;
  const sqlExecPattern = /\.(?:query|execute|raw|prepare)\s*\(/;

  for (let i = 0; i < lines.length; i++) {
    const sqlVarMatch = sqlVarPattern.exec(lines[i]);
    if (sqlVarMatch) {
      const varName = sqlVarMatch[1];
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        if (lines[j].includes(varName) && sqlExecPattern.test(lines[j])) {
          findings.push({
            file: filePath, line: i + 1, column: 0, severity: 'error',
            code: 'SGD001', message: `SQL injection: tainted variable "${varName}" flows to query execution at line ${j + 1}`,
            engine: 'deep-security',
          });
          break;
        }
      }
    }
  }

  const redirectPattern = /res\.redirect\s*\(\s*req\./;
  for (let i = 0; i < lines.length; i++) {
    if (redirectPattern.test(lines[i])) {
      findings.push({
        file: filePath, line: i + 1, column: 0, severity: 'error',
        code: 'SGD002', message: 'Open redirect: user-controlled URL in res.redirect() — validate against an allowlist',
        engine: 'deep-security',
      });
    }
  }

  const mathRandom = /Math\.random\s*\(\)/;
  const securityContext = /(?:token|secret|key|password|nonce|salt|iv|session)/i;
  for (let i = 0; i < lines.length; i++) {
    if (mathRandom.test(lines[i]) && securityContext.test(lines[i])) {
      findings.push({
        file: filePath, line: i + 1, column: 0, severity: 'warning',
        code: 'SGD003', message: 'Insecure random: Math.random() used in security context — use crypto.randomBytes() instead',
        engine: 'deep-security',
      });
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (/async\s+(?:function|\()/.test(lines[i])) {
      let hasTryCatch = false;
      let braceDepth = 0;
      for (let j = i; j < Math.min(i + 50, lines.length); j++) {
        braceDepth += (lines[j].match(/\{/g) || []).length;
        braceDepth -= (lines[j].match(/\}/g) || []).length;
        if (/\btry\s*\{/.test(lines[j]) || /\.catch\s*\(/.test(lines[j])) {
          hasTryCatch = true;
          break;
        }
        if (braceDepth <= 0 && j > i) break;
      }
      if (!hasTryCatch && /await\s+/.test(content.slice(content.indexOf(lines[i])))) {
        findings.push({
          file: filePath, line: i + 1, column: 0, severity: 'info',
          code: 'SGD004', message: 'Async function with await but no error handling — add try/catch or .catch()',
          engine: 'deep-security',
        });
      }
    }
  }
}

function runTaintDetection(content: string, filePath: string, findings: DeepFinding[]): void {
  const lines = content.split('\n');

  const taintedVars = new Set<string>();
  const sourcePattern = /(?:const|let|var)\s+(\w+)\s*=\s*req\.(?:body|query|params|headers)/;
  const destructPattern = /const\s*\{([^}]+)\}\s*=\s*req\.(?:body|query|params)/;

  for (let i = 0; i < lines.length; i++) {
    const sourceMatch = sourcePattern.exec(lines[i]);
    if (sourceMatch) taintedVars.add(sourceMatch[1]);

    const destructMatch = destructPattern.exec(lines[i]);
    if (destructMatch) {
      for (const v of destructMatch[1].split(',')) {
        const name = v.trim().split(':')[0].split('=')[0].trim();
        if (name) taintedVars.add(name);
      }
    }
  }

  const sinkPatterns = [
    { pattern: /\.query\s*\(/, category: 'SQL query', code: 'SGD010' },
    { pattern: /\.execute\s*\(/, category: 'SQL execution', code: 'SGD010' },
    { pattern: /exec\s*\(/, category: 'shell command', code: 'SGD011' },
    { pattern: /\.innerHTML\s*=/, category: 'DOM injection', code: 'SGD012' },
    { pattern: /eval\s*\(/, category: 'eval injection', code: 'SGD013' },
    { pattern: /\.writeFile\s*\(/, category: 'file write', code: 'SGD014' },
  ];

  for (let i = 0; i < lines.length; i++) {
    for (const taintVar of taintedVars) {
      if (!lines[i].includes(taintVar)) continue;
      for (const sink of sinkPatterns) {
        if (sink.pattern.test(lines[i])) {
          findings.push({
            file: filePath, line: i + 1, column: 0, severity: 'error',
            code: sink.code,
            message: `Taint flow: "${taintVar}" (user input) reaches ${sink.category} without sanitization`,
            engine: 'taint',
          });
        }
      }
    }
  }
}

export function deactivate(): void {
  deepDiagnostics.dispose();
}
