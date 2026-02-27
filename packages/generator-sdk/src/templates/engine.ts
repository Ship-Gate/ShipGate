/**
 * Template Engine
 *
 * Handlebars-based template engine for code generation.
 */

import Handlebars from 'handlebars';
import { readFile, readdir, stat } from 'fs/promises';
import { join, basename, extname } from 'path';

// ============================================================================
// Template Engine Class
// ============================================================================

/**
 * Template engine for rendering code templates.
 *
 * Uses Handlebars under the hood with additional helpers for code generation.
 *
 * @example
 * ```typescript
 * const engine = new TemplateEngine();
 *
 * // Register a template
 * engine.registerTemplate('entity', `
 *   interface {{entity.name.name}} {
 *     {{#each entity.fields}}
 *     {{name.name}}: {{typeToTS type}};
 *     {{/each}}
 *   }
 * `);
 *
 * // Render
 * const output = engine.render('entity', { entity: myEntity });
 * ```
 */
export class TemplateEngine {
  private templates: Map<string, Handlebars.TemplateDelegate> = new Map();
  private handlebars: typeof Handlebars;

  constructor() {
    // Create isolated Handlebars instance
    this.handlebars = Handlebars.create();
    this.registerBuiltinHelpers();
  }

  // ==========================================================================
  // Template Registration
  // ==========================================================================

  /**
   * Register a template from a string.
   *
   * @param name - Template name (used to reference when rendering)
   * @param source - Handlebars template source
   */
  registerTemplate(name: string, source: string): void {
    const compiled = this.handlebars.compile(source, {
      noEscape: true, // Don't escape HTML entities in code
      strict: false,
    });
    this.templates.set(name, compiled);
  }

  /**
   * Register a partial template.
   *
   * @param name - Partial name
   * @param source - Handlebars template source
   */
  registerPartial(name: string, source: string): void {
    this.handlebars.registerPartial(name, source);
  }

  /**
   * Register a helper function.
   *
   * @param name - Helper name
   * @param fn - Helper function
   */
  registerHelper(name: string, fn: Handlebars.HelperDelegate): void {
    this.handlebars.registerHelper(name, fn);
  }

  /**
   * Load templates from a directory.
   *
   * Files should have `.hbs` or `.handlebars` extension.
   *
   * @param dir - Directory path
   * @param recursive - Load from subdirectories
   */
  async loadFromDirectory(dir: string, recursive: boolean = true): Promise<void> {
    await this.loadTemplatesRecursive(dir, '', recursive);
  }

  private async loadTemplatesRecursive(
    dir: string,
    prefix: string,
    recursive: boolean
  ): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return; // Directory doesn't exist
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stats = await stat(fullPath);

      if (stats.isDirectory() && recursive) {
        const newPrefix = prefix ? `${prefix}/${entry}` : entry;
        await this.loadTemplatesRecursive(fullPath, newPrefix, recursive);
      } else if (stats.isFile()) {
        const ext = extname(entry);
        if (ext === '.hbs' || ext === '.handlebars') {
          const templateName = basename(entry, ext);
          const fullName = prefix ? `${prefix}/${templateName}` : templateName;
          const source = await readFile(fullPath, 'utf-8');
          this.registerTemplate(fullName, source);
        }
      }
    }
  }

  // ==========================================================================
  // Rendering
  // ==========================================================================

  /**
   * Render a registered template.
   *
   * @param name - Template name
   * @param data - Data to pass to template
   * @returns Rendered string
   */
  render(name: string, data: Record<string, unknown> = {}): string {
    const template = this.templates.get(name);
    if (!template) {
      throw new Error(
        `Template "${name}" not found. Available: ${Array.from(this.templates.keys()).join(', ')}`
      );
    }
    return template(data);
  }

  /**
   * Render an inline template string.
   *
   * @param source - Template source
   * @param data - Data to pass to template
   * @returns Rendered string
   */
  renderInline(source: string, data: Record<string, unknown> = {}): string {
    const template = this.handlebars.compile(source, { noEscape: true });
    return template(data);
  }

  /**
   * Check if a template is registered.
   */
  hasTemplate(name: string): boolean {
    return this.templates.has(name);
  }

  /**
   * Get all registered template names.
   */
  getTemplateNames(): string[] {
    return Array.from(this.templates.keys());
  }

  // ==========================================================================
  // Built-in Helpers
  // ==========================================================================

  private registerBuiltinHelpers(): void {
    // Conditionals
    this.handlebars.registerHelper('eq', (a, b) => a === b);
    this.handlebars.registerHelper('neq', (a, b) => a !== b);
    this.handlebars.registerHelper('gt', (a, b) => a > b);
    this.handlebars.registerHelper('gte', (a, b) => a >= b);
    this.handlebars.registerHelper('lt', (a, b) => a < b);
    this.handlebars.registerHelper('lte', (a, b) => a <= b);
    this.handlebars.registerHelper('and', (...args) => {
      args.pop(); // Remove options
      return args.every(Boolean);
    });
    this.handlebars.registerHelper('or', (...args) => {
      args.pop(); // Remove options
      return args.some(Boolean);
    });
    this.handlebars.registerHelper('not', (a) => !a);

    // String manipulation
    this.handlebars.registerHelper('lowercase', (str) =>
      typeof str === 'string' ? str.toLowerCase() : ''
    );
    this.handlebars.registerHelper('uppercase', (str) =>
      typeof str === 'string' ? str.toUpperCase() : ''
    );
    this.handlebars.registerHelper('capitalize', (str) =>
      typeof str === 'string' ? str.charAt(0).toUpperCase() + str.slice(1) : ''
    );
    this.handlebars.registerHelper('camelCase', (str) =>
      typeof str === 'string' ? str.charAt(0).toLowerCase() + str.slice(1) : ''
    );
    this.handlebars.registerHelper('kebabCase', (str) =>
      typeof str === 'string'
        ? str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
        : ''
    );
    this.handlebars.registerHelper('snakeCase', (str) =>
      typeof str === 'string'
        ? str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
        : ''
    );
    this.handlebars.registerHelper('pascalCase', (str) =>
      typeof str === 'string' ? str.charAt(0).toUpperCase() + str.slice(1) : ''
    );

    // Array helpers
    this.handlebars.registerHelper('first', (arr) =>
      Array.isArray(arr) ? arr[0] : undefined
    );
    this.handlebars.registerHelper('last', (arr) =>
      Array.isArray(arr) ? arr[arr.length - 1] : undefined
    );
    this.handlebars.registerHelper('length', (arr) =>
      Array.isArray(arr) ? arr.length : 0
    );
    this.handlebars.registerHelper('isEmpty', (arr) =>
      !arr || (Array.isArray(arr) && arr.length === 0)
    );
    this.handlebars.registerHelper('join', (arr, separator) =>
      Array.isArray(arr) ? arr.join(typeof separator === 'string' ? separator : ', ') : ''
    );
    this.handlebars.registerHelper('includes', (arr, item) =>
      Array.isArray(arr) && arr.includes(item)
    );

    // Object helpers
    this.handlebars.registerHelper('json', (obj, indent) =>
      JSON.stringify(obj, null, typeof indent === 'number' ? indent : 2)
    );
    this.handlebars.registerHelper('keys', (obj) =>
      obj && typeof obj === 'object' ? Object.keys(obj) : []
    );
    this.handlebars.registerHelper('values', (obj) =>
      obj && typeof obj === 'object' ? Object.values(obj) : []
    );
    this.handlebars.registerHelper('get', (obj, key) =>
      obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined
    );

    // Code generation helpers
    this.handlebars.registerHelper('indent', function (this: unknown, count: number, options: Handlebars.HelperOptions) {
      const content = options.fn(this);
      const spaces = '  '.repeat(count);
      return content
        .split('\n')
        .map((line: string) => (line.trim() ? spaces + line : line))
        .join('\n');
    });

    this.handlebars.registerHelper('comment', (text, style) => {
      if (style === 'block') {
        return `/**\n * ${text}\n */`;
      }
      return `// ${text}`;
    });

    this.handlebars.registerHelper('timestamp', () => new Date().toISOString());

    // Iteration helpers
    this.handlebars.registerHelper('times', function (this: unknown, n: number, options: Handlebars.HelperOptions) {
      let result = '';
      for (let i = 0; i < n; i++) {
        result += options.fn({ index: i, first: i === 0, last: i === n - 1 });
      }
      return result;
    });

    this.handlebars.registerHelper(
      'eachWithIndex',
      function (this: unknown, arr: unknown[], options: Handlebars.HelperOptions) {
        if (!Array.isArray(arr)) return '';
        let result = '';
        arr.forEach((item, index) => {
          result += options.fn({
            item,
            index,
            first: index === 0,
            last: index === arr.length - 1,
          });
        });
        return result;
      }
    );

    // Type helpers (ISL specific)
    this.handlebars.registerHelper('typeToTS', (type) => this.typeToTypeScript(type));
    this.handlebars.registerHelper('typeToPython', (type) => this.typeToPython(type));
    this.handlebars.registerHelper('typeToGo', (type) => this.typeToGo(type));
    this.handlebars.registerHelper('typeToRust', (type) => this.typeToRust(type));
  }

  // ==========================================================================
  // Type Conversion Helpers
  // ==========================================================================

  private typeToTypeScript(type: unknown): string {
    if (!type) return 'unknown';

    const t = type as {
      kind: string;
      name?: { name: string };
      typeArguments?: unknown[];
      elementType?: unknown;
      variants?: Array<{ name: { name: string } }>;
    };

    const typeMap: Record<string, string> = {
      String: 'string',
      Int: 'number',
      Float: 'number',
      Decimal: 'string',
      Boolean: 'boolean',
      UUID: 'string',
      Email: 'string',
      URL: 'string',
      Phone: 'string',
      Timestamp: 'string',
      Date: 'string',
      Duration: 'number',
      Money: '{ amount: string; currency: string }',
      JSON: 'Record<string, unknown>',
      void: 'void',
    };

    switch (t.kind) {
      case 'SimpleType':
        return typeMap[t.name?.name ?? ''] ?? t.name?.name ?? 'unknown';

      case 'GenericType': {
        const name = t.name?.name ?? '';
        const args = t.typeArguments?.map((a) => this.typeToTypeScript(a)).join(', ') ?? '';

        if (name === 'List') return `${args}[]`;
        if (name === 'Set') return `Set<${args}>`;
        if (name === 'Map') return `Map<${args}>`;
        if (name === 'Optional') return `${args} | null`;

        return `${name}<${args}>`;
      }

      case 'ArrayType':
        return `${this.typeToTypeScript(t.elementType)}[]`;

      case 'UnionType':
        return t.variants?.map((v) => `'${v.name.name}'`).join(' | ') ?? 'unknown';

      default:
        return 'unknown';
    }
  }

  private typeToPython(type: unknown): string {
    if (!type) return 'Any';

    const t = type as {
      kind: string;
      name?: { name: string };
      typeArguments?: unknown[];
      elementType?: unknown;
      variants?: Array<{ name: { name: string } }>;
    };

    const typeMap: Record<string, string> = {
      String: 'str',
      Int: 'int',
      Float: 'float',
      Decimal: 'Decimal',
      Boolean: 'bool',
      UUID: 'UUID',
      Email: 'str',
      URL: 'str',
      Phone: 'str',
      Timestamp: 'datetime',
      Date: 'date',
      Duration: 'timedelta',
      Money: 'Money',
      JSON: 'dict[str, Any]',
      void: 'None',
    };

    switch (t.kind) {
      case 'SimpleType':
        return typeMap[t.name?.name ?? ''] ?? t.name?.name ?? 'Any';

      case 'GenericType': {
        const name = t.name?.name ?? '';
        const args = t.typeArguments?.map((a) => this.typeToPython(a)).join(', ') ?? '';

        if (name === 'List') return `list[${args}]`;
        if (name === 'Set') return `set[${args}]`;
        if (name === 'Map') return `dict[${args}]`;
        if (name === 'Optional') return `${args} | None`;

        return `${name}[${args}]`;
      }

      case 'ArrayType':
        return `list[${this.typeToPython(t.elementType)}]`;

      case 'UnionType':
        return t.variants?.map((v) => `Literal['${v.name.name}']`).join(' | ') ?? 'Any';

      default:
        return 'Any';
    }
  }

  private typeToGo(type: unknown): string {
    if (!type) return 'interface{}';

    const t = type as {
      kind: string;
      name?: { name: string };
      typeArguments?: unknown[];
      elementType?: unknown;
    };

    const typeMap: Record<string, string> = {
      String: 'string',
      Int: 'int64',
      Float: 'float64',
      Decimal: 'decimal.Decimal',
      Boolean: 'bool',
      UUID: 'uuid.UUID',
      Email: 'string',
      URL: 'string',
      Phone: 'string',
      Timestamp: 'time.Time',
      Date: 'time.Time',
      Duration: 'time.Duration',
      Money: 'Money',
      JSON: 'map[string]interface{}',
      void: '',
    };

    switch (t.kind) {
      case 'SimpleType':
        return typeMap[t.name?.name ?? ''] ?? t.name?.name ?? 'interface{}';

      case 'GenericType': {
        const name = t.name?.name ?? '';
        const args = t.typeArguments?.map((a) => this.typeToGo(a)) ?? [];

        if (name === 'List') return `[]${args[0] ?? 'interface{}'}`;
        if (name === 'Set') return `map[${args[0] ?? 'interface{}'}]struct{}`;
        if (name === 'Map') return `map[${args[0] ?? 'string'}]${args[1] ?? 'interface{}'}`;
        if (name === 'Optional') return `*${args[0] ?? 'interface{}'}`;

        return t.name?.name ?? 'interface{}';
      }

      case 'ArrayType':
        return `[]${this.typeToGo(t.elementType)}`;

      default:
        return 'interface{}';
    }
  }

  private typeToRust(type: unknown): string {
    if (!type) return '()';

    const t = type as {
      kind: string;
      name?: { name: string };
      typeArguments?: unknown[];
      elementType?: unknown;
    };

    const typeMap: Record<string, string> = {
      String: 'String',
      Int: 'i64',
      Float: 'f64',
      Decimal: 'rust_decimal::Decimal',
      Boolean: 'bool',
      UUID: 'uuid::Uuid',
      Email: 'String',
      URL: 'String',
      Phone: 'String',
      Timestamp: 'chrono::DateTime<chrono::Utc>',
      Date: 'chrono::NaiveDate',
      Duration: 'std::time::Duration',
      Money: 'Money',
      JSON: 'serde_json::Value',
      void: '()',
    };

    switch (t.kind) {
      case 'SimpleType':
        return typeMap[t.name?.name ?? ''] ?? t.name?.name ?? '()';

      case 'GenericType': {
        const name = t.name?.name ?? '';
        const args = t.typeArguments?.map((a) => this.typeToRust(a)) ?? [];

        if (name === 'List') return `Vec<${args[0] ?? '()'}>`;
        if (name === 'Set') return `HashSet<${args[0] ?? '()'}>`;
        if (name === 'Map') return `HashMap<${args[0] ?? 'String'}, ${args[1] ?? '()'}>`;
        if (name === 'Optional') return `Option<${args[0] ?? '()'}>`;

        return t.name?.name ?? '()';
      }

      case 'ArrayType':
        return `Vec<${this.typeToRust(t.elementType)}>`;

      default:
        return '()';
    }
  }
}
