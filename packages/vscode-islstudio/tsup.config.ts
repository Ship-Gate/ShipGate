import { defineConfig } from 'tsup';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const cliBanner = `// CLI shim — graceful fallback when run outside VS Code
if (typeof process !== 'undefined' && process.argv[1] && !process.env.VSCODE_PID && !process.env.VSCODE_IPC_HOOK) {
  try { require('vscode'); } catch (_e) {
    var _args = process.argv.slice(2);
    if (_args.length > 0) {
      var _r = require('child_process').spawnSync('npx', ['--yes', 'shipgate'].concat(_args), { stdio: 'inherit', cwd: process.cwd() });
      process.exit(_r.status || 0);
    } else {
      console.log('ISL Studio VS Code Extension — use inside VS Code or: npx shipgate <command>');
      process.exit(0);
    }
  }
}
`;

export default defineConfig({
  entry: ['src/extension.ts'],
  format: ['cjs'],
  clean: true,
  external: ['vscode'],
  splitting: false,
  treeshake: true,
  async onSuccess() {
    const out = join('dist', 'extension.js');
    const src = readFileSync(out, 'utf8');
    writeFileSync(out, cliBanner + src);
  },
});
