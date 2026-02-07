/**
 * go.mod parser — parses module path, require, and replace directives
 * for Go module resolution (no regex for structure; line-based parsing).
 *
 * @module @isl-lang/firewall/go
 */

import * as path from 'path';
import * as fs from 'fs/promises';

export interface GoModFile {
  /** Module path from "module" directive */
  modulePath: string;
  /** Go version from "go" directive if present */
  goVersion?: string;
  /** Required modules: path -> version */
  require: Map<string, string>;
  /** Replace directives: from path -> to path or version */
  replace: Map<string, string>;
  /** Directory containing this go.mod */
  dir: string;
}

export interface GoModParseError {
  ok: false;
  message: string;
  line?: number;
}

/**
 * Tokenize a single line: strip // comment, then split on whitespace.
 */
function tokenizeLine(line: string): string[] {
  const comment = line.indexOf('//');
  const content = comment >= 0 ? line.slice(0, comment).trim() : line.trim();
  if (!content) return [];
  return content.split(/\s+/);
}

/**
 * Parse go.mod content. Returns parsed module info or error.
 */
export function parseGoModContent(content: string, dir: string): GoModFile | GoModParseError {
  const lines = content.split(/\n/);
  let modulePath = '';
  let goVersion: string | undefined;
  const require = new Map<string, string>();
  const replace = new Map<string, string>();

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const tokens = tokenizeLine(line);
    i++;

    if (tokens.length === 0) continue;

    const directive = tokens[0];
    if (directive === 'module') {
      if (tokens.length < 2) {
        return { ok: false, message: 'module directive requires path', line: i };
      }
      modulePath = tokens[1];
      continue;
    }

    if (directive === 'go') {
      if (tokens.length >= 2) goVersion = tokens[1];
      continue;
    }

    if (directive === 'require') {
      if (tokens.length >= 3) {
        require.set(tokens[1], tokens[2]);
      } else if (tokens.length === 1 && i < lines.length) {
        // require ( ... ) block
        const next = lines[i].trim();
        if (next === '(') {
          i++;
          while (i < lines.length) {
            const blockLine = lines[i];
            const blockTokens = tokenizeLine(blockLine);
            i++;
            if (blockTokens.length >= 1 && blockTokens[0] === ')') break;
            if (blockTokens.length >= 2) {
              require.set(blockTokens[0], blockTokens[1]);
            }
          }
        }
      }
      continue;
    }

    if (directive === 'replace') {
      // replace path => path  or  replace path => version  or  replace path => ./local
      if (tokens.length >= 4 && tokens[2] === '=>') {
        replace.set(tokens[1], tokens[3]);
      } else if (tokens.length === 1 && i < lines.length) {
        const next = lines[i].trim();
        if (next === '(') {
          i++;
          while (i < lines.length) {
            const blockLine = lines[i];
            const blockTokens = tokenizeLine(blockLine);
            i++;
            if (blockTokens.length >= 1 && blockTokens[0] === ')') break;
            if (blockTokens.length >= 4 && blockTokens[2] === '=>') {
              replace.set(blockTokens[0], blockTokens[3]);
            }
          }
        }
      }
      continue;
    }

    // exclude, retract: skip
  }

  if (!modulePath) {
    return { ok: false, message: 'go.mod has no module directive' };
  }

  return {
    modulePath,
    goVersion,
    require,
    replace,
    dir,
  };
}

/**
 * Find go.mod path by walking up from directory.
 */
export async function findGoModPath(fromDir: string): Promise<string | null> {
  let current = path.resolve(fromDir);
  const root = path.parse(current).root;

  while (current !== root) {
    const goModPath = path.join(current, 'go.mod');
    try {
      await fs.access(goModPath);
      return goModPath;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return null;
}

/**
 * Load and parse go.mod from a directory (walks up to find go.mod).
 */
export async function loadGoMod(fromDir: string): Promise<GoModFile | GoModParseError | null> {
  const goModPath = await findGoModPath(fromDir);
  if (!goModPath) return null;
  try {
    const content = await fs.readFile(goModPath, 'utf-8');
    const dir = path.dirname(goModPath);
    return parseGoModContent(content, dir);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Failed to read go.mod: ${message}` };
  }
}
