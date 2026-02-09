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
 * Create the language client that connects to the ISL LSP server.
 */
export function createLanguageClient(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
): LanguageClient {
  const config = vscode.workspace.getConfiguration('shipgate');

  // Custom path takes precedence
  const customServerPath = config.get<string>('server.path');
  const serverModule = customServerPath || findServerModule(context);

  if (!serverModule) {
    throw new Error(
      'ISL language server not found. The extension will provide syntax highlighting only.\n' +
        'For full LSP support:\n' +
        '  1. Build the monorepo: pnpm build\n' +
        '  2. Install globally: npm install -g @isl-lang/lsp-server\n' +
        '  3. Set shipgate.server.path in settings'
    );
  }

  outputChannel.appendLine(`[ShipGate] Using language server: ${serverModule}`);

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

  const traceLevel = config.get<string>('trace.server', 'off');

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'isl' },
      { scheme: 'untitled', language: 'isl' },
    ],
    synchronize: {
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
      workspaceFolders: vscode.workspace.workspaceFolders?.map((f) => f.uri.toString()),
    },
    progressOnInitialization: true,
  };

  const client = new LanguageClient('isl', 'ISL Language Server', serverOptions, clientOptions);

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
 * Start the language client and register notification handlers.
 */
export async function startClient(client: LanguageClient): Promise<void> {
  await client.start();

  // Respond to server config requests
  client.onRequest('isl/getConfiguration', () => getServerSettings());
}

/**
 * Gracefully stop the language client.
 */
export async function stopClient(client: LanguageClient): Promise<void> {
  if (client.isRunning()) {
    await client.stop();
  }
}

// ---------------------------------------------------------------------------
// Server discovery
// ---------------------------------------------------------------------------

/**
 * Find the server module in common locations.
 *
 * Priority:
 *   1. Bundled with extension (server/index.js — copied by esbuild plugin)
 *   2. Monorepo sibling (../lsp-server/dist/index.js)
 *   3. Workspace node_modules (@isl-lang/lsp-server)
 *   4. Global npm installation
 */
function findServerModule(context: vscode.ExtensionContext): string | undefined {
  const candidates = [
    // Bundled with extension
    context.asAbsolutePath(path.join('server', 'index.js')),
    context.asAbsolutePath(path.join('server', 'cli.js')),

    // Alternative bundle location
    context.asAbsolutePath(path.join('dist', 'server', 'index.js')),

    // Monorepo sibling
    path.join(context.extensionPath, '..', 'lsp-server', 'dist', 'index.js'),

    // node_modules (@isl-lang scope)
    context.asAbsolutePath(
      path.join('node_modules', '@isl-lang', 'lsp-server', 'dist', 'index.js')
    ),

    // Workspace node_modules
    ...(vscode.workspace.workspaceFolders?.map((folder) =>
      path.join(folder.uri.fsPath, 'node_modules', '@isl-lang', 'lsp-server', 'dist', 'index.js')
    ) ?? []),

    // Global npm (Windows)
    path.join(
      process.env.APPDATA ?? '',
      'npm',
      'node_modules',
      '@isl-lang',
      'lsp-server',
      'dist',
      'index.js'
    ),

    // Global npm (Unix)
    path.join(
      process.env.HOME ?? '',
      '.npm-global',
      'lib',
      'node_modules',
      '@isl-lang',
      'lsp-server',
      'dist',
      'index.js'
    ),

    // pnpm global
    path.join(
      process.env.PNPM_HOME ??
        path.join(process.env.HOME ?? '', '.local', 'share', 'pnpm'),
      'global',
      '5',
      'node_modules',
      '@isl-lang',
      'lsp-server',
      'dist',
      'index.js'
    ),
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function getServerSettings(): Record<string, unknown> {
  const config = vscode.workspace.getConfiguration('shipgate');

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
