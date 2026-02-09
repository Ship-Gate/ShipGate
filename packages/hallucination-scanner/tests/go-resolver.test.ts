import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { resolveGo, scanGoFile } from '../src/go/go-resolver.js';
import { isGoStdlib, hasStdlibPrefix } from '../src/go/stdlib.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fixturesDir = path.resolve(__dirname, '../../../test-fixtures/go');

const GO_MOD_CONTENT = `module myapp

go 1.22

require (
\tgithub.com/gorilla/mux v1.8.1
\tgithub.com/sirupsen/logrus v1.9.3
)
`;

const VALID_GO_SOURCE = `package main

import (
\t"fmt"
\t"net/http"
\t"encoding/json"
\t"os"
\t"context"
\t"github.com/gorilla/mux"
\t"github.com/sirupsen/logrus"
\t"myapp/internal/handler"
)

func main() {
\tfmt.Println("hello")
\t_ = http.StatusOK
\t_ = json.Marshal
\t_ = os.Getenv("PORT")
\t_ = context.Background()
\t_ = mux.NewRouter()
\tlogrus.Info("started")
\t_ = handler.Health
}
`;

const GHOST_GO_SOURCE = `package main

import (
\t"fmt"
\t"net/http"
\t"encoding/jsonx"
\t"crypto/quantum"
\t"github.com/nonexistent/fakepkg"
\t"github.com/totally/madeup/v2"
\t"github.com/hallucinated/aipackage"
\t"myapp/internal/doesnotexist"
)

func main() {
\tfmt.Println("This file has ghost imports")
\t_ = http.StatusOK
}
`;

const SINGLE_IMPORT_SOURCE = `package main

import "fmt"

func main() {
\tfmt.Println("hello")
}
`;

// ---------------------------------------------------------------------------
// stdlib
// ---------------------------------------------------------------------------

describe('go stdlib', () => {
  it('recognizes standard library packages', () => {
    expect(isGoStdlib('fmt')).toBe(true);
    expect(isGoStdlib('net/http')).toBe(true);
    expect(isGoStdlib('encoding/json')).toBe(true);
    expect(isGoStdlib('os')).toBe(true);
    expect(isGoStdlib('context')).toBe(true);
    expect(isGoStdlib('crypto/tls')).toBe(true);
    expect(isGoStdlib('io')).toBe(true);
    expect(isGoStdlib('sync')).toBe(true);
    expect(isGoStdlib('testing')).toBe(true);
  });

  it('rejects non-stdlib packages', () => {
    expect(isGoStdlib('github.com/gorilla/mux')).toBe(false);
    expect(isGoStdlib('encoding/jsonx')).toBe(false);
    expect(isGoStdlib('crypto/quantum')).toBe(false);
    expect(isGoStdlib('myapp/internal/handler')).toBe(false);
  });

  it('hasStdlibPrefix detects potential stdlib misspellings', () => {
    expect(hasStdlibPrefix('encoding/jsonx')).toBe(true);
    expect(hasStdlibPrefix('crypto/quantum')).toBe(true);
    expect(hasStdlibPrefix('fmt')).toBe(true);
    expect(hasStdlibPrefix('net/http')).toBe(true);
  });

  it('hasStdlibPrefix rejects external packages', () => {
    expect(hasStdlibPrefix('github.com/gorilla/mux')).toBe(false);
    expect(hasStdlibPrefix('myapp/internal/handler')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveGo — unit tests with in-memory fixtures
// ---------------------------------------------------------------------------

describe('resolveGo', () => {
  it('succeeds for valid Go source with all imports declared', async () => {
    const result = await resolveGo({
      projectRoot: '/fake/project',
      entries: ['/fake/project/main.go'],
      goModContent: GO_MOD_CONTENT,
      readFile: async (p) => {
        if (p.endsWith('main.go')) return VALID_GO_SOURCE;
        throw new Error(`file not found: ${p}`);
      },
      fileExists: async (p) => {
        // internal/handler exists
        if (p.includes('internal/handler') || p.includes('internal\\handler')) return true;
        if (p.endsWith('main.go')) return true;
        if (p.endsWith('go.mod')) return true;
        return false;
      },
    });

    expect(result.success).toBe(true);
    expect(result.findings).toHaveLength(0);
    expect(result.trustScore).toBe(100);
    expect(result.missingModules).toHaveLength(0);
  });

  it('parses go.mod and populates declared modules', async () => {
    const result = await resolveGo({
      projectRoot: '/fake/project',
      entries: [],
      goModContent: GO_MOD_CONTENT,
    });

    expect(result.goMod).not.toBeNull();
    expect(result.goMod!.modulePath).toBe('myapp');
    expect(result.goMod!.goVersion).toBe('1.22');
    expect(result.declaredModules.has('github.com/gorilla/mux')).toBe(true);
    expect(result.declaredModules.has('github.com/sirupsen/logrus')).toBe(true);
  });

  it('classifies stdlib imports correctly', async () => {
    const result = await resolveGo({
      projectRoot: '/fake/project',
      entries: ['/fake/project/main.go'],
      goModContent: GO_MOD_CONTENT,
      readFile: async () => VALID_GO_SOURCE,
      fileExists: async (p) => {
        if (p.includes('internal/handler') || p.includes('internal\\handler')) return true;
        return p.endsWith('main.go') || p.endsWith('go.mod');
      },
    });

    const stdlibImports = result.imports.filter(i => i.isStdlib);
    const stdlibPaths = stdlibImports.map(i => i.path);
    expect(stdlibPaths).toContain('fmt');
    expect(stdlibPaths).toContain('net/http');
    expect(stdlibPaths).toContain('encoding/json');
    expect(stdlibPaths).toContain('os');
    expect(stdlibPaths).toContain('context');
  });

  it('classifies internal imports correctly', async () => {
    const result = await resolveGo({
      projectRoot: '/fake/project',
      entries: ['/fake/project/main.go'],
      goModContent: GO_MOD_CONTENT,
      readFile: async () => VALID_GO_SOURCE,
      fileExists: async (p) => {
        if (p.includes('internal/handler') || p.includes('internal\\handler')) return true;
        return p.endsWith('main.go') || p.endsWith('go.mod');
      },
    });

    const internalImports = result.imports.filter(i => i.isInternal);
    expect(internalImports.length).toBeGreaterThanOrEqual(1);
    expect(internalImports.some(i => i.path === 'myapp/internal/handler')).toBe(true);
  });

  it('classifies external imports correctly', async () => {
    const result = await resolveGo({
      projectRoot: '/fake/project',
      entries: ['/fake/project/main.go'],
      goModContent: GO_MOD_CONTENT,
      readFile: async () => VALID_GO_SOURCE,
      fileExists: async (p) => {
        if (p.includes('internal/handler') || p.includes('internal\\handler')) return true;
        return p.endsWith('main.go') || p.endsWith('go.mod');
      },
    });

    const externalImports = result.imports.filter(i => i.isExternal);
    const externalPaths = externalImports.map(i => i.path);
    expect(externalPaths).toContain('github.com/gorilla/mux');
    expect(externalPaths).toContain('github.com/sirupsen/logrus');
  });

  it('detects ghost imports — fake stdlib packages', async () => {
    const result = await resolveGo({
      projectRoot: '/fake/project',
      entries: ['/fake/project/ghost.go'],
      goModContent: GO_MOD_CONTENT,
      readFile: async () => GHOST_GO_SOURCE,
      fileExists: async (p) => {
        if (p.endsWith('ghost.go') || p.endsWith('go.mod')) return true;
        return false;
      },
    });

    expect(result.success).toBe(false);

    // "encoding/jsonx" and "crypto/quantum" should be flagged as unknown_stdlib
    const unknownStdlib = result.findings.filter(f => f.kind === 'unknown_stdlib');
    const unknownPaths = unknownStdlib.map(f => f.importPath);
    expect(unknownPaths).toContain('encoding/jsonx');
    expect(unknownPaths).toContain('crypto/quantum');
  });

  it('detects ghost imports — missing external modules', async () => {
    const result = await resolveGo({
      projectRoot: '/fake/project',
      entries: ['/fake/project/ghost.go'],
      goModContent: GO_MOD_CONTENT,
      readFile: async () => GHOST_GO_SOURCE,
      fileExists: async (p) => {
        if (p.endsWith('ghost.go') || p.endsWith('go.mod')) return true;
        return false;
      },
    });

    // "github.com/nonexistent/fakepkg" etc. should be flagged as missing_module
    const missingModules = result.findings.filter(f => f.kind === 'missing_module');
    expect(missingModules.length).toBeGreaterThanOrEqual(3);
    const missingPaths = missingModules.map(f => f.importPath);
    expect(missingPaths).toContain('github.com/nonexistent/fakepkg');
    expect(missingPaths).toContain('github.com/totally/madeup/v2');
    expect(missingPaths).toContain('github.com/hallucinated/aipackage');
  });

  it('detects unresolved internal packages', async () => {
    const result = await resolveGo({
      projectRoot: '/fake/project',
      entries: ['/fake/project/ghost.go'],
      goModContent: GO_MOD_CONTENT,
      readFile: async () => GHOST_GO_SOURCE,
      fileExists: async (p) => {
        if (p.endsWith('ghost.go') || p.endsWith('go.mod')) return true;
        return false;
      },
    });

    const unresolvedInternal = result.findings.filter(f => f.kind === 'unresolved_internal');
    expect(unresolvedInternal.length).toBeGreaterThanOrEqual(1);
    expect(unresolvedInternal.some(f => f.importPath === 'myapp/internal/doesnotexist')).toBe(true);
  });

  it('does not flag real stdlib imports', async () => {
    const result = await resolveGo({
      projectRoot: '/fake/project',
      entries: ['/fake/project/ghost.go'],
      goModContent: GO_MOD_CONTENT,
      readFile: async () => GHOST_GO_SOURCE,
      fileExists: async (p) => {
        if (p.endsWith('ghost.go') || p.endsWith('go.mod')) return true;
        return false;
      },
    });

    // "fmt" and "net/http" are real — should not appear in findings
    const allFindingPaths = result.findings.map(f => f.importPath);
    expect(allFindingPaths).not.toContain('fmt');
    expect(allFindingPaths).not.toContain('net/http');
  });

  it('computes trust score with penalty for findings', async () => {
    const result = await resolveGo({
      projectRoot: '/fake/project',
      entries: ['/fake/project/ghost.go'],
      goModContent: GO_MOD_CONTENT,
      readFile: async () => GHOST_GO_SOURCE,
      fileExists: async (p) => {
        if (p.endsWith('ghost.go') || p.endsWith('go.mod')) return true;
        return false;
      },
    });

    expect(result.trustScore).toBeLessThan(100);
    expect(result.trustScore).toBeGreaterThanOrEqual(0);
  });

  it('handles single-line import syntax', async () => {
    const result = await resolveGo({
      projectRoot: '/fake/project',
      entries: ['/fake/project/main.go'],
      goModContent: GO_MOD_CONTENT,
      readFile: async () => SINGLE_IMPORT_SOURCE,
      fileExists: async () => true,
    });

    expect(result.imports).toHaveLength(1);
    expect(result.imports[0].path).toBe('fmt');
    expect(result.imports[0].isStdlib).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it('handles project with no go.mod gracefully', async () => {
    const result = await resolveGo({
      projectRoot: '/fake/project',
      entries: ['/fake/project/main.go'],
      readFile: async () => `package main\nimport "github.com/some/pkg"\nfunc main() {}\n`,
      fileExists: async () => false,
    });

    expect(result.goMod).toBeNull();
    // External import without go.mod should be flagged as fake_package
    const fakeFindings = result.findings.filter(f => f.kind === 'fake_package');
    expect(fakeFindings.length).toBeGreaterThanOrEqual(1);
  });

  it('handles empty Go file', async () => {
    const result = await resolveGo({
      projectRoot: '/fake/project',
      entries: ['/fake/project/empty.go'],
      goModContent: GO_MOD_CONTENT,
      readFile: async () => 'package main\n',
      fileExists: async () => true,
    });

    expect(result.imports).toHaveLength(0);
    expect(result.findings).toHaveLength(0);
    expect(result.trustScore).toBe(100);
  });

  it('populates missing modules list', async () => {
    const result = await resolveGo({
      projectRoot: '/fake/project',
      entries: ['/fake/project/ghost.go'],
      goModContent: GO_MOD_CONTENT,
      readFile: async () => GHOST_GO_SOURCE,
      fileExists: async (p) => {
        if (p.endsWith('ghost.go') || p.endsWith('go.mod')) return true;
        return false;
      },
    });

    expect(result.missingModules.length).toBeGreaterThan(0);
    expect(result.missingModules).toContain('github.com/nonexistent/fakepkg');
  });
});

// ---------------------------------------------------------------------------
// scanGoFile — convenience wrapper
// ---------------------------------------------------------------------------

describe('scanGoFile', () => {
  it('returns imports and findings for a single file', async () => {
    const result = await scanGoFile(
      '/fake/project/main.go',
      VALID_GO_SOURCE,
      { projectRoot: '/fake/project' }
    );

    expect(result.imports.length).toBeGreaterThan(0);
    expect(result.checkResult).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Integration: real fixtures on disk
// ---------------------------------------------------------------------------

describe('integration: fixtures on disk', () => {
  it('resolves valid Go fixture with no ghost imports for declared deps', async () => {
    const result = await resolveGo({
      projectRoot: fixturesDir,
      entries: [path.join(fixturesDir, 'valid', 'main.go')],
    });

    // Stdlib imports should not be flagged
    const stdlibFindings = result.findings.filter(f =>
      f.importPath === 'fmt' || f.importPath === 'net/http' ||
      f.importPath === 'encoding/json' || f.importPath === 'os' ||
      f.importPath === 'context'
    );
    expect(stdlibFindings).toHaveLength(0);

    // Declared external modules should not be flagged
    const declaredExtFindings = result.findings.filter(f =>
      f.importPath === 'github.com/gorilla/mux' ||
      f.importPath === 'github.com/sirupsen/logrus'
    );
    expect(declaredExtFindings).toHaveLength(0);
  });

  it('detects ghost imports in invalid Go fixture', async () => {
    const invalidDir = path.join(fixturesDir, 'invalid');
    const result = await resolveGo({
      projectRoot: fixturesDir, // Use parent dir so go.mod is found
      entries: [path.join(invalidDir, 'ghost-imports.go')],
    });

    // Resolver should report findings for ghost imports
    // Note: resolver may succeed (success=true) if it can parse everything,
    // but should still report findings for invalid imports
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings.length).toBeGreaterThan(0);

    // encoding/jsonx, crypto/quantum should be unknown_stdlib
    const unknownStdlib = result.findings.filter(f => f.kind === 'unknown_stdlib');
    expect(unknownStdlib.length).toBeGreaterThanOrEqual(2);

    // ghost external packages should be missing_module
    const missingModule = result.findings.filter(f => f.kind === 'missing_module');
    expect(missingModule.length).toBeGreaterThanOrEqual(3);
  });
});
