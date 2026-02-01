/**
 * ISL VS Code Extension - Commands
 *
 * Implementations for all ISL command palette commands.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LanguageClient } from 'vscode-languageclient/node';

/**
 * Register all ISL commands
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  getClient: () => LanguageClient | undefined,
  outputChannel: vscode.OutputChannel
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('isl.parseFile', () => parseCurrentFile(getClient(), outputChannel)),
    vscode.commands.registerCommand('isl.typeCheck', () => typeCheckCurrentFile(getClient(), outputChannel)),
    vscode.commands.registerCommand('isl.generateTypeScript', () => generateCode('typescript', getClient(), outputChannel)),
    vscode.commands.registerCommand('isl.generateRust', () => generateCode('rust', getClient(), outputChannel)),
    vscode.commands.registerCommand('isl.openRepl', () => openRepl()),
    vscode.commands.registerCommand('isl.initProject', () => initializeProject()),
    vscode.commands.registerCommand('isl.verifySpec', () => verifySpec(getClient(), outputChannel)),
    vscode.commands.registerCommand('isl.restartServer', () => restartServer(context, getClient, outputChannel))
  );
}

/**
 * Get the active ISL file or show warning
 */
function getActiveIslFile(): vscode.TextEditor | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'isl') {
    vscode.window.showWarningMessage('Please open an ISL file first');
    return undefined;
  }
  return editor;
}

/**
 * Parse current file and show AST
 */
async function parseCurrentFile(
  client: LanguageClient | undefined,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  const editor = getActiveIslFile();
  if (!editor) return;

  try {
    outputChannel.appendLine(`Parsing: ${editor.document.fileName}`);
    outputChannel.show(true);

    if (client) {
      const result = await client.sendRequest<{ ast: unknown; success: boolean; errors?: string[] }>(
        'isl/parse',
        { uri: editor.document.uri.toString() }
      );

      if (result.success) {
        // Create a new document with the AST
        const astDoc = await vscode.workspace.openTextDocument({
          content: JSON.stringify(result.ast, null, 2),
          language: 'json'
        });
        await vscode.window.showTextDocument(astDoc, { viewColumn: vscode.ViewColumn.Beside });
        outputChannel.appendLine('AST parsed successfully');
      } else {
        const errors = result.errors?.join('\n') || 'Unknown parse error';
        outputChannel.appendLine(`Parse errors:\n${errors}`);
        vscode.window.showErrorMessage(`Parse failed: ${result.errors?.[0] || 'Unknown error'}`);
      }
      return;
    }

    // Fallback: use CLI
    await runCliCommand('parse', editor.document.fileName, '--format json');
  } catch (error) {
    handleError('Parse failed', error, outputChannel);
  }
}

/**
 * Type check current file
 */
async function typeCheckCurrentFile(
  client: LanguageClient | undefined,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  const editor = getActiveIslFile();
  if (!editor) return;

  try {
    outputChannel.appendLine(`Type checking: ${editor.document.fileName}`);
    outputChannel.show(true);

    if (client) {
      const result = await client.sendRequest<{ valid: boolean; errors: Array<{ message: string; line: number; column: number }> }>(
        'isl/typeCheck',
        { uri: editor.document.uri.toString() }
      );

      if (result.valid) {
        vscode.window.showInformationMessage('Type check passed ✓');
        outputChannel.appendLine('Type check passed');
      } else {
        const errorCount = result.errors.length;
        outputChannel.appendLine(`Type errors (${errorCount}):`);
        result.errors.forEach(err => {
          outputChannel.appendLine(`  Line ${err.line}:${err.column}: ${err.message}`);
        });
        vscode.window.showErrorMessage(`Type check failed: ${errorCount} error${errorCount === 1 ? '' : 's'}`);
      }
      return;
    }

    // Fallback: use CLI
    await runCliCommand('check', editor.document.fileName);
  } catch (error) {
    handleError('Type check failed', error, outputChannel);
  }
}

/**
 * Generate code from current file
 */
async function generateCode(
  target: 'typescript' | 'rust',
  client: LanguageClient | undefined,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  const editor = getActiveIslFile();
  if (!editor) return;

  const config = vscode.workspace.getConfiguration('isl');
  const outputDir = config.get<string>('codegen.outputDir', 'generated');

  try {
    outputChannel.appendLine(`Generating ${target} from: ${editor.document.fileName}`);
    outputChannel.show(true);

    if (client) {
      const result = await client.sendRequest<{ success: boolean; files: string[]; error?: string }>(
        'isl/generate',
        {
          uri: editor.document.uri.toString(),
          target,
          outputDir
        }
      );

      if (result.success) {
        const fileCount = result.files.length;
        vscode.window.showInformationMessage(
          `Generated ${fileCount} ${target} file${fileCount === 1 ? '' : 's'}`
        );
        outputChannel.appendLine(`Generated files:`);
        result.files.forEach(f => outputChannel.appendLine(`  ${f}`));
      } else {
        vscode.window.showErrorMessage(`Generation failed: ${result.error}`);
      }
      return;
    }

    // Fallback: use CLI
    await runCliCommand('generate', target, editor.document.fileName, '--output', outputDir);
  } catch (error) {
    handleError(`${target} generation failed`, error, outputChannel);
  }
}

/**
 * Open ISL REPL in terminal
 */
async function openRepl(): Promise<void> {
  const terminal = vscode.window.createTerminal({
    name: 'ISL REPL',
    iconPath: new vscode.ThemeIcon('terminal')
  });
  terminal.show();
  terminal.sendText('npx isl repl');
}

/**
 * Initialize ISL project
 */
async function initializeProject(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('Please open a workspace folder first');
    return;
  }

  const rootPath = workspaceFolder.uri.fsPath;
  const islrcPath = path.join(rootPath, '.islrc.json');
  const examplePath = path.join(rootPath, 'specs', 'example.isl');

  // Check if already initialized
  if (fs.existsSync(islrcPath)) {
    const overwrite = await vscode.window.showWarningMessage(
      'ISL project already initialized. Overwrite?',
      'Yes',
      'No'
    );
    if (overwrite !== 'Yes') return;
  }

  try {
    // Create .islrc.json
    const islrcContent = {
      $schema: 'https://intentos.dev/schemas/islrc.json',
      version: '1.0',
      specs: ['specs/**/*.isl'],
      output: {
        typescript: 'src/generated',
        rust: 'src-rs/generated'
      },
      codegen: {
        target: 'typescript',
        strictTypes: true,
        generateTests: true
      },
      lsp: {
        enable: true,
        format: {
          indentSize: 2,
          useTabs: false
        }
      }
    };
    fs.writeFileSync(islrcPath, JSON.stringify(islrcContent, null, 2));

    // Create specs directory and example file
    const specsDir = path.join(rootPath, 'specs');
    if (!fs.existsSync(specsDir)) {
      fs.mkdirSync(specsDir, { recursive: true });
    }

    const exampleContent = `// Example ISL specification
// Learn more at https://intentos.dev/docs

domain Example {
  version: "1.0.0"

  // Define an entity
  entity User {
    id: UUID [immutable, unique]
    email: String [unique, indexed]
    name: String
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      - email.contains("@")
      - name.length > 0
    }
  }

  // Define a behavior
  behavior CreateUser {
    description: "Create a new user account"

    actors {
      Admin {
        must: authenticated
      }
    }

    input {
      email: String
      name: String
    }

    output {
      success: User

      errors {
        EMAIL_EXISTS {
          when: "Email already registered"
          retriable: false
        }
        INVALID_EMAIL {
          when: "Email format is invalid"
          retriable: false
        }
      }
    }

    preconditions {
      - input.email.contains("@")
      - input.name.length > 0
    }

    postconditions {
      success implies {
        - User.exists(result.id)
        - User.email == input.email
        - User.name == input.name
      }
    }

    temporal {
      - within 500ms (p99): response returned
    }
  }

  // Define a test scenario
  scenario "Create user with valid email" {
    given: { no existing user with email "test@example.com" }
    when: CreateUser(email: "test@example.com", name: "Test User")
    then: success with User where email == "test@example.com"
  }
}
`;
    fs.writeFileSync(examplePath, exampleContent);

    // Open the example file
    const doc = await vscode.workspace.openTextDocument(examplePath);
    await vscode.window.showTextDocument(doc);

    vscode.window.showInformationMessage('ISL project initialized successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to initialize project: ${message}`);
  }
}

/**
 * Verify spec using interpreter
 */
async function verifySpec(
  client: LanguageClient | undefined,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  const editor = getActiveIslFile();
  if (!editor) return;

  try {
    outputChannel.appendLine(`Verifying: ${editor.document.fileName}`);
    outputChannel.show(true);

    if (client) {
      const result = await client.sendRequest<{
        success: boolean;
        scenarios: Array<{ name: string; passed: boolean; error?: string }>;
        coverage: number;
      }>(
        'isl/verify',
        { uri: editor.document.uri.toString() }
      );

      outputChannel.appendLine(`\nVerification Results:`);
      outputChannel.appendLine(`Coverage: ${(result.coverage * 100).toFixed(1)}%`);
      outputChannel.appendLine(`\nScenarios:`);

      let passed = 0;
      let failed = 0;
      result.scenarios.forEach(scenario => {
        const status = scenario.passed ? '✓' : '✗';
        outputChannel.appendLine(`  ${status} ${scenario.name}`);
        if (scenario.error) {
          outputChannel.appendLine(`    Error: ${scenario.error}`);
        }
        scenario.passed ? passed++ : failed++;
      });

      outputChannel.appendLine(`\nTotal: ${passed} passed, ${failed} failed`);

      if (result.success) {
        vscode.window.showInformationMessage(`Verification passed: ${passed} scenarios ✓`);
      } else {
        vscode.window.showWarningMessage(`Verification: ${passed} passed, ${failed} failed`);
      }
      return;
    }

    // Fallback: use CLI
    await runCliCommand('verify', editor.document.fileName);
  } catch (error) {
    handleError('Verification failed', error, outputChannel);
  }
}

/**
 * Restart the language server
 */
async function restartServer(
  context: vscode.ExtensionContext,
  getClient: () => LanguageClient | undefined,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  outputChannel.appendLine('Restarting language server...');

  const client = getClient();
  if (client) {
    try {
      await client.stop();
    } catch {
      // Ignore errors when stopping
    }
  }

  // Trigger restart by re-executing the activate command
  await vscode.commands.executeCommand('workbench.action.reloadWindow');
}

/**
 * Run CLI command as fallback
 */
async function runCliCommand(...args: string[]): Promise<void> {
  const terminal = vscode.window.createTerminal({
    name: 'ISL',
    iconPath: new vscode.ThemeIcon('terminal')
  });
  terminal.show();
  terminal.sendText(`npx isl ${args.join(' ')}`);
}

/**
 * Handle errors consistently
 */
function handleError(prefix: string, error: unknown, outputChannel: vscode.OutputChannel): void {
  const message = error instanceof Error ? error.message : String(error);
  outputChannel.appendLine(`${prefix}: ${message}`);
  vscode.window.showErrorMessage(`${prefix}: ${message}`);
}
