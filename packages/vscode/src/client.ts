/**
 * ISL Language Server Client
 *
 * Manages the connection to the ISL Language Server Protocol (LSP) server.
 * Supports bundled server, custom server path, and workspace installation.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  Trace,
} from 'vscode-languageclient/node';

/**
 * Create the language client
 */
export function createLanguageClient(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
): LanguageClient {
  const config = vscode.workspace.getConfiguration('isl');
  
  // Check for custom server path first (isl.server.path takes precedence)
  const customServerPath = config.get<string>('server.path') || config.get<string>('languageServer.path');

  // Determine server module path
  const serverModule = customServerPath || findServerModule(context);

  if (!serverModule) {
    throw new Error(
      'ISL language server not found. The extension will work with basic syntax highlighting only. ' +
      'For full LSP support, either:\n' +
      '1. Build the extension with `npm run build` to bundle the server\n' +
      '2. Install @intentos/lsp-server globally: npm install -g @intentos/lsp-server\n' +
      '3. Set isl.server.path in settings to point to the server'
    );
  }

  outputChannel.appendLine(`Using language server: ${serverModule}`);

  // Server options - run the server as a Node.js module
  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        env: {
          ...process.env,
          ISL_LSP_MODE: 'extension',
        },
      },
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        execArgv: ['--nolazy', '--inspect=6009'],
        env: {
          ...process.env,
          ISL_LSP_MODE: 'extension',
          ISL_LSP_DEBUG: 'true',
        },
      },
    },
  };

  // Get trace level from settings
  const traceLevel = config.get<string>('trace.server', 'off');

  // Client options
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'isl' },
      { scheme: 'untitled', language: 'isl' },
    ],
    synchronize: {
      // Notify server about file changes to .isl files and config files
      fileEvents: [
        vscode.workspace.createFileSystemWatcher('**/*.isl'),
        vscode.workspace.createFileSystemWatcher('**/.islrc.json'),
        vscode.workspace.createFileSystemWatcher('**/islrc.json'),
      ],
    },
    outputChannel,
    traceOutputChannel: outputChannel,
    initializationOptions: {
      settings: getServerSettings(),
      workspaceFolders: vscode.workspace.workspaceFolders?.map(f => f.uri.toString()),
    },
    // Progress reporting
    progressOnInitialization: true,
    // Middleware for custom handling
    middleware: {
      // Log workspace configuration requests
      workspace: {
        configuration: async (params, token, next) => {
          const result = await next(params, token);
          outputChannel.appendLine(`Configuration requested: ${JSON.stringify(params.items)}`);
          return result;
        },
      },
    },
  };

  const client = new LanguageClient(
    'isl',
    'ISL Language Server',
    serverOptions,
    clientOptions
  );

  // Set trace level
  switch (traceLevel) {
    case 'verbose':
      client.setTrace(Trace.Verbose);
      break;
    case 'messages':
      client.setTrace(Trace.Messages);
      break;
    default:
      client.setTrace(Trace.Off);
  }

  return client;
}

/**
 * Start the language client
 */
export async function startClient(client: LanguageClient): Promise<void> {
  await client.start();

  // Register custom request handlers
  client.onRequest('isl/getConfiguration', () => {
    return getServerSettings();
  });

  // Handle server notifications
  client.onNotification('isl/status', (params: { status: string; message?: string }) => {
    if (params.status === 'ready') {
      vscode.window.setStatusBarMessage('ISL: Ready', 3000);
    } else if (params.status === 'error' && params.message) {
      vscode.window.showErrorMessage(`ISL Server: ${params.message}`);
    }
  });

  // Handle window/logMessage for debugging
  client.onNotification('window/logMessage', (params: { type: number; message: string }) => {
    const config = vscode.workspace.getConfiguration('isl');
    const traceLevel = config.get<string>('trace.server', 'off');
    if (traceLevel !== 'off') {
      client.outputChannel.appendLine(`[Server] ${params.message}`);
    }
  });
}

/**
 * Stop the language client
 */
export async function stopClient(client: LanguageClient): Promise<void> {
  if (client.isRunning()) {
    await client.stop();
  }
}

/**
 * Find the server module in common locations
 * Priority:
 * 1. Bundled with extension (server/index.js)
 * 2. Workspace node_modules
 * 3. Global npm installation
 */
function findServerModule(context: vscode.ExtensionContext): string | undefined {
  const possiblePaths = [
    // Bundled with extension (primary - created by esbuild)
    context.asAbsolutePath(path.join('server', 'index.js')),
    context.asAbsolutePath(path.join('server', 'server.js')),
    context.asAbsolutePath(path.join('server', 'cli.js')),
    
    // Alternative bundle locations
    context.asAbsolutePath(path.join('dist', 'server', 'index.js')),
    context.asAbsolutePath(path.join('node_modules', '@intentos', 'lsp-server', 'dist', 'index.js')),

    // Workspace installation (monorepo sibling)
    path.join(context.extensionPath, '..', 'lsp-server', 'dist', 'index.js'),

    // Workspace node_modules
    ...(vscode.workspace.workspaceFolders?.map(folder =>
      path.join(folder.uri.fsPath, 'node_modules', '@intentos', 'lsp-server', 'dist', 'index.js')
    ) || []),

    // Global npm installation (Windows)
    path.join(
      process.env.APPDATA || '',
      'npm',
      'node_modules',
      '@intentos',
      'lsp-server',
      'dist',
      'index.js'
    ),

    // Global npm installation (Unix)
    path.join(
      process.env.HOME || '',
      '.npm-global',
      'lib',
      'node_modules',
      '@intentos',
      'lsp-server',
      'dist',
      'index.js'
    ),

    // pnpm global
    path.join(
      process.env.PNPM_HOME || path.join(process.env.HOME || '', '.local', 'share', 'pnpm'),
      'global',
      '5',
      'node_modules',
      '@intentos',
      'lsp-server',
      'dist',
      'index.js'
    ),
  ];

  for (const serverPath of possiblePaths) {
    if (serverPath && fs.existsSync(serverPath)) {
      return serverPath;
    }
  }

  return undefined;
}

/**
 * Get server settings from VS Code configuration
 */
function getServerSettings(): Record<string, unknown> {
  const config = vscode.workspace.getConfiguration('isl');

  return {
    validation: {
      enabled: config.get<boolean>('validation.enabled', true),
    },
    codegen: {
      outputDir: config.get<string>('codegen.outputDir', 'generated'),
      target: config.get<string>('defaultTarget', 'typescript'),
    },
    format: {
      onSave: config.get<boolean>('formatOnSave', true),
    },
    lint: {
      onSave: config.get<boolean>('lintOnSave', true),
    },
    trace: {
      server: config.get<string>('trace.server', 'off'),
    },
  };
}
