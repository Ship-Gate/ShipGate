/**
 * DataLoader Generator - Generate DataLoader setup from ISL AST.
 */

import type { AST, ASTEntity, ASTDomain } from '../types.js';

// Type alias for Entity
type Entity = ASTEntity;

/**
 * DataLoader configuration
 */
export interface DataLoaderConfig {
  /** Batch size limit */
  batchSize?: number;
  /** Cache enabled */
  cache?: boolean;
  /** Cache key function */
  cacheKeyFn?: string;
}

const defaultConfig: Required<DataLoaderConfig> = {
  batchSize: 100,
  cache: true,
  cacheKeyFn: '(key) => key',
};

/**
 * Generate DataLoader setup code
 */
export function generateDataLoaders(
  ast: AST,
  config: DataLoaderConfig = {}
): string {
  const cfg = { ...defaultConfig, ...config };
  const lines: string[] = [];

  // Add imports
  lines.push("import DataLoader from 'dataloader';");
  lines.push('');

  // Generate types
  lines.push(generateLoaderTypes(ast));
  lines.push('');

  // Generate factory function
  lines.push(generateLoaderFactory(ast, cfg));

  return lines.join('\n');
}

function generateLoaderTypes(ast: AST): string {
  const lines: string[] = [];

  lines.push('export interface Loaders {');

  for (const domain of ast.domains ?? []) {
    for (const entity of domain.entities ?? []) {
      const loaderName = getLoaderName(entity.name);
      lines.push(`  ${loaderName}: DataLoader<string, ${entity.name} | null>;`);
    }
  }

  lines.push('}');

  return lines.join('\n');
}

function generateLoaderFactory(ast: AST, cfg: Required<DataLoaderConfig>): string {
  const lines: string[] = [];

  lines.push('export function createLoaders(services: Services): Loaders {');
  lines.push('  return {');

  for (const domain of ast.domains ?? []) {
    for (const entity of domain.entities ?? []) {
      const loaderName = getLoaderName(entity.name);
      const serviceName = domain.name.toLowerCase();
      
      lines.push(`    ${loaderName}: new DataLoader<string, ${entity.name} | null>(`);
      lines.push(`      async (ids) => {`);
      lines.push(`        const items = await services.${serviceName}.getByIds(ids as string[]);`);
      lines.push(`        const itemMap = new Map(items.map(item => [item.id, item]));`);
      lines.push(`        return ids.map(id => itemMap.get(id) ?? null);`);
      lines.push(`      },`);
      lines.push('      {');
      lines.push(`        maxBatchSize: ${cfg.batchSize},`);
      lines.push(`        cache: ${cfg.cache},`);
      lines.push(`        cacheKeyFn: ${cfg.cacheKeyFn},`);
      lines.push('      }');
      lines.push('    ),');
    }
  }

  lines.push('  };');
  lines.push('}');

  return lines.join('\n');
}

function getLoaderName(entityName: string): string {
  return entityName.charAt(0).toLowerCase() + entityName.slice(1) + 'ById';
}

/**
 * Generate batch loading function for an entity
 */
export function generateBatchLoader(entity: Entity): string {
  const entityName = entity.name;
  const loaderName = getLoaderName(entityName);

  return `
export const ${loaderName}Loader = new DataLoader<string, ${entityName} | null>(
  async (ids: readonly string[]) => {
    const items = await db.${entityName.toLowerCase()}.findMany({
      where: { id: { in: ids as string[] } },
    });
    
    const itemMap = new Map(items.map(item => [item.id, item]));
    return ids.map(id => itemMap.get(id) ?? null);
  }
);
`.trim();
}

/**
 * Generate relationship loaders
 */
export function generateRelationshipLoaders(
  entity: Entity,
  relationships: Array<{ fieldName: string; targetEntity: string; foreignKey: string }>
): string {
  const lines: string[] = [];

  for (const rel of relationships) {
    const loaderName = `${entity.name.toLowerCase()}${rel.fieldName.charAt(0).toUpperCase() + rel.fieldName.slice(1)}Loader`;
    
    lines.push(`export const ${loaderName} = new DataLoader<string, ${rel.targetEntity}[]>(`);
    lines.push(`  async (parentIds: readonly string[]) => {`);
    lines.push(`    const items = await db.${rel.targetEntity.toLowerCase()}.findMany({`);
    lines.push(`      where: { ${rel.foreignKey}: { in: parentIds as string[] } },`);
    lines.push(`    });`);
    lines.push('');
    lines.push(`    const grouped = new Map<string, ${rel.targetEntity}[]>();`);
    lines.push(`    for (const item of items) {`);
    lines.push(`      const key = item.${rel.foreignKey};`);
    lines.push(`      const existing = grouped.get(key) ?? [];`);
    lines.push(`      existing.push(item);`);
    lines.push(`      grouped.set(key, existing);`);
    lines.push(`    }`);
    lines.push('');
    lines.push(`    return parentIds.map(id => grouped.get(id) ?? []);`);
    lines.push(`  }`);
    lines.push(');');
    lines.push('');
  }

  return lines.join('\n');
}
