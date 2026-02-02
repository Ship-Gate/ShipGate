/**
 * DataLoader Generator
 *
 * Generate efficient DataLoader configurations from ISL specifications.
 */

export interface DataLoaderOptions {
  /** Include caching */
  caching?: boolean;
  /** Batch scheduling function */
  batchScheduleFn?: 'immediate' | 'nextTick' | 'setTimeout';
  /** Maximum batch size */
  maxBatchSize?: number;
  /** Include request-scoped caching */
  requestScoped?: boolean;
}

export class DataLoaderGenerator {
  private options: Required<DataLoaderOptions>;

  constructor(options: DataLoaderOptions = {}) {
    this.options = {
      caching: options.caching ?? true,
      batchScheduleFn: options.batchScheduleFn ?? 'nextTick',
      maxBatchSize: options.maxBatchSize ?? 100,
      requestScoped: options.requestScoped ?? true,
    };
  }

  /**
   * Generate DataLoader infrastructure
   */
  generate(islContent: string): string {
    const domain = this.parseISL(islContent);
    const parts: string[] = [];

    // Imports
    parts.push(this.generateImports());

    // Types
    parts.push(this.generateTypes(domain));

    // DataLoader factory
    parts.push(this.generateLoaderFactory(domain));

    // Context factory
    parts.push(this.generateContextFactory(domain));

    // Batch functions
    parts.push(this.generateBatchFunctions(domain));

    return parts.join('\n\n');
  }

  private generateImports(): string {
    return `
import DataLoader from 'dataloader';
import type { BatchLoadFn, Options } from 'dataloader';`;
  }

  private generateTypes(domain: { entities: Array<{ name: string; fields: Array<{ name: string; type: string }> }> }): string {
    const types: string[] = [];

    // Loader types
    types.push(`
export interface DataLoaders {
  ${domain.entities.map((e) => `${this.toCamelCase(e.name)}Loader: DataLoader<string, ${e.name} | null>;`).join('\n  ')}
  ${domain.entities.map((e) => `${this.toCamelCase(e.name)}sByField: <F extends keyof ${e.name}>(field: F) => DataLoader<${e.name}[F], ${e.name}[]>;`).join('\n  ')}
}`);

    // Service types
    types.push(`
export interface DataSources {
  ${domain.entities.map((e) => `${this.toCamelCase(e.name)}Service: ${e.name}Service;`).join('\n  ')}
}`);

    // Service interface
    for (const entity of domain.entities) {
      types.push(`
export interface ${entity.name}Service {
  getById(id: string): Promise<${entity.name} | null>;
  getByIds(ids: readonly string[]): Promise<(${entity.name} | null)[]>;
  getByField<F extends keyof ${entity.name}>(field: F, values: readonly ${entity.name}[F][]): Promise<${entity.name}[]>;
}`);
    }

    return types.join('\n');
  }

  private generateLoaderFactory(domain: { entities: Array<{ name: string }> }): string {
    const loaders: string[] = [];

    for (const entity of domain.entities) {
      const nameLower = this.toCamelCase(entity.name);

      loaders.push(`
  ${nameLower}Loader: createLoader<string, ${entity.name}>(
    (ids) => dataSources.${nameLower}Service.getByIds(ids),
    loaderOptions
  )`);

      loaders.push(`
  ${nameLower}sByField: <F extends keyof ${entity.name}>(field: F) => {
    return new DataLoader<${entity.name}[F], ${entity.name}[]>(
      async (values) => {
        const items = await dataSources.${nameLower}Service.getByField(field, values);
        // Group by field value
        const grouped = new Map<${entity.name}[F], ${entity.name}[]>();
        for (const item of items) {
          const key = item[field];
          const existing = grouped.get(key) ?? [];
          existing.push(item);
          grouped.set(key, existing);
        }
        return values.map((v) => grouped.get(v) ?? []);
      },
      loaderOptions
    );
  }`);
    }

    return `
const loaderOptions: Options<any, any> = {
  cache: ${this.options.caching},
  maxBatchSize: ${this.options.maxBatchSize},
  batchScheduleFn: ${this.getBatchScheduleFn()},
};

function createLoader<K, V>(
  batchFn: BatchLoadFn<K, V | null>,
  options: Options<K, V | null>
): DataLoader<K, V | null> {
  return new DataLoader(batchFn, options);
}

export function createDataLoaders(dataSources: DataSources): DataLoaders {
  return {
${loaders.join(',\n')}
  };
}`;
  }

  private generateContextFactory(domain: { entities: Array<{ name: string }> }): string {
    return `
export interface RequestContext {
  user?: {
    id: string;
    roles: string[];
  };
  requestId: string;
  dataSources: DataSources;
  loaders: DataLoaders;
}

export function createRequestContext(
  dataSources: DataSources,
  user?: { id: string; roles: string[] }
): RequestContext {
  const loaders = createDataLoaders(dataSources);
  
  return {
    user,
    requestId: generateRequestId(),
    dataSources,
    loaders,
  };
}

function generateRequestId(): string {
  return \`req_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
}

${this.options.requestScoped ? `
// Request-scoped cache clearing
export function clearLoadersForRequest(loaders: DataLoaders): void {
  ${domain.entities.map((e) => `loaders.${this.toCamelCase(e.name)}Loader.clearAll();`).join('\n  ')}
}` : ''}`;
  }

  private generateBatchFunctions(domain: { entities: Array<{ name: string }> }): string {
    const functions: string[] = [];

    for (const entity of domain.entities) {
      functions.push(`
/**
 * Optimized batch loading for ${entity.name}
 */
export async function batch${entity.name}ByIds(
  ids: readonly string[],
  service: ${entity.name}Service
): Promise<(${entity.name} | null)[]> {
  const items = await service.getByIds(ids);
  
  // Create a map for O(1) lookup
  const itemMap = new Map(items.filter(Boolean).map((item) => [item!.id, item]));
  
  // Preserve order and handle missing items
  return ids.map((id) => itemMap.get(id) ?? null);
}

/**
 * Prime the loader cache with items
 */
export function prime${entity.name}Loader(
  loader: DataLoader<string, ${entity.name} | null>,
  items: ${entity.name}[]
): void {
  for (const item of items) {
    loader.prime(item.id, item);
  }
}`);
    }

    return functions.join('\n');
  }

  private getBatchScheduleFn(): string {
    switch (this.options.batchScheduleFn) {
      case 'immediate':
        return '(callback) => callback()';
      case 'setTimeout':
        return '(callback) => setTimeout(callback, 0)';
      default:
        return '(callback) => process.nextTick(callback)';
    }
  }

  private toCamelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  private parseISL(content: string): { entities: Array<{ name: string; fields: Array<{ name: string; type: string }> }> } {
    const entities: Array<{ name: string; fields: Array<{ name: string; type: string }> }> = [];
    const entityRegex = /entity\s+(\w+)\s*\{([^}]+)\}/g;
    let match;
    while ((match = entityRegex.exec(content)) !== null) {
      const fields: Array<{ name: string; type: string }> = [];
      const fieldRegex = /(\w+)\s*:\s*(\w+)/g;
      let fieldMatch;
      while ((fieldMatch = fieldRegex.exec(match[2])) !== null) {
        fields.push({ name: fieldMatch[1], type: fieldMatch[2] });
      }
      entities.push({ name: match[1], fields });
    }
    return { entities };
  }
}

export function generateDataLoaders(
  islContent: string,
  options?: DataLoaderOptions
): string {
  const generator = new DataLoaderGenerator(options);
  return generator.generate(islContent);
}
