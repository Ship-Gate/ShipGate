/**
 * Main Code Generator
 * 
 * Orchestrates generation of TypeScript/Python types and validators from ISL.
 */

import type { DomainDeclaration } from '@isl-lang/isl-core';

import { TypeScriptGenerator } from './typescript.js';
import { PythonGenerator } from './python.js';
import { ZodGenerator } from './validation.js';
import { SerdesGenerator } from './serdes.js';

// ============================================================================
// Types
// ============================================================================

export type Language = 'typescript' | 'python';
export type ValidationFramework = 'zod' | 'pydantic' | 'none';

export interface GeneratorOptions {
  /** Target language for code generation */
  language: Language;
  /** Whether to generate validation schemas */
  validation: boolean;
  /** Include serialization/deserialization helpers */
  serdes?: boolean;
  /** Include JSDoc/docstring comments */
  comments?: boolean;
  /** Output directory prefix (for imports) */
  outputPrefix?: string;
  /** Domain name override */
  domainName?: string;
}

export interface GeneratedFile {
  /** File path relative to output directory */
  path: string;
  /** Generated file contents */
  content: string;
  /** File type for categorization */
  type: 'types' | 'validation' | 'serdes' | 'index';
}

export interface GeneratedOutput {
  /** All generated files */
  files: GeneratedFile[];
  /** Domain name */
  domain: string;
  /** Target language */
  language: Language;
  /** Generation timestamp */
  generatedAt: Date;
}

// ============================================================================
// Main Generator Class
// ============================================================================

export class CodeGenerator {
  private options: Required<GeneratorOptions>;
  private tsGenerator: TypeScriptGenerator;
  private pyGenerator: PythonGenerator;
  private zodGenerator: ZodGenerator;
  private serdesGenerator: SerdesGenerator;

  constructor(options: GeneratorOptions) {
    this.options = {
      language: options.language,
      validation: options.validation,
      serdes: options.serdes ?? true,
      comments: options.comments ?? true,
      outputPrefix: options.outputPrefix ?? './',
      domainName: options.domainName ?? '',
    };

    this.tsGenerator = new TypeScriptGenerator(this.options);
    this.pyGenerator = new PythonGenerator(this.options);
    this.zodGenerator = new ZodGenerator(this.options);
    this.serdesGenerator = new SerdesGenerator(this.options);
  }

  /**
   * Generate code from an ISL domain
   */
  generate(domain: DomainDeclaration): GeneratedOutput {
    const domainName = this.options.domainName || domain.name.name;
    const files: GeneratedFile[] = [];

    if (this.options.language === 'typescript') {
      files.push(...this.generateTypeScript(domain, domainName));
    } else {
      files.push(...this.generatePython(domain, domainName));
    }

    return {
      files,
      domain: domainName,
      language: this.options.language,
      generatedAt: new Date(),
    };
  }

  private generateTypeScript(domain: DomainDeclaration, domainName: string): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const lowerName = domainName.toLowerCase();

    // Generate types
    const typesContent = this.tsGenerator.generate(domain);
    files.push({
      path: `${lowerName}/types.ts`,
      content: typesContent,
      type: 'types',
    });

    // Generate validation
    if (this.options.validation) {
      const validationContent = this.zodGenerator.generate(domain);
      files.push({
        path: `${lowerName}/validation.ts`,
        content: validationContent,
        type: 'validation',
      });
    }

    // Generate serdes
    if (this.options.serdes) {
      const serdesContent = this.serdesGenerator.generateTypeScript(domain);
      files.push({
        path: `${lowerName}/serdes.ts`,
        content: serdesContent,
        type: 'serdes',
      });
    }

    // Generate index
    const indexContent = this.generateTypeScriptIndex(domainName);
    files.push({
      path: `${lowerName}/index.ts`,
      content: indexContent,
      type: 'index',
    });

    return files;
  }

  private generatePython(domain: DomainDeclaration, domainName: string): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const snakeName = this.toSnakeCase(domainName);

    // Generate types
    const typesContent = this.pyGenerator.generate(domain);
    files.push({
      path: `${snakeName}/types.py`,
      content: typesContent,
      type: 'types',
    });

    // Generate validation (Pydantic models)
    if (this.options.validation) {
      const validationContent = this.pyGenerator.generatePydantic(domain);
      files.push({
        path: `${snakeName}/validation.py`,
        content: validationContent,
        type: 'validation',
      });
    }

    // Generate serdes
    if (this.options.serdes) {
      const serdesContent = this.serdesGenerator.generatePython(domain);
      files.push({
        path: `${snakeName}/serdes.py`,
        content: serdesContent,
        type: 'serdes',
      });
    }

    // Generate __init__.py
    const initContent = this.generatePythonInit(domainName);
    files.push({
      path: `${snakeName}/__init__.py`,
      content: initContent,
      type: 'index',
    });

    return files;
  }

  private generateTypeScriptIndex(domainName: string): string {
    const lines: string[] = [
      '/**',
      ` * Generated index for ${domainName} domain`,
      ' * DO NOT EDIT - This file is auto-generated',
      ' */',
      '',
      "export * from './types.js';",
    ];

    if (this.options.validation) {
      lines.push("export * from './validation.js';");
    }

    if (this.options.serdes) {
      lines.push("export * from './serdes.js';");
    }

    return lines.join('\n');
  }

  private generatePythonInit(domainName: string): string {
    const lines: string[] = [
      '"""',
      `Generated types for ${domainName} domain`,
      'DO NOT EDIT - This file is auto-generated',
      '"""',
      '',
      'from .types import *',
    ];

    if (this.options.validation) {
      lines.push('from .validation import *');
    }

    if (this.options.serdes) {
      lines.push('from .serdes import *');
    }

    return lines.join('\n');
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }
}

// ============================================================================
// Convenience Function
// ============================================================================

/**
 * Generate TypeScript/Python types and validators from an ISL domain
 * 
 * @param domain - Parsed ISL domain
 * @param options - Generation options
 * @returns Generated files
 * 
 * @example
 * ```typescript
 * const output = generate(domain, { language: 'typescript', validation: true });
 * for (const file of output.files) {
 *   await fs.writeFile(file.path, file.content);
 * }
 * ```
 */
export function generate(
  domain: DomainDeclaration,
  options: GeneratorOptions
): GeneratedOutput {
  const generator = new CodeGenerator(options);
  return generator.generate(domain);
}
