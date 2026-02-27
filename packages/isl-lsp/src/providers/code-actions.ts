/**
 * Code Action Provider
 * 
 * Provides quick fixes and refactorings for ISL documents.
 */

import {
  CodeAction,
  CodeActionKind,
  Diagnostic,
  Range,
  TextEdit,
  CodeActionContext,
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ISLLanguageService } from '../services/language-service.js';
import { DiagnosticCodes } from './diagnostics.js';

export class CodeActionProvider {
  private languageService: ISLLanguageService;

  constructor(languageService: ISLLanguageService) {
    this.languageService = languageService;
  }

  provideCodeActions(document: TextDocument, range: Range, context: CodeActionContext): CodeAction[] {
    const actions: CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      const fixes = this.getQuickFixes(document, diagnostic);
      actions.push(...fixes);
    }

    // Add refactoring actions
    actions.push(...this.getRefactorings(document, range));

    return actions;
  }

  private getQuickFixes(document: TextDocument, diagnostic: Diagnostic): CodeAction[] {
    const actions: CodeAction[] = [];

    switch (diagnostic.code) {
      case DiagnosticCodes.MISSING_REQUIRED_FIELD:
        actions.push(this.createAddIdFieldAction(document, diagnostic));
        break;

      case DiagnosticCodes.MISSING_DESCRIPTION:
        actions.push(this.createAddDescriptionAction(document, diagnostic));
        break;

      case DiagnosticCodes.NAMING_CONVENTION:
        actions.push(...this.createNamingFixActions(document, diagnostic));
        break;
    }

    return actions;
  }

  private createAddIdFieldAction(document: TextDocument, diagnostic: Diagnostic): CodeAction {
    const line = diagnostic.range.start.line;
    const content = document.getText();
    const lines = content.split('\n');
    
    // Find the opening brace
    let insertLine = line + 1;
    for (let i = line; i < lines.length; i++) {
      if (lines[i]?.includes('{')) {
        insertLine = i + 1;
        break;
      }
    }

    return {
      title: 'Add id field',
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [document.uri]: [{
            range: { start: { line: insertLine, character: 0 }, end: { line: insertLine, character: 0 } },
            newText: '  id: UUID [immutable, unique]\n',
          }],
        },
      },
    };
  }

  private createAddDescriptionAction(document: TextDocument, diagnostic: Diagnostic): CodeAction {
    const line = diagnostic.range.start.line;

    return {
      title: 'Add description',
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [document.uri]: [{
            range: { start: { line: line + 1, character: 0 }, end: { line: line + 1, character: 0 } },
            newText: '  description: "TODO: Add description"\n',
          }],
        },
      },
    };
  }

  private createNamingFixActions(document: TextDocument, diagnostic: Diagnostic): CodeAction[] {
    const content = document.getText(diagnostic.range);
    const actions: CodeAction[] = [];

    // PascalCase
    const pascalCase = content.replace(/(?:^|_)(\w)/g, (_, c) => c.toUpperCase());
    if (pascalCase !== content) {
      actions.push({
        title: `Convert to PascalCase: ${pascalCase}`,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit: {
          changes: {
            [document.uri]: [{
              range: diagnostic.range,
              newText: pascalCase,
            }],
          },
        },
      });
    }

    // snake_case
    const snakeCase = content.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    if (snakeCase !== content) {
      actions.push({
        title: `Convert to snake_case: ${snakeCase}`,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit: {
          changes: {
            [document.uri]: [{
              range: diagnostic.range,
              newText: snakeCase,
            }],
          },
        },
      });
    }

    return actions;
  }

  private getRefactorings(document: TextDocument, range: Range): CodeAction[] {
    const actions: CodeAction[] = [];
    const content = document.getText();
    const selectedText = document.getText(range);

    // Extract type refactoring
    if (selectedText.match(/^\w+$/)) {
      actions.push({
        title: `Extract type '${selectedText}'`,
        kind: CodeActionKind.RefactorExtract,
        edit: {
          changes: {
            [document.uri]: [{
              range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
              newText: `type ${selectedText}Alias = ${selectedText}\n\n`,
            }],
          },
        },
      });
    }

    return actions;
  }
}
