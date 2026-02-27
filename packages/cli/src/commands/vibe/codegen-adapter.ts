/**
 * Codegen Adapter — Unified interface for multi-language code generation from ISL specs.
 *
 * Routes ISL domain AST to the appropriate codegen package:
 *   --lang python  → @isl-lang/codegen-python
 *   --lang rust    → @isl-lang/codegen-rust
 *   --lang go      → @isl-lang/codegen-go
 *   --lang typescript (default) → AI-powered full-stack codegen (existing pipeline)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SupportedLanguage = 'typescript' | 'python' | 'rust' | 'go';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['typescript', 'python', 'rust', 'go'];

export interface CodegenAdapterOptions {
  outputDir: string;
  moduleName?: string;
  generateTests?: boolean;
  framework?: string;
  database?: string;
}

export interface AdapterGeneratedFile {
  path: string;
  content: string;
  type: 'spec' | 'backend' | 'frontend' | 'database' | 'test' | 'config' | 'docs';
}

export interface QualityResult {
  pass: boolean;
  errors: string[];
  warnings: string[];
}

export interface ICodegenAdapter {
  language: SupportedLanguage;
  generate(domain: unknown, islContent: string, options: CodegenAdapterOptions): Promise<AdapterGeneratedFile[]>;
  qualityGate(files: AdapterGeneratedFile[]): Promise<QualityResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser domain → codegen-python normalization
// ─────────────────────────────────────────────────────────────────────────────

interface FlatIslDomain {
  name: string;
  version: string;
  entities: Array<{
    name: string;
    fields: Array<{ name: string; type: string; optional: boolean; modifiers: string[]; default?: string }>;
    invariants: string[];
  }>;
  behaviors: Array<{
    name: string;
    description?: string;
    input: Array<{ name: string; type: string; optional: boolean; modifiers: string[] }>;
    output: { success: string; errors: Array<{ code: string; message?: string }> };
    preconditions: string[];
    postconditions: string[];
  }>;
  enums: Array<{ name: string; values: string[] }>;
  types: Array<{ name: string; baseType: string; constraints?: Record<string, unknown> }>;
}

function resolveTypeName(typeNode: unknown): string {
  if (!typeNode || typeof typeNode !== 'object') return 'String';
  const t = typeNode as Record<string, unknown>;
  if (t.name && typeof t.name === 'object') return (t.name as { name: string }).name ?? 'String';
  if (t.name && typeof t.name === 'string') return t.name;
  if (t.kind === 'PrimitiveType' && typeof t.name === 'string') return t.name;
  if (t.kind === 'ListType' && t.element) return `List<${resolveTypeName(t.element)}>`;
  if (t.kind === 'OptionalType' && t.inner) return `${resolveTypeName(t.inner)}?`;
  if (t.kind === 'ReferenceType' && t.name) {
    const ref = t.name as { parts?: Array<{ name: string }> };
    if (ref.parts?.length) return ref.parts.map(p => p.name).join('.');
  }
  if (typeof t.kind === 'string') return t.kind;
  return 'String';
}

function resolveName(node: unknown): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'object' && node !== null) {
    const n = node as Record<string, unknown>;
    if (typeof n.name === 'string') return n.name;
    if (typeof n.name === 'object' && n.name !== null) return (n.name as { name: string }).name ?? '';
  }
  return String(node);
}

/**
 * Normalize the parser's domain AST to the flat structure expected by codegen-python.
 */
function normalizeToPythonDomain(parserDomain: unknown): FlatIslDomain {
  const d = parserDomain as Record<string, unknown>;
  const domainName = resolveName(d.name) || 'App';

  const entities = ((d.entities as unknown[]) ?? []).map((e: unknown) => {
    const ent = e as Record<string, unknown>;
    return {
      name: resolveName(ent.name),
      fields: ((ent.fields as unknown[]) ?? []).map((f: unknown) => {
        const field = f as Record<string, unknown>;
        return {
          name: resolveName(field.name),
          type: resolveTypeName(field.type),
          optional: !!field.optional,
          modifiers: (field.modifiers as string[]) ?? [],
          default: field.defaultValue ? String(field.defaultValue) : undefined,
        };
      }),
      invariants: ((ent.invariants as unknown[]) ?? []).map(String),
    };
  });

  const behaviors = ((d.behaviors as unknown[]) ?? []).map((b: unknown) => {
    const beh = b as Record<string, unknown>;
    const input = beh.input as Record<string, unknown> | undefined;
    const output = beh.output as Record<string, unknown> | undefined;
    return {
      name: resolveName(beh.name),
      description: beh.description ? resolveName(beh.description) : undefined,
      input: ((input?.fields as unknown[]) ?? []).map((f: unknown) => {
        const field = f as Record<string, unknown>;
        return {
          name: resolveName(field.name),
          type: resolveTypeName(field.type),
          optional: !!field.optional,
          modifiers: (field.modifiers as string[]) ?? [],
        };
      }),
      output: {
        success: output?.success ? resolveTypeName(output.success) : 'Void',
        errors: ((output?.errors as unknown[]) ?? []).map((err: unknown) => {
          const e = err as Record<string, unknown>;
          return { code: resolveName(e.name), message: e.when ? resolveName(e.when) : undefined };
        }),
      },
      preconditions: ((beh.preconditions as unknown[]) ?? []).map(String),
      postconditions: ((beh.postconditions as unknown[]) ?? []).map(String),
    };
  });

  return {
    name: domainName,
    version: resolveName(d.version) || '1.0',
    entities,
    behaviors,
    enums: [],
    types: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Python Adapter
// ─────────────────────────────────────────────────────────────────────────────

export class PythonCodegenAdapter implements ICodegenAdapter {
  language: SupportedLanguage = 'python';

  async generate(domain: unknown, islContent: string, options: CodegenAdapterOptions): Promise<AdapterGeneratedFile[]> {
    const { generateFiles } = await import('@isl-lang/codegen-python');
    const normalized = normalizeToPythonDomain(domain);
    const moduleName = options.moduleName ?? normalized.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const fileMap = generateFiles(normalized, {
      style: 'pydantic',
      generateTests: options.generateTests !== false,
      generateStubs: true,
      docstrings: true,
      moduleName,
    });

    const files: AdapterGeneratedFile[] = [];
    for (const [path, content] of fileMap) {
      const type: AdapterGeneratedFile['type'] = path.includes('test') ? 'test'
        : path === 'requirements.txt' ? 'config'
        : 'backend';
      files.push({ path, content, type });
    }

    files.push({
      path: `specs/${moduleName}.isl`,
      content: islContent,
      type: 'spec',
    });

    return files;
  }

  async qualityGate(files: AdapterGeneratedFile[]): Promise<QualityResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const file of files) {
      if (file.type !== 'backend' && file.type !== 'test') continue;
      if (!file.path.endsWith('.py')) continue;
      if (file.content.trim().length === 0) {
        errors.push(`${file.path}: empty file`);
      }
      if (file.content.includes('syntax error') || file.content.includes('SyntaxError')) {
        errors.push(`${file.path}: contains syntax error markers`);
      }
    }

    return { pass: errors.length === 0, errors, warnings };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rust Adapter
// ─────────────────────────────────────────────────────────────────────────────

export class RustCodegenAdapter implements ICodegenAdapter {
  language: SupportedLanguage = 'rust';

  async generate(domain: unknown, islContent: string, options: CodegenAdapterOptions): Promise<AdapterGeneratedFile[]> {
    const { generate: genRust } = await import('@isl-lang/codegen-rust');
    const d = domain as Record<string, unknown>;
    const crateName = (options.moduleName ?? resolveName(d.name) ?? 'app')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_');

    let generatedFiles: Array<{ path: string; content: string }>;
    try {
      generatedFiles = genRust(domain as Parameters<typeof genRust>[0], {
        outputDir: options.outputDir,
        crateName,
      });
    } catch (err) {
      throw new Error(`Rust codegen failed — the ISL domain AST may be incompatible: ${err instanceof Error ? err.message : String(err)}`);
    }

    const files: AdapterGeneratedFile[] = generatedFiles.map(f => ({
      path: f.path,
      content: f.content,
      type: 'backend' as const,
    }));

    files.push({
      path: `specs/${crateName}.isl`,
      content: islContent,
      type: 'spec',
    });

    return files;
  }

  async qualityGate(files: AdapterGeneratedFile[]): Promise<QualityResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const file of files) {
      if (!file.path.endsWith('.rs') && !file.path.endsWith('.toml')) continue;
      if (file.content.trim().length === 0) {
        errors.push(`${file.path}: empty file`);
      }
    }

    return { pass: errors.length === 0, errors, warnings };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Go Adapter
// ─────────────────────────────────────────────────────────────────────────────

export class GoCodegenAdapter implements ICodegenAdapter {
  language: SupportedLanguage = 'go';

  async generate(domain: unknown, islContent: string, options: CodegenAdapterOptions): Promise<AdapterGeneratedFile[]> {
    const { generate: genGo } = await import('@isl-lang/codegen-go');
    const d = domain as Record<string, unknown>;
    const moduleName = (options.moduleName ?? resolveName(d.name) ?? 'app')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_');

    let generatedFiles: Array<{ path: string; content: string; type?: string }>;
    try {
      generatedFiles = genGo(domain as Parameters<typeof genGo>[0], {
        outputDir: options.outputDir,
        module: `github.com/user/${moduleName}`,
        packageName: moduleName,
        includeValidation: true,
        includeHandlers: true,
        includeTests: options.generateTests !== false,
        includeScaffold: true,
      });
    } catch (err) {
      throw new Error(`Go codegen failed — the ISL domain AST may be incompatible: ${err instanceof Error ? err.message : String(err)}`);
    }

    const files: AdapterGeneratedFile[] = generatedFiles.map(f => ({
      path: f.path,
      content: f.content,
      type: (f.type === 'tests' ? 'test' : f.type === 'scaffold' ? 'config' : 'backend') as AdapterGeneratedFile['type'],
    }));

    files.push({
      path: `specs/${moduleName}.isl`,
      content: islContent,
      type: 'spec',
    });

    return files;
  }

  async qualityGate(files: AdapterGeneratedFile[]): Promise<QualityResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const file of files) {
      if (!file.path.endsWith('.go') && !file.path.endsWith('.mod')) continue;
      if (file.content.trim().length === 0) {
        errors.push(`${file.path}: empty file`);
      }
    }

    return { pass: errors.length === 0, errors, warnings };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

const ADAPTERS: Record<string, () => ICodegenAdapter> = {
  python: () => new PythonCodegenAdapter(),
  rust: () => new RustCodegenAdapter(),
  go: () => new GoCodegenAdapter(),
};

/**
 * Get a codegen adapter for the specified language.
 * Returns null for 'typescript' (uses the existing AI-powered pipeline).
 */
export function getCodegenAdapter(lang: SupportedLanguage): ICodegenAdapter | null {
  if (lang === 'typescript') return null;
  const factory = ADAPTERS[lang];
  if (!factory) return null;
  return factory();
}

export function isValidLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
}
