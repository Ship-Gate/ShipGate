/**
 * Navigation Helpers
 * 
 * Functions to navigate to source locations from evidence reports.
 * Handles opening files and revealing ranges in the VS Code editor.
 */

import * as vscode from 'vscode';
import type { SourceLocation, ClauseResult, EvidenceReport } from './types';
import { getHighestImpactFailure } from './types';

/**
 * Open a file and reveal a source location
 */
export async function navigateToLocation(location: SourceLocation): Promise<vscode.TextEditor | undefined> {
  try {
    const uri = vscode.Uri.file(location.filePath);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document, {
      preview: false,
      preserveFocus: false
    });

    // Create range from location (convert 1-based line to 0-based)
    const startLine = Math.max(0, location.startLine - 1);
    const endLine = Math.max(0, location.endLine - 1);
    const startCol = location.startColumn ?? 0;
    const endCol = location.endColumn ?? document.lineAt(endLine).text.length;

    const range = new vscode.Range(
      new vscode.Position(startLine, startCol),
      new vscode.Position(endLine, endCol)
    );

    // Select and reveal the range
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);

    // Highlight the range temporarily
    highlightRange(editor, range);

    return editor;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to navigate to location: ${message}`);
    return undefined;
  }
}

/**
 * Navigate to a specific clause
 */
export async function navigateToClause(clause: ClauseResult): Promise<vscode.TextEditor | undefined> {
  if (!clause.location) {
    vscode.window.showWarningMessage(`Clause "${clause.name}" has no source location`);
    return undefined;
  }

  return navigateToLocation(clause.location);
}

/**
 * Navigate to the highest-impact failing clause ("Fix Next")
 */
export async function navigateToNextFailure(report: EvidenceReport): Promise<ClauseResult | undefined> {
  const failingClause = getHighestImpactFailure(report.clauses);
  
  if (!failingClause) {
    vscode.window.showInformationMessage('No failing clauses found!');
    return undefined;
  }

  if (!failingClause.location) {
    vscode.window.showWarningMessage(
      `Highest-impact failure "${failingClause.name}" has no source location`
    );
    return failingClause;
  }

  await navigateToLocation(failingClause.location);

  // Show diagnostic message about the failure
  if (failingClause.message) {
    vscode.window.showWarningMessage(
      `Fix: ${failingClause.name} - ${failingClause.message}`,
      'Show Details'
    ).then(selection => {
      if (selection === 'Show Details') {
        showClauseDetails(failingClause);
      }
    });
  }

  return failingClause;
}

/**
 * Highlight a range temporarily with a decoration
 */
function highlightRange(editor: vscode.TextEditor, range: vscode.Range): void {
  const decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
    borderColor: new vscode.ThemeColor('editor.findMatchBorder'),
    borderWidth: '1px',
    borderStyle: 'solid',
    isWholeLine: false
  });

  editor.setDecorations(decorationType, [range]);

  // Remove highlight after 2 seconds
  setTimeout(() => {
    decorationType.dispose();
  }, 2000);
}

/**
 * Show clause details in an information message or output channel
 */
export function showClauseDetails(clause: ClauseResult): void {
  const lines: string[] = [
    `Clause: ${clause.name}`,
    `Status: ${clause.status}`,
    `Category: ${clause.category}`,
  ];

  if (clause.message) {
    lines.push(`Message: ${clause.message}`);
  }

  if (clause.expected !== undefined) {
    lines.push(`Expected: ${clause.expected}`);
  }

  if (clause.actual !== undefined) {
    lines.push(`Actual: ${clause.actual}`);
  }

  if (clause.suggestedFix) {
    lines.push(`Suggested Fix: ${clause.suggestedFix}`);
  }

  if (clause.location) {
    lines.push(`Location: ${clause.location.filePath}:${clause.location.startLine}`);
  }

  // Show in output channel
  const outputChannel = vscode.window.createOutputChannel('ISL Clause Details', { log: true });
  outputChannel.appendLine('─'.repeat(50));
  lines.forEach(line => outputChannel.appendLine(line));
  if (clause.stackTrace) {
    outputChannel.appendLine('─'.repeat(50));
    outputChannel.appendLine('Stack Trace:');
    outputChannel.appendLine(clause.stackTrace);
  }
  outputChannel.appendLine('─'.repeat(50));
  outputChannel.show();
}

/**
 * Create diagnostics for failed clauses
 */
export function createDiagnosticsFromReport(
  report: EvidenceReport
): Map<vscode.Uri, vscode.Diagnostic[]> {
  const diagnosticsMap = new Map<vscode.Uri, vscode.Diagnostic[]>();

  for (const clause of report.clauses) {
    if (clause.status !== 'FAIL' || !clause.location) continue;

    const uri = vscode.Uri.file(clause.location.filePath);
    const existingDiagnostics = diagnosticsMap.get(uri) ?? [];

    const startLine = Math.max(0, clause.location.startLine - 1);
    const endLine = Math.max(0, clause.location.endLine - 1);
    const startCol = clause.location.startColumn ?? 0;
    const endCol = clause.location.endColumn ?? 1000; // Default to end of line

    const range = new vscode.Range(
      new vscode.Position(startLine, startCol),
      new vscode.Position(endLine, endCol)
    );

    const severity = clause.impact === 'critical' || clause.impact === 'high'
      ? vscode.DiagnosticSeverity.Error
      : vscode.DiagnosticSeverity.Warning;

    const diagnostic = new vscode.Diagnostic(
      range,
      `[ISL] ${clause.name}: ${clause.message ?? 'Verification failed'}`,
      severity
    );

    diagnostic.source = 'ISL Evidence';
    diagnostic.code = clause.id;

    existingDiagnostics.push(diagnostic);
    diagnosticsMap.set(uri, existingDiagnostics);
  }

  return diagnosticsMap;
}

/**
 * Apply diagnostics to a diagnostic collection
 */
export function applyDiagnostics(
  collection: vscode.DiagnosticCollection,
  report: EvidenceReport
): void {
  collection.clear();
  const diagnosticsMap = createDiagnosticsFromReport(report);
  
  for (const [uri, diagnostics] of diagnosticsMap) {
    collection.set(uri, diagnostics);
  }
}

/**
 * Create code lens items for failed clauses
 */
export function createCodeLensesForReport(
  report: EvidenceReport,
  document: vscode.TextDocument
): vscode.CodeLens[] {
  const lenses: vscode.CodeLens[] = [];

  for (const clause of report.clauses) {
    if (clause.status !== 'FAIL' || !clause.location) continue;
    if (clause.location.filePath !== document.uri.fsPath) continue;

    const startLine = Math.max(0, clause.location.startLine - 1);
    const range = new vscode.Range(
      new vscode.Position(startLine, 0),
      new vscode.Position(startLine, 0)
    );

    const command: vscode.Command = {
      title: `⚠️ ${clause.name}: ${clause.message ?? 'Fix required'}`,
      command: 'isl.reportViewer.navigateToClause',
      arguments: [clause]
    };

    lenses.push(new vscode.CodeLens(range, command));
  }

  return lenses;
}
