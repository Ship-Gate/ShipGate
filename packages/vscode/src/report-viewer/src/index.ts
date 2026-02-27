/**
 * Report Viewer Module
 * 
 * VS Code extension module for viewing evidence reports with
 * clause-level navigation and "Fix Next" workflow.
 * 
 * @example
 * ```typescript
 * import { activateReportViewer, ReportViewerPanel } from './report-viewer';
 * 
 * // In extension activate:
 * activateReportViewer(context);
 * 
 * // Show report:
 * ReportViewerPanel.createOrShow(context.extensionUri, report);
 * ```
 */

import * as vscode from 'vscode';
import { ReportViewerPanel, ReportViewerSerializer } from './ReportViewerPanel';
import { navigateToLocation, navigateToClause, navigateToNextFailure } from './navigation';
import type { EvidenceReport, ClauseResult, SourceLocation } from './types';

export { ReportViewerPanel, ReportViewerSerializer } from './ReportViewerPanel';
export { navigateToLocation, navigateToClause, navigateToNextFailure, showClauseDetails, applyDiagnostics } from './navigation';
export * from './types';

/**
 * Activate the report viewer feature
 * 
 * Registers commands and webview serializer for the report viewer.
 * Call this from your extension's activate function.
 * 
 * @param context - VS Code extension context
 */
export function activateReportViewer(context: vscode.ExtensionContext): void {
  // Register webview serializer for persistence
  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer(
      ReportViewerPanel.viewType,
      new ReportViewerSerializer(context.extensionUri)
    )
  );

  // Command: Open Report Viewer
  context.subscriptions.push(
    vscode.commands.registerCommand('isl.reportViewer.open', () => {
      ReportViewerPanel.createOrShow(context.extensionUri);
    })
  );

  // Command: Open Report from JSON file
  context.subscriptions.push(
    vscode.commands.registerCommand('isl.reportViewer.openFile', async (uri?: vscode.Uri) => {
      let fileUri = uri;
      
      // If no URI provided, prompt user to select a file
      if (!fileUri) {
        const selected = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters: {
            'Evidence Reports': ['json'],
            'All Files': ['*']
          },
          title: 'Open Evidence Report'
        });
        
        if (!selected || selected.length === 0) {
          return;
        }
        fileUri = selected[0];
      }

      try {
        const document = await vscode.workspace.openTextDocument(fileUri);
        const content = document.getText();
        const report = JSON.parse(content) as EvidenceReport;
        
        // Validate basic structure
        if (!report.version || !report.metadata || !report.clauses) {
          throw new Error('Invalid evidence report format');
        }
        
        const panel = ReportViewerPanel.createOrShow(context.extensionUri, report);
        vscode.window.showInformationMessage(`Loaded evidence report: ${report.clauses.length} clauses`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to load report: ${message}`);
      }
    })
  );

  // Command: Load report programmatically
  context.subscriptions.push(
    vscode.commands.registerCommand('isl.reportViewer.loadReport', (report: EvidenceReport) => {
      const panel = ReportViewerPanel.createOrShow(context.extensionUri, report);
      return panel;
    })
  );

  // Command: Navigate to clause
  context.subscriptions.push(
    vscode.commands.registerCommand('isl.reportViewer.navigateToClause', async (clause: ClauseResult) => {
      await navigateToClause(clause);
    })
  );

  // Command: Fix Next (navigate to highest-impact failure)
  context.subscriptions.push(
    vscode.commands.registerCommand('isl.reportViewer.fixNext', async () => {
      const panel = ReportViewerPanel.getCurrent();
      if (!panel) {
        vscode.window.showWarningMessage('No report viewer open');
        return;
      }
      
      const report = panel.getReport();
      if (!report) {
        vscode.window.showWarningMessage('No report loaded');
        return;
      }
      
      const clause = await navigateToNextFailure(report);
      if (clause) {
        panel.highlightClause(clause.id);
      }
    })
  );

  // Command: Refresh report
  context.subscriptions.push(
    vscode.commands.registerCommand('isl.reportViewer.refresh', async () => {
      const panel = ReportViewerPanel.getCurrent();
      if (panel) {
        panel.setLoading(true);
        // Extension can listen to this and update the report
        // For now, just turn off loading after a delay
        setTimeout(() => {
          panel.setLoading(false);
        }, 500);
      }
    })
  );

  // Command: Navigate to location
  context.subscriptions.push(
    vscode.commands.registerCommand('isl.reportViewer.navigateToLocation', async (location: SourceLocation) => {
      await navigateToLocation(location);
    })
  );
}

/**
 * Deactivate the report viewer feature
 * 
 * Disposes any active report viewer panels.
 */
export function deactivateReportViewer(): void {
  const panel = ReportViewerPanel.getCurrent();
  if (panel) {
    panel.dispose();
  }
}
