// ============================================================================
// ISL Code Action Provider
// Quick fixes and refactoring actions
// ============================================================================

import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Range, CodeActionContext } from 'vscode-languageserver';
import { CodeAction, CodeActionKind, TextEdit } from 'vscode-languageserver';
import type { ISLDocumentManager } from '../documents';
import { DiagnosticSeverity } from '@isl-lang/lsp-core';

export class ISLCodeActionProvider {
  constructor(private documentManager: ISLDocumentManager) {}

  provideCodeActions(
    document: TextDocument,
    range: Range,
    context: CodeActionContext
  ): CodeAction[] {
    const actions: CodeAction[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    // Process diagnostics to generate quick fixes
    for (const diagnostic of context.diagnostics) {
      // Missing postcondition
      if (diagnostic.code === 'ISL1001') {
        const behaviorName = this.extractBehaviorName(lines, diagnostic.range.start.line);
        if (behaviorName) {
          actions.push(this.createAddPostconditionAction(document, diagnostic.range, behaviorName));
        }
      }

      // Unknown type - suggest creating it
      if (diagnostic.code === 'ISL002' || diagnostic.message.includes('Unknown type')) {
        const typeName = this.extractTypeName(diagnostic.message);
        if (typeName) {
          actions.push(this.createDefineTypeAction(document, typeName));
        }
      }

      // Naming convention warning
      if (diagnostic.code === 'ISL009') {
        const name = this.getWordAtRange(lines, diagnostic.range);
        if (name) {
          actions.push(this.createRenameToUppercaseAction(document, diagnostic.range, name));
        }
      }

      if (diagnostic.code === 'ISL010') {
        const name = this.getWordAtRange(lines, diagnostic.range);
        if (name) {
          actions.push(this.createRenameToLowercaseAction(document, diagnostic.range, name));
        }
      }
    }

    // Context-based actions (not tied to diagnostics)
    const lineText = lines[range.start.line] || '';
    const trimmed = lineText.trim();

    // In a behavior - offer to generate scenario
    if (this.isInBehavior(lines, range.start.line)) {
      const behaviorName = this.extractBehaviorName(lines, range.start.line);
      if (behaviorName) {
        actions.push(this.createGenerateScenarioAction(document, behaviorName, range));
      }
    }

    // In a behavior without output errors - offer to add error case
    if (trimmed.startsWith('output') || this.isInOutput(lines, range.start.line)) {
      actions.push(this.createAddErrorCaseAction(document, range));
    }

    // On entity - offer to generate behavior
    if (trimmed.match(/^entity\s+\w+/)) {
      const entityName = trimmed.match(/^entity\s+(\w+)/)?.[1];
      if (entityName) {
        actions.push(this.createGenerateCrudBehaviorsAction(document, entityName, range));
      }
    }

    return actions;
  }

  // ============================================================================
  // Quick Fix Actions
  // ============================================================================

  private createAddPostconditionAction(
    document: TextDocument,
    range: Range,
    behaviorName: string
  ): CodeAction {
    const text = document.getText();
    const lines = text.split('\n');

    // Find the end of the behavior (before closing brace)
    let insertLine = range.start.line;
    let braceDepth = 0;
    let foundBehavior = false;

    for (let i = range.start.line; i < lines.length; i++) {
      const line = lines[i] || '';
      if (line.includes('behavior ' + behaviorName)) foundBehavior = true;
      if (foundBehavior) {
        braceDepth += (line.match(/\{/g) || []).length;
        braceDepth -= (line.match(/\}/g) || []).length;
        if (braceDepth === 0 && foundBehavior) {
          insertLine = i;
          break;
        }
      }
    }

    const indent = '  ';
    const postconditionBlock = `
${indent}postconditions {
${indent}${indent}success implies {
${indent}${indent}${indent}// Add postcondition assertions here
${indent}${indent}}
${indent}}
`;

    return {
      title: 'Add postconditions block',
      kind: CodeActionKind.QuickFix,
      isPreferred: true,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert(
              { line: insertLine, character: 0 },
              postconditionBlock
            ),
          ],
        },
      },
    };
  }

  private createDefineTypeAction(document: TextDocument, typeName: string): CodeAction {
    const text = document.getText();
    const lines = text.split('\n');

    // Find where to insert (after version, before entities/behaviors)
    let insertLine = 2;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      if (line.trim().startsWith('entity ') || line.trim().startsWith('behavior ')) {
        insertLine = i;
        break;
      }
      if (line.trim().startsWith('type ') || line.trim().startsWith('enum ')) {
        insertLine = i + 1;
      }
    }

    const typeDefinition = `
  type ${typeName} = String {
    // Add constraints
  }
`;

    return {
      title: `Define type '${typeName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert({ line: insertLine, character: 0 }, typeDefinition),
          ],
        },
      },
    };
  }

  private createRenameToUppercaseAction(
    document: TextDocument,
    range: Range,
    name: string
  ): CodeAction {
    const newName = name.charAt(0).toUpperCase() + name.slice(1);
    return {
      title: `Rename to '${newName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [TextEdit.replace(range, newName)],
        },
      },
    };
  }

  private createRenameToLowercaseAction(
    document: TextDocument,
    range: Range,
    name: string
  ): CodeAction {
    const newName = name.charAt(0).toLowerCase() + name.slice(1);
    return {
      title: `Rename to '${newName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [TextEdit.replace(range, newName)],
        },
      },
    };
  }

  // ============================================================================
  // Refactoring Actions
  // ============================================================================

  private createGenerateScenarioAction(
    document: TextDocument,
    behaviorName: string,
    range: Range
  ): CodeAction {
    const text = document.getText();
    const lines = text.split('\n');

    // Find end of domain
    let insertLine = lines.length - 1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i] || '';
      if (line.trim() === '}') {
        insertLine = i;
        break;
      }
    }

    const scenarioBlock = `
  scenarios ${behaviorName} {
    scenario "Successful ${behaviorName}" {
      given {
        // Setup initial state
      }

      when {
        ${behaviorName}(/* params */)
      }

      then {
        result != null
      }
    }

    scenario "${behaviorName} with invalid input" {
      given {
        // Setup state for error case
      }

      when {
        ${behaviorName}(/* invalid params */)
      }

      then {
        // Error was returned
      }
    }
  }
`;

    return {
      title: `Generate test scenarios for ${behaviorName}`,
      kind: CodeActionKind.Refactor,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert({ line: insertLine, character: 0 }, scenarioBlock),
          ],
        },
      },
    };
  }

  private createAddErrorCaseAction(document: TextDocument, range: Range): CodeAction {
    const errorCase = `
      ERROR_NAME {
        when: "Error description"
        retriable: false
      }`;

    return {
      title: 'Add error case',
      kind: CodeActionKind.Refactor,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert(
              { line: range.start.line + 1, character: 0 },
              errorCase
            ),
          ],
        },
      },
    };
  }

  private createGenerateCrudBehaviorsAction(
    document: TextDocument,
    entityName: string,
    range: Range
  ): CodeAction {
    const text = document.getText();
    const lines = text.split('\n');

    // Find end of domain
    let insertLine = lines.length - 1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i] || '';
      if (line.trim() === '}') {
        insertLine = i;
        break;
      }
    }

    const crudBehaviors = `
  behavior Create${entityName} {
    description: "Create a new ${entityName}"

    input {
      // Add input fields from ${entityName}
    }

    output {
      success: ${entityName}

      errors {
        VALIDATION_ERROR {
          when: "Input validation failed"
          retriable: true
        }
      }
    }

    preconditions {
      // Add preconditions
    }

    postconditions {
      success implies {
        ${entityName}.exists(result.id)
      }
    }
  }

  behavior Get${entityName} {
    description: "Get ${entityName} by ID"

    input {
      id: UUID
    }

    output {
      success: ${entityName}

      errors {
        NOT_FOUND {
          when: "${entityName} does not exist"
          retriable: false
        }
      }
    }

    preconditions {
      id != null
    }

    postconditions {
      success implies {
        result.id == input.id
      }
    }
  }

  behavior Update${entityName} {
    description: "Update an existing ${entityName}"

    input {
      id: UUID
      // Add updatable fields
    }

    output {
      success: ${entityName}

      errors {
        NOT_FOUND {
          when: "${entityName} does not exist"
          retriable: false
        }
        VALIDATION_ERROR {
          when: "Input validation failed"
          retriable: true
        }
      }
    }

    preconditions {
      ${entityName}.exists(input.id)
    }

    postconditions {
      success implies {
        ${entityName}.lookup(input.id) == result
      }
    }
  }

  behavior Delete${entityName} {
    description: "Delete a ${entityName}"

    input {
      id: UUID
    }

    output {
      success: Boolean

      errors {
        NOT_FOUND {
          when: "${entityName} does not exist"
          retriable: false
        }
      }
    }

    preconditions {
      ${entityName}.exists(input.id)
    }

    postconditions {
      success implies {
        not ${entityName}.exists(input.id)
      }
    }
  }
`;

    return {
      title: `Generate CRUD behaviors for ${entityName}`,
      kind: CodeActionKind.Refactor,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert({ line: insertLine, character: 0 }, crudBehaviors),
          ],
        },
      },
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private extractBehaviorName(lines: string[], startLine: number): string | undefined {
    for (let i = startLine; i >= 0; i--) {
      const match = lines[i]?.match(/^(\s*)behavior\s+(\w+)/);
      if (match) return match[2];
    }
    return undefined;
  }

  private extractTypeName(message: string): string | undefined {
    const match = message.match(/Unknown type '(\w+)'/);
    return match?.[1];
  }

  private getWordAtRange(lines: string[], range: Range): string | undefined {
    const line = lines[range.start.line];
    if (!line) return undefined;
    return line.substring(range.start.character, range.end.character);
  }

  private isInBehavior(lines: string[], lineNum: number): boolean {
    let braceDepth = 0;
    for (let i = lineNum; i >= 0; i--) {
      const line = lines[i] || '';
      braceDepth += (line.match(/\}/g) || []).length;
      braceDepth -= (line.match(/\{/g) || []).length;
      if (line.match(/^(\s*)behavior\s+\w+/) && braceDepth <= 0) {
        return true;
      }
      if (line.match(/^(\s*)entity\s+\w+/) && braceDepth <= 0) {
        return false;
      }
    }
    return false;
  }

  private isInOutput(lines: string[], lineNum: number): boolean {
    let braceDepth = 0;
    for (let i = lineNum; i >= 0; i--) {
      const line = lines[i] || '';
      braceDepth += (line.match(/\}/g) || []).length;
      braceDepth -= (line.match(/\{/g) || []).length;
      if (line.trim() === 'output {' && braceDepth <= 0) {
        return true;
      }
      if (line.trim() === 'input {' && braceDepth <= 0) {
        return false;
      }
    }
    return false;
  }
}
