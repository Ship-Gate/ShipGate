/**
 * ISL Quick Fixes Provider
 * 
 * Provides code actions (quick fixes) for ISL diagnostics.
 * Supports:
 * - Add missing postconditions block
 * - Add version header
 * - Normalize formatting (canonical printer)
 */

import * as vscode from 'vscode';
import { ISL_LANGUAGE_ID, isISLDocument } from './islSelector';
import { ISLDiagnosticCode, ISL_DIAGNOSTIC_SOURCE } from './diagnostics';

// ============================================================================
// Types
// ============================================================================

/** Quick fix kind identifiers */
export const ISL_QUICK_FIX_KIND = vscode.CodeActionKind.QuickFix.append('isl');
export const ISL_REFACTOR_KIND = vscode.CodeActionKind.Refactor.append('isl');

/** Options for the quick fixes provider */
export interface ISLQuickFixesOptions {
  /** Whether to enable format normalization (requires canonical printer) */
  enableFormatting?: boolean;
}

// ============================================================================
// Canonical Printer Integration (optional)
// ============================================================================

let canonicalPrinterAvailable = false;
let formatISL: ((source: string) => string) | undefined;

// Attempt to load the canonical printer dynamically
async function loadCanonicalPrinter(): Promise<void> {
  try {
    // Try to import the formatter/printer
    const formatter = await import('@isl-lang/parser');
    if (typeof formatter.format === 'function') {
      formatISL = formatter.format as (source: string) => string;
      canonicalPrinterAvailable = true;
    }
  } catch {
    try {
      // Try isl-core
      const core = await import('@isl-lang/isl-core');
      if (typeof (core as { format?: unknown }).format === 'function') {
        formatISL = (core as { format: (source: string) => string }).format;
        canonicalPrinterAvailable = true;
      }
    } catch {
      canonicalPrinterAvailable = false;
    }
  }
}

// Initialize on module load
loadCanonicalPrinter().catch(() => {/* ignore */});

// ============================================================================
// Quick Fixes Provider
// ============================================================================

/**
 * ISL Quick Fixes Provider
 * 
 * Provides code actions for fixing ISL diagnostics:
 * - Add missing postconditions block
 * - Add version header to domain
 * - Normalize formatting using canonical printer
 */
export class ISLQuickFixesProvider implements vscode.CodeActionProvider, vscode.Disposable {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
    vscode.CodeActionKind.Refactor,
  ];

  private readonly disposables: vscode.Disposable[] = [];
  private readonly options: ISLQuickFixesOptions;

  constructor(options: ISLQuickFixesOptions = {}) {
    this.options = {
      enableFormatting: true,
      ...options,
    };
  }

  /**
   * Register the quick fixes provider with VS Code.
   */
  public register(context: vscode.ExtensionContext): void {
    const registration = vscode.languages.registerCodeActionsProvider(
      { language: ISL_LANGUAGE_ID, scheme: 'file' },
      this,
      {
        providedCodeActionKinds: ISLQuickFixesProvider.providedCodeActionKinds,
      }
    );
    
    this.disposables.push(registration);
    context.subscriptions.push(registration);
  }

  /**
   * Provide code actions for the given document and range.
   */
  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
    if (!isISLDocument(document)) {
      return [];
    }

    const actions: vscode.CodeAction[] = [];

    // Process diagnostics for quick fixes
    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== ISL_DIAGNOSTIC_SOURCE) {
        continue;
      }

      const diagnosticActions = this.getActionsForDiagnostic(document, diagnostic);
      actions.push(...diagnosticActions);
    }

    // Add refactoring actions (always available)
    if (this.options.enableFormatting) {
      const formatAction = this.createNormalizeFormattingAction(document);
      if (formatAction) {
        actions.push(formatAction);
      }
    }

    return actions;
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }

  // ============================================================================
  // Diagnostic-Specific Actions
  // ============================================================================

  private getActionsForDiagnostic(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    const code = diagnostic.code;

    switch (code) {
      case ISLDiagnosticCode.MISSING_POSTCONDITIONS:
        actions.push(this.createAddPostconditionsAction(document, diagnostic));
        break;

      case ISLDiagnosticCode.MISSING_VERSION:
        actions.push(this.createAddVersionAction(document, diagnostic));
        break;

      case ISLDiagnosticCode.MISSING_DESCRIPTION:
        actions.push(this.createAddDescriptionAction(document, diagnostic));
        break;

      case ISLDiagnosticCode.EMPTY_PRECONDITIONS:
      case ISLDiagnosticCode.EMPTY_POSTCONDITIONS:
        actions.push(this.createAddConditionPlaceholderAction(document, diagnostic));
        break;

      case ISLDiagnosticCode.MISSING_ERROR_WHEN:
        actions.push(this.createAddErrorWhenAction(document, diagnostic));
        break;
    }

    return actions;
  }

  // ============================================================================
  // Quick Fix: Add Missing Postconditions
  // ============================================================================

  private createAddPostconditionsAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      'Add missing postconditions block',
      vscode.CodeActionKind.QuickFix
    );

    action.diagnostics = [diagnostic];
    action.isPreferred = true;

    // Find the behavior and determine where to insert postconditions
    const insertPosition = this.findPostconditionsInsertPosition(document, diagnostic.range);
    
    if (insertPosition) {
      const indent = this.getIndentation(document, diagnostic.range.start.line);
      const postconditionsBlock = this.generatePostconditionsBlock(indent);

      action.edit = new vscode.WorkspaceEdit();
      action.edit.insert(document.uri, insertPosition, postconditionsBlock);
    }

    return action;
  }

  private findPostconditionsInsertPosition(
    document: vscode.TextDocument,
    behaviorRange: vscode.Range
  ): vscode.Position | undefined {
    const text = document.getText();
    const behaviorLine = behaviorRange.start.line;

    // Find the behavior's closing brace
    let braceDepth = 0;
    let foundBehavior = false;

    for (let lineNum = behaviorLine; lineNum < document.lineCount; lineNum++) {
      const line = document.lineAt(lineNum).text;

      for (let col = 0; col < line.length; col++) {
        const char = line[col];
        
        if (char === '{') {
          braceDepth++;
          foundBehavior = true;
        } else if (char === '}') {
          braceDepth--;
          
          if (foundBehavior && braceDepth === 0) {
            // Insert before the closing brace
            return new vscode.Position(lineNum, 0);
          }
        }
      }
    }

    return undefined;
  }

  private generatePostconditionsBlock(indent: string): string {
    return `
${indent}  postconditions {
${indent}    success implies {
${indent}      // Add postcondition assertions here
${indent}    }
${indent}  }
`;
  }

  // ============================================================================
  // Quick Fix: Add Version Header
  // ============================================================================

  private createAddVersionAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      'Add version header',
      vscode.CodeActionKind.QuickFix
    );

    action.diagnostics = [diagnostic];
    action.isPreferred = true;

    // Find the position after 'domain Name {'
    const insertPosition = this.findVersionInsertPosition(document, diagnostic.range);
    
    if (insertPosition) {
      const indent = this.getIndentation(document, diagnostic.range.start.line);
      const versionLine = `${indent}  version: "1.0.0"\n`;

      action.edit = new vscode.WorkspaceEdit();
      action.edit.insert(document.uri, insertPosition, versionLine);
    }

    return action;
  }

  private findVersionInsertPosition(
    document: vscode.TextDocument,
    domainRange: vscode.Range
  ): vscode.Position | undefined {
    const lineNum = domainRange.start.line;
    const line = document.lineAt(lineNum).text;

    // Check if the opening brace is on this line
    const braceIndex = line.indexOf('{');
    if (braceIndex !== -1) {
      // Insert after the opening brace, on the next line
      return new vscode.Position(lineNum + 1, 0);
    }

    // Otherwise, look for the opening brace on subsequent lines
    for (let i = lineNum + 1; i < document.lineCount; i++) {
      const nextLine = document.lineAt(i).text;
      const nextBraceIndex = nextLine.indexOf('{');
      if (nextBraceIndex !== -1) {
        return new vscode.Position(i + 1, 0);
      }
    }

    return undefined;
  }

  // ============================================================================
  // Quick Fix: Add Description
  // ============================================================================

  private createAddDescriptionAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      'Add description',
      vscode.CodeActionKind.QuickFix
    );

    action.diagnostics = [diagnostic];

    const insertPosition = this.findDescriptionInsertPosition(document, diagnostic.range);
    
    if (insertPosition) {
      const indent = this.getIndentation(document, diagnostic.range.start.line);
      const descriptionLine = `${indent}  description: "TODO: Add description"\n`;

      action.edit = new vscode.WorkspaceEdit();
      action.edit.insert(document.uri, insertPosition, descriptionLine);
    }

    return action;
  }

  private findDescriptionInsertPosition(
    document: vscode.TextDocument,
    behaviorRange: vscode.Range
  ): vscode.Position | undefined {
    const lineNum = behaviorRange.start.line;
    const line = document.lineAt(lineNum).text;

    // Find opening brace
    const braceIndex = line.indexOf('{');
    if (braceIndex !== -1) {
      return new vscode.Position(lineNum + 1, 0);
    }

    // Look on next lines
    for (let i = lineNum + 1; i < Math.min(lineNum + 3, document.lineCount); i++) {
      const nextLine = document.lineAt(i).text;
      if (nextLine.includes('{')) {
        return new vscode.Position(i + 1, 0);
      }
    }

    return undefined;
  }

  // ============================================================================
  // Quick Fix: Add Condition Placeholder
  // ============================================================================

  private createAddConditionPlaceholderAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction {
    const isPrecondition = diagnostic.code === ISLDiagnosticCode.EMPTY_PRECONDITIONS;
    const blockType = isPrecondition ? 'precondition' : 'postcondition';
    
    const action = new vscode.CodeAction(
      `Add ${blockType} placeholder`,
      vscode.CodeActionKind.QuickFix
    );

    action.diagnostics = [diagnostic];

    // Find the empty block and add a placeholder
    const line = document.lineAt(diagnostic.range.start.line);
    const lineText = line.text;
    
    // Check if it's an inline empty block like `preconditions { }`
    const emptyBlockMatch = lineText.match(/(preconditions|postconditions)\s*\{\s*\}/);
    
    if (emptyBlockMatch) {
      const indent = this.getIndentation(document, diagnostic.range.start.line);
      const placeholder = isPrecondition
        ? `preconditions {\n${indent}    // Add precondition assertions\n${indent}    true\n${indent}  }`
        : `postconditions {\n${indent}    success implies {\n${indent}      // Add postcondition assertions\n${indent}    }\n${indent}  }`;

      action.edit = new vscode.WorkspaceEdit();
      action.edit.replace(
        document.uri,
        new vscode.Range(
          diagnostic.range.start.line,
          lineText.indexOf(emptyBlockMatch[0]),
          diagnostic.range.start.line,
          lineText.indexOf(emptyBlockMatch[0]) + emptyBlockMatch[0].length
        ),
        placeholder
      );
    }

    return action;
  }

  // ============================================================================
  // Quick Fix: Add Error 'when' Clause
  // ============================================================================

  private createAddErrorWhenAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      "Add 'when' description",
      vscode.CodeActionKind.QuickFix
    );

    action.diagnostics = [diagnostic];

    const lineNum = diagnostic.range.start.line;
    const line = document.lineAt(lineNum).text;

    // Find where to insert the 'when' clause
    const braceIndex = line.indexOf('{');
    if (braceIndex !== -1) {
      // Check if there's content after the brace
      const afterBrace = line.substring(braceIndex + 1).trim();
      
      if (afterBrace === '' || afterBrace === '}') {
        // Empty error block - add when clause
        const indent = this.getIndentation(document, lineNum);
        const whenClause = ` when: "TODO: Describe when this error occurs" `;
        
        action.edit = new vscode.WorkspaceEdit();
        
        if (afterBrace === '}') {
          // Inline empty block like `ERROR_NAME { }`
          action.edit.replace(
            document.uri,
            new vscode.Range(lineNum, braceIndex + 1, lineNum, line.lastIndexOf('}')),
            whenClause
          );
        } else {
          // Multi-line block
          action.edit.insert(
            document.uri,
            new vscode.Position(lineNum + 1, 0),
            `${indent}    when: "TODO: Describe when this error occurs"\n`
          );
        }
      }
    }

    return action;
  }

  // ============================================================================
  // Refactor: Normalize Formatting
  // ============================================================================

  private createNormalizeFormattingAction(
    document: vscode.TextDocument
  ): vscode.CodeAction | undefined {
    const action = new vscode.CodeAction(
      'Normalize ISL formatting',
      vscode.CodeActionKind.Refactor
    );

    if (canonicalPrinterAvailable && formatISL) {
      // Use the canonical printer
      const formatted = this.formatDocument(document);
      if (formatted && formatted !== document.getText()) {
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(
          document.uri,
          new vscode.Range(
            0,
            0,
            document.lineCount - 1,
            document.lineAt(document.lineCount - 1).text.length
          ),
          formatted
        );
        return action;
      }
    } else {
      // Stub: Basic formatting without canonical printer
      action.command = {
        command: 'editor.action.formatDocument',
        title: 'Format Document',
      };
      return action;
    }

    return undefined;
  }

  private formatDocument(document: vscode.TextDocument): string | undefined {
    if (!formatISL) {
      return undefined;
    }

    try {
      return formatISL(document.getText());
    } catch {
      return undefined;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private getIndentation(document: vscode.TextDocument, lineNum: number): string {
    const line = document.lineAt(lineNum).text;
    const match = line.match(/^(\s*)/);
    return match ? match[1]! : '';
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create and register the ISL quick fixes provider.
 * 
 * @example
 * ```typescript
 * // In extension.ts activate function:
 * import { createQuickFixesProvider } from './isl-language/quickFixes';
 * 
 * export function activate(context: vscode.ExtensionContext) {
 *   const quickFixesProvider = createQuickFixesProvider();
 *   quickFixesProvider.register(context);
 * }
 * ```
 */
export function createQuickFixesProvider(
  options?: ISLQuickFixesOptions
): ISLQuickFixesProvider {
  return new ISLQuickFixesProvider(options);
}

/**
 * Check if the canonical printer is available.
 */
export function isCanonicalPrinterAvailable(): boolean {
  return canonicalPrinterAvailable;
}

// ============================================================================
// Quick Fix Commands (for command palette integration)
// ============================================================================

/**
 * Register quick fix commands for ISL.
 * These can be invoked via the command palette.
 */
export function registerQuickFixCommands(context: vscode.ExtensionContext): void {
  // Command: Add postconditions to current behavior
  context.subscriptions.push(
    vscode.commands.registerCommand('isl.addPostconditions', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !isISLDocument(editor.document)) {
        vscode.window.showWarningMessage('Please open an ISL file first');
        return;
      }

      const position = editor.selection.active;
      const line = editor.document.lineAt(position.line);
      
      // Find the current behavior context
      const behaviorLine = findContainingBehavior(editor.document, position.line);
      if (behaviorLine === -1) {
        vscode.window.showWarningMessage('Cursor is not inside a behavior block');
        return;
      }

      const indent = getLineIndentation(editor.document, behaviorLine);
      const postconditionsBlock = `
${indent}  postconditions {
${indent}    success implies {
${indent}      // Add postcondition assertions here
${indent}    }
${indent}  }
`;

      // Find where to insert
      const insertLine = findBehaviorEndLine(editor.document, behaviorLine);
      if (insertLine !== -1) {
        await editor.edit((editBuilder) => {
          editBuilder.insert(new vscode.Position(insertLine, 0), postconditionsBlock);
        });
      }
    })
  );

  // Command: Add version header
  context.subscriptions.push(
    vscode.commands.registerCommand('isl.addVersion', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !isISLDocument(editor.document)) {
        vscode.window.showWarningMessage('Please open an ISL file first');
        return;
      }

      // Find domain declaration
      const text = editor.document.getText();
      const domainMatch = text.match(/domain\s+\w+\s*\{/);
      
      if (!domainMatch) {
        vscode.window.showWarningMessage('No domain declaration found');
        return;
      }

      // Check if version already exists
      if (/version\s*:/.test(text)) {
        vscode.window.showInformationMessage('Version header already exists');
        return;
      }

      // Find insert position (after opening brace of domain)
      const domainIndex = domainMatch.index!;
      const braceIndex = text.indexOf('{', domainIndex);
      const insertPos = editor.document.positionAt(braceIndex + 1);
      
      const indent = getLineIndentation(editor.document, insertPos.line);
      const versionLine = `\n${indent}  version: "1.0.0"`;

      await editor.edit((editBuilder) => {
        editBuilder.insert(insertPos, versionLine);
      });
    })
  );

  // Command: Normalize formatting
  context.subscriptions.push(
    vscode.commands.registerCommand('isl.normalizeFormatting', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !isISLDocument(editor.document)) {
        vscode.window.showWarningMessage('Please open an ISL file first');
        return;
      }

      if (canonicalPrinterAvailable && formatISL) {
        try {
          const formatted = formatISL(editor.document.getText());
          if (formatted && formatted !== editor.document.getText()) {
            const fullRange = new vscode.Range(
              0,
              0,
              editor.document.lineCount - 1,
              editor.document.lineAt(editor.document.lineCount - 1).text.length
            );
            
            await editor.edit((editBuilder) => {
              editBuilder.replace(fullRange, formatted);
            });
            
            vscode.window.showInformationMessage('ISL formatting normalized');
          } else {
            vscode.window.showInformationMessage('Document is already formatted');
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`Formatting failed: ${message}`);
        }
      } else {
        // Fallback to VS Code's built-in formatter
        await vscode.commands.executeCommand('editor.action.formatDocument');
      }
    })
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function findContainingBehavior(document: vscode.TextDocument, lineNum: number): number {
  for (let i = lineNum; i >= 0; i--) {
    const line = document.lineAt(i).text;
    if (/behavior\s+\w+\s*\{/.test(line)) {
      return i;
    }
  }
  return -1;
}

function findBehaviorEndLine(document: vscode.TextDocument, behaviorLine: number): number {
  let depth = 0;
  let foundBehavior = false;

  for (let i = behaviorLine; i < document.lineCount; i++) {
    const line = document.lineAt(i).text;
    
    for (const char of line) {
      if (char === '{') {
        depth++;
        foundBehavior = true;
      } else if (char === '}') {
        depth--;
        if (foundBehavior && depth === 0) {
          return i;
        }
      }
    }
  }
  
  return -1;
}

function getLineIndentation(document: vscode.TextDocument, lineNum: number): string {
  const line = document.lineAt(lineNum).text;
  const match = line.match(/^(\s*)/);
  return match ? match[1]! : '';
}
