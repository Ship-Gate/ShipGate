import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const TOP_PACKAGES = [
  'react', 'next', 'express', 'lodash', 'axios', 'moment', 'typescript',
  'webpack', 'babel', 'jest', 'mocha', 'chai', 'eslint', 'prettier',
  'vue', 'angular', 'svelte', 'fastify', 'koa', 'hono', 'prisma',
  'mongoose', 'sequelize', 'knex', 'pg', 'mysql', 'redis', 'ioredis',
  'chalk', 'commander', 'yargs', 'inquirer', 'ora', 'dotenv', 'zod',
  'joi', 'yup', 'passport', 'bcrypt', 'jsonwebtoken', 'uuid', 'dayjs',
  'date-fns', 'rxjs', 'socket.io', 'graphql', 'apollo', 'stripe',
  'aws-sdk', 'firebase', 'supabase', 'drizzle-orm', 'turbo', 'vite',
  'esbuild', 'tsup', 'vitest', 'playwright', 'puppeteer', 'cheerio',
  'sharp', 'jimp', 'multer', 'formidable', 'cors', 'helmet', 'morgan',
  'winston', 'pino', 'bunyan', 'debug', 'nodemon', 'ts-node', 'tsx',
  'tailwindcss', 'postcss', 'sass', 'less', 'styled-components',
  'emotion', 'framer-motion', 'three', 'd3', 'chart.js', 'recharts',
];

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    prev = curr;
  }
  return prev[n];
}

const DEPRECATED_APIS: Record<string, string> = {
  'request': 'Use axios, node-fetch, or undici instead',
  'querystring': 'Use URLSearchParams instead',
  'domain': 'Deprecated — use async_hooks or structured error handling',
  'punycode': 'Use the userland punycode package instead',
};

const diagnosticCollection = vscode.languages.createDiagnosticCollection('shipgate-supply-chain');

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(diagnosticCollection);

  if (vscode.workspace.getConfiguration('shipgate').get('supplyChain.checkOnOpen', true)) {
    checkWorkspacePackages();
  }

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.fileName.endsWith('package.json')) {
        checkPackageJson(doc);
      }
    })
  );
}

function checkWorkspacePackages(): void {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) return;

  for (const folder of folders) {
    const pkgPath = path.join(folder.uri.fsPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      vscode.workspace.openTextDocument(vscode.Uri.file(pkgPath)).then(
        (doc) => checkPackageJson(doc),
        () => { /* ignore */ }
      );
    }
  }
}

function checkPackageJson(doc: vscode.TextDocument): void {
  const diagnostics: vscode.Diagnostic[] = [];
  const text = doc.getText();

  let pkg: any;
  try {
    pkg = JSON.parse(text);
  } catch {
    return;
  }

  const allDeps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };

  for (const [name] of Object.entries(allDeps)) {
    for (const popular of TOP_PACKAGES) {
      if (name === popular) continue;
      const dist = levenshtein(name, popular);
      if (dist === 1 && name.length > 2) {
        const lineIdx = findDependencyLine(text, name);
        if (lineIdx >= 0) {
          const range = new vscode.Range(lineIdx, 0, lineIdx, doc.lineAt(lineIdx).text.length);
          const diag = new vscode.Diagnostic(
            range,
            `Possible typosquat: "${name}" is very similar to "${popular}" (Levenshtein distance: 1)`,
            vscode.DiagnosticSeverity.Warning
          );
          diag.source = 'ShipGate';
          diag.code = 'SG-TYPOSQUAT';
          diagnostics.push(diag);
        }
      }
    }

    if (DEPRECATED_APIS[name]) {
      const lineIdx = findDependencyLine(text, name);
      if (lineIdx >= 0) {
        const range = new vscode.Range(lineIdx, 0, lineIdx, doc.lineAt(lineIdx).text.length);
        const diag = new vscode.Diagnostic(
          range,
          `Deprecated package "${name}": ${DEPRECATED_APIS[name]}`,
          vscode.DiagnosticSeverity.Warning
        );
        diag.source = 'ShipGate';
        diag.code = 'SG-DEPRECATED';
        diagnostics.push(diag);
      }
    }
  }

  diagnosticCollection.set(doc.uri, diagnostics);
}

function findDependencyLine(text: string, pkgName: string): number {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`"${pkgName}"`)) return i;
  }
  return -1;
}

export function deactivate(): void {
  diagnosticCollection.dispose();
}
