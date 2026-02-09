// ============================================================================
// ISL Code Action Provider
// Quick fixes and refactoring actions with enhanced quickfix support
// ============================================================================

import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Range, CodeActionContext, Diagnostic } from 'vscode-languageserver';
import { CodeAction, CodeActionKind, TextEdit } from 'vscode-languageserver';
import type { ISLDocumentManager } from '../documents';
import { DiagnosticSeverity } from '@isl-lang/lsp-core';

// ============================================================================
// Quickfix Data Types (from semantic linter)
// ============================================================================

interface QuickfixData {
  type: string;
  behaviorName?: string;
  behaviorLocation?: { line: number; column: number; endLine: number; endColumn: number };
  typeName?: string;
  entityName?: string;
  fieldName?: string;
  symbolName?: string;
  originalName?: string;
  availableBehaviors?: string[];
  availableExports?: string[];
  suggestedConstraints?: string[];
  preconditionCount?: number;
  fields?: string[];
  [key: string]: unknown;
}

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
      // Extract quickfix data if available
      const data = diagnostic.data as QuickfixData | undefined;

      // Missing postcondition (ISL1001)
      if (diagnostic.code === 'ISL1001') {
        const behaviorName = data?.behaviorName || this.extractBehaviorName(lines, diagnostic.range.start.line);
        if (behaviorName) {
          actions.push(this.createAddPostconditionAction(document, diagnostic.range, behaviorName));
        }
      }

      // Precondition without error (ISL1002)
      if (diagnostic.code === 'ISL1002' && data?.behaviorName) {
        actions.push(this.createAddErrorCaseForPreconditionAction(document, diagnostic.range, data.behaviorName));
      }

      // Unused type (ISL1003)
      if (diagnostic.code === 'ISL1003' && data?.typeName) {
        actions.push(this.createRemoveUnusedTypeAction(document, diagnostic.range, data.typeName));
      }

      // Undefined behavior reference (ISL1004)
      if (diagnostic.code === 'ISL1004' && data?.availableBehaviors) {
        for (const behavior of data.availableBehaviors.slice(0, 3)) {
          actions.push(this.createRenameToBehaviorAction(document, diagnostic.range, data.behaviorName || '', behavior));
        }
      }

      // Missing description (ISL1010)
      if (diagnostic.code === 'ISL1010' && data?.behaviorName) {
        actions.push(this.createAddDescriptionAction(document, diagnostic.range, data.behaviorName));
      }

      // Entity without id (ISL1011)
      if (diagnostic.code === 'ISL1011' && data?.entityName) {
        actions.push(this.createAddIdFieldAction(document, diagnostic.range, data.entityName));
      }

      // No temporal constraints (ISL1012)
      if (diagnostic.code === 'ISL1012' && data?.behaviorName) {
        actions.push(this.createAddTemporalAction(document, diagnostic.range, data.behaviorName));
      }

      // No scenarios (ISL1013)
      if (diagnostic.code === 'ISL1013' && data?.behaviorName) {
        actions.push(this.createGenerateScenarioAction(document, data.behaviorName, diagnostic.range));
      }

      // Sensitive field unprotected (ISL1020)
      if (diagnostic.code === 'ISL1020' && data?.suggestedConstraints) {
        actions.push(this.createAddConstraintsAction(document, diagnostic.range, data.fieldName || '', data.suggestedConstraints));
      }

      // No authentication (ISL1021)
      if (diagnostic.code === 'ISL1021' && data?.behaviorName) {
        actions.push(this.createAddSecurityAction(document, diagnostic.range, data.behaviorName));
      }

      // Unbounded list (ISL1030)
      if (diagnostic.code === 'ISL1030' && data?.typeName) {
        actions.push(this.createAddMaxSizeAction(document, diagnostic.range, data.typeName));
      }

      // Missing pagination (ISL1031)
      if (diagnostic.code === 'ISL1031' && data?.behaviorName) {
        actions.push(this.createAddPaginationAction(document, diagnostic.range, data.behaviorName));
      }

      // Unresolved import (ISL2001)
      if (diagnostic.code === 'ISL2001') {
        // Suggest creating the file
        actions.push(this.createFileAction(document, diagnostic));
      }

      // Unknown export (ISL2002)
      if (diagnostic.code === 'ISL2002' && data?.availableExports) {
        for (const exp of data.availableExports.slice(0, 3)) {
          actions.push(this.createReplaceImportAction(document, diagnostic.range, data.symbolName || '', exp));
        }
      }

      // Unused import (ISL2003)
      if (diagnostic.code === 'ISL2003') {
        actions.push(this.createRemoveImportAction(document, diagnostic.range, data?.symbolName || ''));
      }

      // Unknown type - suggest creating it (legacy)
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

    // Generate skeleton from spec — available when cursor is inside a domain
    if (this.isInDomain(lines, range.start.line)) {
      const domainName = this.extractDomainName(lines);
      if (domainName) {
        actions.push(this.createGenerateSkeletonAction(document, domainName));
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
  // New Quick Fix Actions for Semantic Linter
  // ============================================================================

  private createAddErrorCaseForPreconditionAction(
    document: TextDocument,
    range: Range,
    behaviorName: string
  ): CodeAction {
    const text = document.getText();
    const lines = text.split('\n');

    // Find the output block's errors section or end of output
    let insertLine = range.start.line;
    let inBehavior = false;
    let inOutput = false;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      if (line.includes(`behavior ${behaviorName}`)) inBehavior = true;
      if (inBehavior) {
        if (line.trim() === 'output {') inOutput = true;
        if (inOutput) {
          braceDepth += (line.match(/\{/g) || []).length;
          braceDepth -= (line.match(/\}/g) || []).length;
          if (braceDepth === 0) {
            insertLine = i;
            break;
          }
        }
      }
    }

    const errorBlock = `
      errors {
        PRECONDITION_FAILED {
          when: "Precondition not met"
          retriable: false
        }
      }
`;

    return {
      title: 'Add error case for precondition failure',
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert({ line: insertLine, character: 0 }, errorBlock),
          ],
        },
      },
    };
  }

  private createRemoveUnusedTypeAction(
    document: TextDocument,
    range: Range,
    typeName: string
  ): CodeAction {
    const text = document.getText();
    const lines = text.split('\n');

    // Find the full type declaration
    let startLine = range.start.line;
    let endLine = range.start.line;
    let braceDepth = 0;
    let found = false;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i] || '';
      braceDepth += (line.match(/\{/g) || []).length;
      braceDepth -= (line.match(/\}/g) || []).length;
      if (braceDepth === 0 && found) {
        endLine = i;
        break;
      }
      if (braceDepth > 0) found = true;
    }

    return {
      title: `Remove unused type '${typeName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.del({
              start: { line: startLine, character: 0 },
              end: { line: endLine + 1, character: 0 },
            }),
          ],
        },
      },
    };
  }

  private createRenameToBehaviorAction(
    document: TextDocument,
    range: Range,
    currentName: string,
    targetName: string
  ): CodeAction {
    return {
      title: `Change to '${targetName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [TextEdit.replace(range, targetName)],
        },
      },
    };
  }

  private createAddDescriptionAction(
    document: TextDocument,
    range: Range,
    behaviorName: string
  ): CodeAction {
    const text = document.getText();
    const lines = text.split('\n');

    // Find the line after "behavior X {"
    let insertLine = range.start.line + 1;
    for (let i = range.start.line; i < lines.length; i++) {
      const line = lines[i] || '';
      if (line.includes(`behavior ${behaviorName}`) && line.includes('{')) {
        insertLine = i + 1;
        break;
      }
    }

    return {
      title: `Add description to '${behaviorName}'`,
      kind: CodeActionKind.QuickFix,
      isPreferred: true,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert(
              { line: insertLine, character: 0 },
              `    description: "TODO: Add description for ${behaviorName}"\n\n`
            ),
          ],
        },
      },
    };
  }

  private createAddIdFieldAction(
    document: TextDocument,
    range: Range,
    entityName: string
  ): CodeAction {
    const text = document.getText();
    const lines = text.split('\n');

    // Find the line after "entity X {"
    let insertLine = range.start.line + 1;
    for (let i = range.start.line; i < lines.length; i++) {
      const line = lines[i] || '';
      if (line.includes(`entity ${entityName}`) && line.includes('{')) {
        insertLine = i + 1;
        break;
      }
    }

    return {
      title: `Add 'id' field to '${entityName}'`,
      kind: CodeActionKind.QuickFix,
      isPreferred: true,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert(
              { line: insertLine, character: 0 },
              `    id: UUID\n`
            ),
          ],
        },
      },
    };
  }

  private createAddTemporalAction(
    document: TextDocument,
    range: Range,
    behaviorName: string
  ): CodeAction {
    const text = document.getText();
    const lines = text.split('\n');

    // Find the end of the behavior
    let insertLine = range.start.line;
    let braceDepth = 0;
    let inBehavior = false;

    for (let i = range.start.line; i < lines.length; i++) {
      const line = lines[i] || '';
      if (line.includes(`behavior ${behaviorName}`)) inBehavior = true;
      if (inBehavior) {
        braceDepth += (line.match(/\{/g) || []).length;
        braceDepth -= (line.match(/\}/g) || []).length;
        if (braceDepth === 0 && inBehavior) {
          insertLine = i;
          break;
        }
      }
    }

    const temporalBlock = `
    temporal {
      response within 500.ms (p99)
    }
`;

    return {
      title: `Add temporal constraints to '${behaviorName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert({ line: insertLine, character: 0 }, temporalBlock),
          ],
        },
      },
    };
  }

  private createAddConstraintsAction(
    document: TextDocument,
    range: Range,
    fieldName: string,
    suggestedConstraints: string[]
  ): CodeAction {
    const text = document.getText();
    const lines = text.split('\n');
    const line = lines[range.start.line] || '';

    // Find the type after the colon
    const match = line.match(/:\s*(\w+)/);
    if (!match) {
      return {
        title: `Add constraints to '${fieldName}'`,
        kind: CodeActionKind.QuickFix,
        edit: { changes: {} },
      };
    }

    const constraints = suggestedConstraints.join(', ');
    const newLine = line.replace(
      /:\s*(\w+)/,
      `: $1 { ${constraints} }`
    );

    return {
      title: `Add security constraints to '${fieldName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.replace(
              {
                start: { line: range.start.line, character: 0 },
                end: { line: range.start.line, character: line.length },
              },
              newLine
            ),
          ],
        },
      },
    };
  }

  private createAddSecurityAction(
    document: TextDocument,
    range: Range,
    behaviorName: string
  ): CodeAction {
    const text = document.getText();
    const lines = text.split('\n');

    // Find the end of the behavior
    let insertLine = range.start.line;
    let braceDepth = 0;
    let inBehavior = false;

    for (let i = range.start.line; i < lines.length; i++) {
      const line = lines[i] || '';
      if (line.includes(`behavior ${behaviorName}`)) inBehavior = true;
      if (inBehavior) {
        braceDepth += (line.match(/\{/g) || []).length;
        braceDepth -= (line.match(/\}/g) || []).length;
        if (braceDepth === 0 && inBehavior) {
          insertLine = i;
          break;
        }
      }
    }

    const securityBlock = `
    security {
      requires authentication
    }
`;

    return {
      title: `Add security requirements to '${behaviorName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert({ line: insertLine, character: 0 }, securityBlock),
          ],
        },
      },
    };
  }

  private createAddMaxSizeAction(
    document: TextDocument,
    range: Range,
    typeName: string
  ): CodeAction {
    const text = document.getText();
    const lines = text.split('\n');
    const line = lines[range.start.line] || '';

    // Add max_size constraint to list type
    const newLine = line.replace(
      /List<([^>]+)>/,
      'List<$1> { max_size: 1000 }'
    );

    return {
      title: `Add max_size constraint to '${typeName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.replace(
              {
                start: { line: range.start.line, character: 0 },
                end: { line: range.start.line, character: line.length },
              },
              newLine
            ),
          ],
        },
      },
    };
  }

  private createAddPaginationAction(
    document: TextDocument,
    range: Range,
    behaviorName: string
  ): CodeAction {
    const text = document.getText();
    const lines = text.split('\n');

    // Find the input block
    let insertLine = range.start.line;
    let inBehavior = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      if (line.includes(`behavior ${behaviorName}`)) inBehavior = true;
      if (inBehavior && line.trim() === 'input {') {
        insertLine = i + 1;
        break;
      }
    }

    const paginationFields = `      page: Int { min: 1, default: 1 }
      pageSize: Int { min: 1, max: 100, default: 20 }
`;

    return {
      title: `Add pagination to '${behaviorName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert({ line: insertLine, character: 0 }, paginationFields),
          ],
        },
      },
    };
  }

  private createFileAction(document: TextDocument, diagnostic: Diagnostic): CodeAction {
    return {
      title: 'Create missing file',
      kind: CodeActionKind.QuickFix,
      command: {
        title: 'Create ISL File',
        command: 'isl.createFile',
        arguments: [diagnostic.data],
      },
    };
  }

  private createReplaceImportAction(
    document: TextDocument,
    range: Range,
    currentName: string,
    targetName: string
  ): CodeAction {
    return {
      title: `Import '${targetName}' instead`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [TextEdit.replace(range, targetName)],
        },
      },
    };
  }

  private createRemoveImportAction(
    document: TextDocument,
    range: Range,
    symbolName: string
  ): CodeAction {
    const text = document.getText();
    const lines = text.split('\n');
    const line = lines[range.start.line] || '';

    // Check if this is the only import item on the line
    const importMatch = line.match(/imports\s*\{([^}]+)\}/);
    if (importMatch) {
      const items = importMatch[1]?.split(',').map(s => s.trim()) || [];
      if (items.length === 1) {
        // Remove the entire import line
        return {
          title: `Remove unused import '${symbolName}'`,
          kind: CodeActionKind.QuickFix,
          edit: {
            changes: {
              [document.uri]: [
                TextEdit.del({
                  start: { line: range.start.line, character: 0 },
                  end: { line: range.start.line + 1, character: 0 },
                }),
              ],
            },
          },
        };
      }
    }

    // Just remove the import item
    return {
      title: `Remove unused import '${symbolName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.replace(range, ''),
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

  private isInDomain(lines: string[], lineNum: number): boolean {
    for (let i = lineNum; i >= 0; i--) {
      const line = lines[i] || '';
      if (line.match(/^\s*domain\s+\w+/)) {
        return true;
      }
    }
    return false;
  }

  private extractDomainName(lines: string[]): string | undefined {
    for (const line of lines) {
      const match = line.match(/^\s*domain\s+(\w+)/);
      if (match) return match[1];
    }
    return undefined;
  }

  private createGenerateSkeletonAction(
    document: TextDocument,
    domainName: string
  ): CodeAction {
    return {
      title: `Generate implementation skeleton for ${domainName}`,
      kind: CodeActionKind.Source,
      command: {
        title: 'Generate Skeleton from ISL Spec',
        command: 'isl.generateSkeleton',
        arguments: [document.uri, domainName],
      },
    };
  }
}
