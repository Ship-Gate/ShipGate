/**
 * ShipGate: Coverage Overlay Command
 *
 * Shows which source files have ISL specs using gutter decorations:
 *   green  = specced (has matching .isl)
 *   yellow = specless (no .isl)
 *   red    = violation (spec exists but verification failed)
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** Per-file coverage status */
export interface FileCoverage {
  file: string;
  status: 'specced' | 'specless' | 'violation';
  specFile?: string;
}

/** Full coverage report */
export interface CoverageReport {
  files: FileCoverage[];
  specced: number;
  specless: number;
  violations: number;
  total: number;
}

// Gutter decoration types
let speccedDecoration: vscode.TextEditorDecorationType;
let speclessDecoration: vscode.TextEditorDecorationType;
let violationDecoration: vscode.TextEditorDecorationType;

let lastReport: CoverageReport | undefined;
let coverageEnabled = false;

/**
 * Register the coverage command and set up auto-refresh.
 */
export function registerCoverageCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
): void {
  // Create decoration types
  speccedDecoration = vscode.window.createTextEditorDecorationType({
    gutterIconPath: makeCircleSvgUri(context, '#4ec94e'),
    gutterIconSize: '60%',
    overviewRulerColor: '#4ec94e',
    overviewRulerLane: vscode.OverviewRulerLane.Left,
  });

  speclessDecoration = vscode.window.createTextEditorDecorationType({
    gutterIconPath: makeCircleSvgUri(context, '#e8b730'),
    gutterIconSize: '60%',
    overviewRulerColor: '#e8b730',
    overviewRulerLane: vscode.OverviewRulerLane.Left,
  });

  violationDecoration = vscode.window.createTextEditorDecorationType({
    gutterIconPath: makeCircleSvgUri(context, '#e05252'),
    gutterIconSize: '60%',
    overviewRulerColor: '#e05252',
    overviewRulerLane: vscode.OverviewRulerLane.Left,
  });

  context.subscriptions.push(speccedDecoration, speclessDecoration, violationDecoration);

  // Register the toggle command
  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.coverage', () =>
      toggleCoverage(outputChannel)
    )
  );

  // Auto-refresh on editor change
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      if (coverageEnabled) {
        applyDecorationsToVisibleEditors();
      }
    })
  );

  // Auto-refresh on save if configured
  const config = vscode.workspace.getConfiguration('shipgate');
  if (config.get<boolean>('coverage.autoRefresh', true)) {
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(async () => {
        if (coverageEnabled) {
          await refreshCoverage(outputChannel);
        }
      })
    );
  }
}

/**
 * Get the latest coverage report (for the status bar).
 */
export function getLastCoverageReport(): CoverageReport | undefined {
  return lastReport;
}

// ---------------------------------------------------------------------------
// Toggle and refresh
// ---------------------------------------------------------------------------

async function toggleCoverage(outputChannel: vscode.OutputChannel): Promise<void> {
  if (coverageEnabled) {
    coverageEnabled = false;
    clearAllDecorations();
    vscode.window.showInformationMessage('ShipGate: Coverage overlay hidden');
    return;
  }

  coverageEnabled = true;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'ShipGate: Scanning coverage...',
      cancellable: false,
    },
    async () => {
      await refreshCoverage(outputChannel);
    }
  );
}

async function refreshCoverage(outputChannel: vscode.OutputChannel): Promise<void> {
  const report = await fetchCoverageReport(outputChannel);
  lastReport = report;
  applyDecorationsToVisibleEditors();

  outputChannel.appendLine(
    `[ShipGate] Coverage: ${report.specced}/${report.total} specced, ` +
      `${report.specless} specless, ${report.violations} violations`
  );
}

// ---------------------------------------------------------------------------
// CLI invocation
// ---------------------------------------------------------------------------

async function fetchCoverageReport(
  outputChannel: vscode.OutputChannel
): Promise<CoverageReport> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    return emptyReport();
  }

  try {
    const { stdout } = await execFileAsync('shipgate', ['coverage', '--format', 'json'], {
      cwd: workspaceRoot,
      timeout: 30_000,
    });
    return parseCoverageOutput(stdout);
  } catch {
    try {
      const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      const { stdout } = await execFileAsync(npx, ['shipgate', 'coverage', '--format', 'json'], {
        cwd: workspaceRoot,
        timeout: 60_000,
      });
      return parseCoverageOutput(stdout);
    } catch {
      outputChannel.appendLine(
        '[ShipGate] Coverage CLI not available — falling back to ISL file scan'
      );
      return await scanIslFiles(workspaceRoot);
    }
  }
}

function parseCoverageOutput(stdout: string): CoverageReport {
  try {
    const parsed = JSON.parse(stdout) as CoverageReport;
    return {
      files: parsed.files ?? [],
      specced: parsed.specced ?? 0,
      specless: parsed.specless ?? 0,
      violations: parsed.violations ?? 0,
      total: parsed.total ?? 0,
    };
  } catch {
    return emptyReport();
  }
}

/**
 * Fallback: scan for .isl files and match against source files.
 */
async function scanIslFiles(workspaceRoot: string): Promise<CoverageReport> {
  const islFiles = await vscode.workspace.findFiles('**/*.isl', '**/node_modules/**');
  const islBasenames = new Set<string>();

  for (const uri of islFiles) {
    const base = path.basename(uri.fsPath, '.isl');
    islBasenames.add(base.toLowerCase());
  }

  const sourceFiles = await vscode.workspace.findFiles(
    '**/*.{ts,tsx,js,jsx}',
    '**/node_modules/**'
  );

  const files: FileCoverage[] = [];
  let specced = 0;
  let specless = 0;

  for (const uri of sourceFiles) {
    const rel = path.relative(workspaceRoot, uri.fsPath);
    const base = path.basename(uri.fsPath).replace(/\.[^.]+$/, '').toLowerCase();
    const hasSpec = islBasenames.has(base);

    files.push({
      file: rel,
      status: hasSpec ? 'specced' : 'specless',
    });

    if (hasSpec) specced++;
    else specless++;
  }

  return {
    files,
    specced,
    specless,
    violations: 0,
    total: files.length,
  };
}

// ---------------------------------------------------------------------------
// Decoration application
// ---------------------------------------------------------------------------

function applyDecorationsToVisibleEditors(): void {
  if (!lastReport) return;

  for (const editor of vscode.window.visibleTextEditors) {
    applyDecorationsToEditor(editor);
  }
}

function applyDecorationsToEditor(editor: vscode.TextEditor): void {
  if (!lastReport) return;

  const filePath = editor.document.uri.fsPath;
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  const relativePath = path.relative(workspaceRoot, filePath);

  const entry = lastReport.files.find(
    (f) =>
      f.file === relativePath ||
      f.file === filePath ||
      path.resolve(workspaceRoot, f.file) === filePath
  );

  if (!entry) {
    // Clear decorations for files not in the report
    editor.setDecorations(speccedDecoration, []);
    editor.setDecorations(speclessDecoration, []);
    editor.setDecorations(violationDecoration, []);
    return;
  }

  // Apply a subtle decoration to line 0 (file-level indicator)
  const firstLineRange = new vscode.Range(0, 0, 0, 0);
  const hoverMessage =
    entry.status === 'specced'
      ? `ISL: Spec found${entry.specFile ? ` (${entry.specFile})` : ''}`
      : entry.status === 'violation'
        ? 'ISL: Spec verification failed'
        : 'ISL: No spec found — run ShipGate: Generate ISL Spec';

  const decoration: vscode.DecorationOptions = {
    range: firstLineRange,
    hoverMessage: new vscode.MarkdownString(hoverMessage),
  };

  editor.setDecorations(speccedDecoration, entry.status === 'specced' ? [decoration] : []);
  editor.setDecorations(speclessDecoration, entry.status === 'specless' ? [decoration] : []);
  editor.setDecorations(violationDecoration, entry.status === 'violation' ? [decoration] : []);
}

function clearAllDecorations(): void {
  for (const editor of vscode.window.visibleTextEditors) {
    editor.setDecorations(speccedDecoration, []);
    editor.setDecorations(speclessDecoration, []);
    editor.setDecorations(violationDecoration, []);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyReport(): CoverageReport {
  return { files: [], specced: 0, specless: 0, violations: 0, total: 0 };
}

/**
 * Create an inline SVG data URI for a gutter circle icon.
 */
function makeCircleSvgUri(_context: vscode.ExtensionContext, color: string): vscode.Uri {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="5" fill="${color}"/></svg>`;
  return vscode.Uri.parse(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
}
