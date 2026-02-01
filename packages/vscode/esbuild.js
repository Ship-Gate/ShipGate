// @ts-check
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',
  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location) {
          console.error(`    ${location.file}:${location.line}:${location.column}:`);
        }
      });
      console.log('[watch] build finished');
    });
  },
};

/**
 * Copy the LSP server to the dist folder for bundling
 * @type {import('esbuild').Plugin}
 */
const copyServerPlugin = {
  name: 'copy-server',
  setup(build) {
    build.onEnd(() => {
      const serverSrcDir = path.join(__dirname, '..', 'lsp-server', 'dist');
      const serverDestDir = path.join(__dirname, 'server');

      // Create server directory if it doesn't exist
      if (!fs.existsSync(serverDestDir)) {
        fs.mkdirSync(serverDestDir, { recursive: true });
      }

      // Copy server files if source exists
      if (fs.existsSync(serverSrcDir)) {
        copyDir(serverSrcDir, serverDestDir);
        console.log('[copy-server] LSP server copied to extension');
      } else {
        console.warn('[copy-server] LSP server not found at', serverSrcDir);
        console.warn('[copy-server] Extension will work without bundled server');
      }
    });
  },
};

/**
 * Recursively copy directory
 * @param {string} src
 * @param {string} dest
 */
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'info',
    plugins: [
      copyServerPlugin,
      ...(watch ? [esbuildProblemMatcherPlugin] : []),
    ],
    // Tree-shaking and optimization
    treeShaking: true,
    // Target Node.js version used by VS Code
    target: 'node18',
    // Keep names for better error messages
    keepNames: !production,
    // Analyze bundle size in production
    metafile: production,
  });

  if (watch) {
    await ctx.watch();
    console.log('[watch] watching for changes...');
  } else {
    const result = await ctx.rebuild();
    
    // Print bundle analysis in production
    if (production && result.metafile) {
      const analysis = await esbuild.analyzeMetafile(result.metafile, {
        verbose: false,
      });
      console.log('\nBundle analysis:\n' + analysis);
      
      // Check bundle size
      const stats = fs.statSync('dist/extension.js');
      const sizeKB = (stats.size / 1024).toFixed(2);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`\nBundle size: ${sizeKB} KB (${sizeMB} MB)`);
      
      if (stats.size > 5 * 1024 * 1024) {
        console.warn('\n⚠️  Warning: Bundle size exceeds 5MB target!');
      } else {
        console.log('✓ Bundle size is within 5MB target');
      }
    }
    
    await ctx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
