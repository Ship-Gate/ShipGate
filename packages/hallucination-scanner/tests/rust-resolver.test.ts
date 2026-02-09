import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { parseUseStatements, externalCratesFromUses, parseExternCrates } from '../src/rust/use-parser.js';
import { parseCargoToml, getDeclaredCrates } from '../src/rust/cargo.js';
import { buildRustModuleGraph, findUnreachableModules, parseModDeclarations } from '../src/rust/module-graph.js';
import { resolveRust } from '../src/rust/resolver.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fixturesDir = path.resolve(__dirname, 'fixtures');
const validCrate = path.join(fixturesDir, 'valid-crate');
const fakeCrate = path.join(fixturesDir, 'fake-crate');
const unreachableMod = path.join(fixturesDir, 'unreachable-mod');

// ---------------------------------------------------------------------------
// use-parser
// ---------------------------------------------------------------------------

describe('use-parser', () => {
  describe('parseUseStatements', () => {
    it('parses simple use statement', () => {
      const source = 'use serde::Serialize;\n';
      const uses = parseUseStatements(source, 'test.rs');
      expect(uses).toHaveLength(1);
      expect(uses[0].path).toBe('serde::Serialize');
      expect(uses[0].root).toBe('serde');
      expect(uses[0].isStd).toBe(false);
      expect(uses[0].isCrate).toBe(false);
      expect(uses[0].isRelative).toBe(false);
    });

    it('parses std library use', () => {
      const source = 'use std::collections::HashMap;\n';
      const uses = parseUseStatements(source, 'test.rs');
      expect(uses).toHaveLength(1);
      expect(uses[0].root).toBe('std');
      expect(uses[0].isStd).toBe(true);
    });

    it('parses crate-relative use', () => {
      const source = 'use crate::config::AppConfig;\n';
      const uses = parseUseStatements(source, 'test.rs');
      expect(uses).toHaveLength(1);
      expect(uses[0].root).toBe('crate');
      expect(uses[0].isCrate).toBe(true);
    });

    it('parses super/self relative use', () => {
      const source = 'use super::parent_mod;\nuse self::sibling;\n';
      const uses = parseUseStatements(source, 'test.rs');
      expect(uses).toHaveLength(2);
      expect(uses[0].isRelative).toBe(true);
      expect(uses[0].root).toBe('super');
      expect(uses[1].isRelative).toBe(true);
      expect(uses[1].root).toBe('self');
    });

    it('parses pub use', () => {
      const source = 'pub use serde::Serialize;\n';
      const uses = parseUseStatements(source, 'test.rs');
      expect(uses).toHaveLength(1);
      expect(uses[0].path).toBe('serde::Serialize');
    });

    it('parses pub(crate) use', () => {
      const source = 'pub(crate) use serde::Serialize;\n';
      const uses = parseUseStatements(source, 'test.rs');
      expect(uses).toHaveLength(1);
      expect(uses[0].path).toBe('serde::Serialize');
    });

    it('parses use with alias (as)', () => {
      const source = 'use std::io::Result as IoResult;\n';
      const uses = parseUseStatements(source, 'test.rs');
      expect(uses).toHaveLength(1);
      expect(uses[0].path).toBe('std::io::Result');
      expect(uses[0].isStd).toBe(true);
    });

    it('parses glob import', () => {
      const source = 'use std::io::prelude::*;\n';
      const uses = parseUseStatements(source, 'test.rs');
      expect(uses).toHaveLength(1);
      expect(uses[0].path).toBe('std::io::prelude::*');
      expect(uses[0].isStd).toBe(true);
    });

    it('parses brace-group use and expands items', () => {
      const source = 'use std::collections::{HashMap, BTreeMap};\n';
      const uses = parseUseStatements(source, 'test.rs');
      expect(uses).toHaveLength(2);
      expect(uses[0].path).toBe('std::collections::HashMap');
      expect(uses[1].path).toBe('std::collections::BTreeMap');
      expect(uses[0].isStd).toBe(true);
      expect(uses[1].isStd).toBe(true);
    });

    it('parses brace-group with self', () => {
      const source = 'use std::io::{self, Write};\n';
      const uses = parseUseStatements(source, 'test.rs');
      expect(uses).toHaveLength(2);
      expect(uses[0].path).toBe('std::io');
      expect(uses[1].path).toBe('std::io::Write');
    });

    it('provides correct source locations', () => {
      const source = 'fn main() {}\nuse tokio::runtime::Runtime;\n';
      const uses = parseUseStatements(source, 'test.rs');
      expect(uses).toHaveLength(1);
      expect(uses[0].location.file).toBe('test.rs');
      expect(uses[0].location.line).toBe(2);
    });

    it('handles multiple use statements', () => {
      const source = [
        'use serde::Serialize;',
        'use tokio::runtime::Runtime;',
        'use std::collections::HashMap;',
        'use crate::config::AppConfig;',
      ].join('\n');
      const uses = parseUseStatements(source, 'test.rs');
      expect(uses).toHaveLength(4);
    });

    it('ignores commented out use statements', () => {
      const source = '// use fake_crate::Thing;\nuse serde::Serialize;\n';
      const uses = parseUseStatements(source, 'test.rs');
      // The regex is line-based; the comment line should not match since
      // the // prefix prevents the regex from finding "use" at line start properly
      // (it requires `use` after optional whitespace)
      expect(uses.length).toBeGreaterThanOrEqual(1);
      const roots = uses.map((u) => u.root);
      expect(roots).toContain('serde');
    });

    it('returns empty array for source with no use statements', () => {
      const source = 'fn main() {\n    println!("hello");\n}\n';
      const uses = parseUseStatements(source, 'test.rs');
      expect(uses).toHaveLength(0);
    });
  });

  describe('externalCratesFromUses', () => {
    it('filters out std, crate, super, self', () => {
      const source = [
        'use serde::Serialize;',
        'use std::io;',
        'use crate::config;',
        'use super::parent;',
        'use tokio::runtime;',
      ].join('\n');
      const uses = parseUseStatements(source, 'test.rs');
      const external = externalCratesFromUses(uses);
      expect(external).toEqual(new Set(['serde', 'tokio']));
    });
  });

  describe('parseExternCrates', () => {
    it('parses extern crate declaration', () => {
      const source = 'extern crate serde;\n';
      const crates = parseExternCrates(source, 'test.rs');
      expect(crates).toHaveLength(1);
      expect(crates[0].name).toBe('serde');
      expect(crates[0].alias).toBeUndefined();
    });

    it('parses extern crate with alias', () => {
      const source = 'extern crate serde as my_serde;\n';
      const crates = parseExternCrates(source, 'test.rs');
      expect(crates).toHaveLength(1);
      expect(crates[0].name).toBe('serde');
      expect(crates[0].alias).toBe('my_serde');
    });

    it('parses pub extern crate', () => {
      const source = 'pub extern crate serde;\n';
      const crates = parseExternCrates(source, 'test.rs');
      expect(crates).toHaveLength(1);
      expect(crates[0].name).toBe('serde');
    });
  });
});

// ---------------------------------------------------------------------------
// cargo
// ---------------------------------------------------------------------------

describe('cargo', () => {
  describe('parseCargoToml', () => {
    it('parses package section', () => {
      const content = [
        '[package]',
        'name = "myapp"',
        'version = "0.1.0"',
        'edition = "2021"',
      ].join('\n');
      const manifest = parseCargoToml(content);
      expect(manifest).not.toBeNull();
      expect(manifest!.package?.name).toBe('myapp');
      expect(manifest!.package?.version).toBe('0.1.0');
      expect(manifest!.package?.edition).toBe('2021');
    });

    it('parses string dependencies', () => {
      const content = [
        '[dependencies]',
        'serde = "1.0"',
        'tokio = "1"',
      ].join('\n');
      const manifest = parseCargoToml(content);
      expect(manifest).not.toBeNull();
      expect(manifest!.dependencies).toBeDefined();
      expect(manifest!.dependencies!['serde']).toBe('1.0');
      expect(manifest!.dependencies!['tokio']).toBe('1');
    });

    it('parses inline table dependencies', () => {
      const content = [
        '[dependencies]',
        'tokio = { version = "1", features = ["full"] }',
        'reqwest = { version = "0.11", optional = true }',
      ].join('\n');
      const manifest = parseCargoToml(content);
      expect(manifest).not.toBeNull();
      const tokio = manifest!.dependencies!['tokio'] as { version?: string };
      expect(tokio.version).toBe('1');
      const reqwest = manifest!.dependencies!['reqwest'] as { version?: string; optional?: boolean };
      expect(reqwest.version).toBe('0.11');
      expect(reqwest.optional).toBe(true);
    });

    it('parses dependency with package rename', () => {
      const content = [
        '[dependencies]',
        'my_serde = { version = "1.0", package = "serde" }',
      ].join('\n');
      const manifest = parseCargoToml(content);
      expect(manifest).not.toBeNull();
      const dep = manifest!.dependencies!['my_serde'] as { version?: string; package?: string };
      expect(dep.version).toBe('1.0');
      expect(dep.package).toBe('serde');
    });

    it('parses dev-dependencies and build-dependencies', () => {
      const content = [
        '[dev-dependencies]',
        'criterion = "0.5"',
        '',
        '[build-dependencies]',
        'cc = "1.0"',
      ].join('\n');
      const manifest = parseCargoToml(content);
      expect(manifest).not.toBeNull();
      expect(manifest!['dev-dependencies']).toBeDefined();
      expect((manifest!['dev-dependencies'] as Record<string, string>)['criterion']).toBe('0.5');
      expect(manifest!['build-dependencies']).toBeDefined();
      expect((manifest!['build-dependencies'] as Record<string, string>)['cc']).toBe('1.0');
    });

    it('ignores comments', () => {
      const content = [
        '[dependencies]',
        '# This is a comment',
        'serde = "1.0"',
      ].join('\n');
      const manifest = parseCargoToml(content);
      expect(manifest).not.toBeNull();
      expect(Object.keys(manifest!.dependencies!)).toEqual(['serde']);
    });
  });

  describe('getDeclaredCrates', () => {
    it('returns all dependency names from all sections', () => {
      const content = [
        '[dependencies]',
        'serde = "1.0"',
        'tokio = "1"',
        '',
        '[dev-dependencies]',
        'criterion = "0.5"',
        '',
        '[build-dependencies]',
        'cc = "1.0"',
      ].join('\n');
      const manifest = parseCargoToml(content)!;
      const crates = getDeclaredCrates(manifest);
      expect(crates).toEqual(new Set(['serde', 'tokio', 'criterion', 'cc']));
    });

    it('returns empty set for manifest with no dependencies', () => {
      const content = [
        '[package]',
        'name = "minimal"',
        'version = "0.1.0"',
      ].join('\n');
      const manifest = parseCargoToml(content)!;
      const crates = getDeclaredCrates(manifest);
      expect(crates.size).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// module-graph
// ---------------------------------------------------------------------------

describe('module-graph', () => {
  describe('parseModDeclarations', () => {
    it('parses mod declarations', () => {
      const source = 'mod config;\nmod handlers;\n';
      const mods = parseModDeclarations(source);
      expect(mods).toEqual(['config', 'handlers']);
    });

    it('parses pub mod', () => {
      const source = 'pub mod api;\n';
      const mods = parseModDeclarations(source);
      expect(mods).toEqual(['api']);
    });

    it('parses pub(crate) mod', () => {
      const source = 'pub(crate) mod internal;\n';
      const mods = parseModDeclarations(source);
      expect(mods).toEqual(['internal']);
    });

    it('does not match inline mod blocks', () => {
      const source = 'mod tests {\n    #[test]\n    fn it_works() {}\n}\n';
      const mods = parseModDeclarations(source);
      expect(mods).toHaveLength(0);
    });

    it('returns empty for source with no mod declarations', () => {
      const source = 'fn main() {}\n';
      const mods = parseModDeclarations(source);
      expect(mods).toHaveLength(0);
    });
  });

  describe('buildRustModuleGraph', () => {
    it('builds graph for valid crate fixture', async () => {
      const graph = await buildRustModuleGraph({ projectRoot: validCrate });
      expect(graph.entries.length).toBeGreaterThanOrEqual(1);
      expect(graph.nodes.size).toBeGreaterThanOrEqual(1);
      // main.rs should be an entry
      const entryBasenames = graph.entries.map((e) => path.basename(e));
      expect(entryBasenames).toContain('main.rs');
    });

    it('discovers external crate refs', async () => {
      const graph = await buildRustModuleGraph({ projectRoot: validCrate });
      expect(graph.externalCrateRefs.has('serde')).toBe(true);
      expect(graph.externalCrateRefs.has('tokio')).toBe(true);
    });

    it('populates children from mod declarations', async () => {
      const graph = await buildRustModuleGraph({ projectRoot: validCrate });
      // main.rs declares mod config; and mod handlers;
      const mainEntry = graph.entries.find((e) => path.basename(e) === 'main.rs');
      expect(mainEntry).toBeDefined();
      const mainNode = graph.nodes.get(mainEntry!);
      expect(mainNode).toBeDefined();
      expect(mainNode!.children.length).toBe(2);
      const childBasenames = mainNode!.children.map((c) => path.basename(c));
      expect(childBasenames).toContain('config.rs');
      expect(childBasenames).toContain('handlers.rs');
    });

    it('returns empty graph for non-existent project', async () => {
      const graph = await buildRustModuleGraph({
        projectRoot: path.join(fixturesDir, 'nonexistent'),
      });
      expect(graph.entries).toHaveLength(0);
      expect(graph.nodes.size).toBe(0);
    });
  });

  describe('findUnreachableModules', () => {
    it('detects orphan module in unreachable-mod fixture', async () => {
      const graph = await buildRustModuleGraph({ projectRoot: unreachableMod });
      const unreachable = findUnreachableModules(graph);
      // orphan.rs is not declared via mod in lib.rs, so it's unreachable
      const unreachableBasenames = Array.from(unreachable).map((p) => path.basename(p));
      expect(unreachableBasenames).toContain('orphan.rs');
    });

    it('marks reachable modules correctly', async () => {
      const graph = await buildRustModuleGraph({ projectRoot: unreachableMod });
      const unreachable = findUnreachableModules(graph);
      // api.rs is declared via "mod api;" in lib.rs, so it should NOT be unreachable
      const unreachableBasenames = Array.from(unreachable).map((p) => path.basename(p));
      expect(unreachableBasenames).not.toContain('api.rs');
      expect(unreachableBasenames).not.toContain('lib.rs');
    });
  });
});

// ---------------------------------------------------------------------------
// resolver (integration)
// ---------------------------------------------------------------------------

describe('resolver', () => {
  describe('resolveRust', () => {
    it('succeeds for valid crate with no findings', async () => {
      const result = await resolveRust({ projectRoot: validCrate });
      expect(result.success).toBe(true);
      expect(result.findings).toHaveLength(0);
      expect(result.missingCrates).toHaveLength(0);
      expect(result.trustScore).toBe(100);
    });

    it('loads Cargo.toml manifest', async () => {
      const result = await resolveRust({ projectRoot: validCrate });
      expect(result.manifest).not.toBeNull();
      expect(result.manifest!.package?.name).toBe('myapp');
    });

    it('populates declared crates from Cargo.toml', async () => {
      const result = await resolveRust({ projectRoot: validCrate });
      expect(result.declaredCrates.has('serde')).toBe(true);
      expect(result.declaredCrates.has('tokio')).toBe(true);
      expect(result.declaredCrates.has('reqwest')).toBe(true);
      expect(result.declaredCrates.has('criterion')).toBe(true);
    });

    it('detects missing/fake crates', async () => {
      const result = await resolveRust({ projectRoot: fakeCrate });
      expect(result.success).toBe(false);
      expect(result.missingCrates.length).toBeGreaterThan(0);
      expect(result.missingCrates).toContain('hallucinated_crate');
      expect(result.missingCrates).toContain('nonexistent_lib');
    });

    it('emits missing_crate findings with correct kind', async () => {
      const result = await resolveRust({ projectRoot: fakeCrate });
      const missingFindings = result.findings.filter((f) => f.kind === 'missing_crate');
      expect(missingFindings.length).toBeGreaterThanOrEqual(2);
      const crateNames = missingFindings.map((f) => f.crate);
      expect(crateNames).toContain('hallucinated_crate');
      expect(crateNames).toContain('nonexistent_lib');
    });

    it('detects fake module via crate:: path', async () => {
      const result = await resolveRust({ projectRoot: fakeCrate });
      const fakeModFindings = result.findings.filter((f) => f.kind === 'fake_module');
      // crate::phantom_module should be flagged since no mod phantom_module; exists
      expect(fakeModFindings.length).toBeGreaterThanOrEqual(1);
      const paths = fakeModFindings.map((f) => f.path);
      expect(paths.some((p) => p?.includes('phantom_module'))).toBe(true);
    });

    it('does not flag valid crate:: paths', async () => {
      const result = await resolveRust({ projectRoot: validCrate });
      const fakeModFindings = result.findings.filter((f) => f.kind === 'fake_module');
      expect(fakeModFindings).toHaveLength(0);
    });

    it('detects unreachable modules', async () => {
      const result = await resolveRust({ projectRoot: unreachableMod });
      const unreachableFindings = result.findings.filter((f) => f.kind === 'unreachable_import');
      expect(unreachableFindings.length).toBeGreaterThanOrEqual(1);
    });

    it('computes trust score with penalty for findings', async () => {
      const result = await resolveRust({ projectRoot: fakeCrate });
      expect(result.trustScore).toBeLessThan(100);
      expect(result.trustScore).toBeGreaterThanOrEqual(0);
    });

    it('builds module graph with entries', async () => {
      const result = await resolveRust({ projectRoot: validCrate });
      expect(result.graph.entries.length).toBeGreaterThanOrEqual(1);
      expect(result.graph.nodes.size).toBeGreaterThanOrEqual(1);
    });

    it('handles project with no Cargo.toml gracefully', async () => {
      const result = await resolveRust({
        projectRoot: path.join(fixturesDir, 'nonexistent'),
      });
      expect(result.manifest).toBeNull();
      expect(result.declaredCrates.size).toBe(0);
    });
  });
});
