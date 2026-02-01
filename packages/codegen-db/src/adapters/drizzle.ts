/**
 * Drizzle Schema Generator
 */

import type {
  DatabaseAdapterGenerator,
  GeneratorContext,
  GeneratedFile,
  NormalizedEntity,
  NormalizedEnum,
  NormalizedField,
  DefaultValue,
} from '../types.js';
import { toCase } from '../generator.js';

export class DrizzleGenerator implements DatabaseAdapterGenerator {
  generateSchema(context: GeneratorContext): GeneratedFile[] {
    const { entities, enums, options } = context;
    const provider = options.provider || 'postgresql';

    const lines: string[] = [];

    // Imports based on provider
    lines.push(...this.generateImports(entities, enums, provider));
    lines.push('');

    // Generate enums
    for (const enumDef of enums) {
      lines.push(...this.generateEnum(enumDef, provider));
      lines.push('');
    }

    // Generate tables
    for (const entity of entities) {
      lines.push(...this.generateTable(entity, context));
      lines.push('');
    }

    // Generate relations
    lines.push(...this.generateRelations(entities));

    return [{
      path: 'schema.ts',
      content: lines.join('\n'),
      type: 'typescript',
    }];
  }

  getFileExtension(): string {
    return 'ts';
  }

  private generateImports(
    entities: NormalizedEntity[],
    enums: NormalizedEnum[],
    provider: string
  ): string[] {
    const imports = new Set<string>();

    // Core imports
    imports.add('pgTable');

    // Collect types needed
    for (const entity of entities) {
      for (const field of entity.fields) {
        const drizzleType = this.mapFieldTypeToImport(field, provider);
        if (drizzleType) {
          imports.add(drizzleType);
        }
      }
    }

    // Add enum import if needed
    if (enums.length > 0) {
      imports.add('pgEnum');
    }

    const providerModule = this.getProviderModule(provider);
    const importList = Array.from(imports).sort().join(', ');

    return [
      `import { ${importList} } from '${providerModule}';`,
      "import { relations } from 'drizzle-orm';",
    ];
  }

  private getProviderModule(provider: string): string {
    switch (provider) {
      case 'mysql':
        return 'drizzle-orm/mysql-core';
      case 'sqlite':
        return 'drizzle-orm/sqlite-core';
      default:
        return 'drizzle-orm/pg-core';
    }
  }

  private mapFieldTypeToImport(field: NormalizedField, provider: string): string | null {
    if (field.type.kind === 'enum') {
      return null; // Enum is handled separately
    }

    const scalarType = field.type.scalarType || 'String';
    const mapping: Record<string, Record<string, string>> = {
      postgresql: {
        String: 'varchar',
        Int: 'integer',
        Float: 'real',
        Boolean: 'boolean',
        DateTime: 'timestamp',
        UUID: 'uuid',
        BigInt: 'bigint',
        Decimal: 'decimal',
        Json: 'json',
        Bytes: 'bytea',
      },
      mysql: {
        String: 'varchar',
        Int: 'int',
        Float: 'float',
        Boolean: 'boolean',
        DateTime: 'datetime',
        UUID: 'varchar',
        BigInt: 'bigint',
        Decimal: 'decimal',
        Json: 'json',
        Bytes: 'blob',
      },
      sqlite: {
        String: 'text',
        Int: 'integer',
        Float: 'real',
        Boolean: 'integer',
        DateTime: 'text',
        UUID: 'text',
        BigInt: 'integer',
        Decimal: 'real',
        Json: 'text',
        Bytes: 'blob',
      },
    };

    return mapping[provider]?.[scalarType] || 'varchar';
  }

  private generateEnum(enumDef: NormalizedEnum, provider: string): string[] {
    const lines: string[] = [];
    const enumName = toCase(enumDef.name, 'camel') + 'Enum';
    const values = enumDef.values.map(v => `'${v}'`).join(', ');

    lines.push(`export const ${enumName} = pgEnum('${enumDef.dbName}', [${values}]);`);

    return lines;
  }

  private generateTable(entity: NormalizedEntity, context: GeneratorContext): string[] {
    const lines: string[] = [];
    const tableName = toCase(entity.name, 'camel');
    const provider = context.options.provider || 'postgresql';

    lines.push(`export const ${tableName} = pgTable('${entity.tableName}', {`);

    // Generate fields
    for (const field of entity.fields) {
      lines.push(`  ${this.generateField(field, context)},`);
    }

    // Add soft delete if enabled
    if (context.options.softDelete) {
      lines.push("  deletedAt: timestamp('deleted_at'),");
    }

    // Add audit fields if enabled
    if (context.options.auditFields) {
      lines.push("  createdBy: varchar('created_by', { length: 255 }),");
      lines.push("  updatedBy: varchar('updated_by', { length: 255 }),");
    }

    // Close table definition and add indexes
    if (entity.indexes.length > 0 || entity.uniqueConstraints.length > 0) {
      lines.push('}, (table) => ({');

      for (let i = 0; i < entity.indexes.length; i++) {
        const index = entity.indexes[i];
        const indexName = `${tableName}Idx${i + 1}`;
        const fields = index.fields.map(f => `table.${toCase(f, 'camel')}`).join(', ');
        lines.push(`  ${indexName}: index('${entity.tableName}_${index.fields.join('_')}_idx').on(${fields}),`);
      }

      lines.push('}));');
    } else {
      lines.push('});');
    }

    // Export inferred types
    lines.push('');
    lines.push(`export type ${entity.name} = typeof ${tableName}.$inferSelect;`);
    lines.push(`export type New${entity.name} = typeof ${tableName}.$inferInsert;`);

    return lines;
  }

  private generateField(field: NormalizedField, context: GeneratorContext): string {
    const provider = context.options.provider || 'postgresql';
    const fieldName = toCase(field.name, 'camel');

    // Build the field definition
    let fieldDef = this.buildFieldDefinition(field, provider);

    // Add constraints
    const modifiers = this.buildFieldModifiers(field);

    return `${fieldName}: ${fieldDef}${modifiers}`;
  }

  private buildFieldDefinition(field: NormalizedField, provider: string): string {
    if (field.type.kind === 'enum') {
      const enumName = toCase(field.type.enumName || field.type.name, 'camel') + 'Enum';
      return `${enumName}('${field.columnName}')`;
    }

    const scalarType = field.type.scalarType || 'String';
    const drizzleType = this.mapFieldTypeToImport(field, provider) || 'varchar';

    // Handle type-specific configurations
    switch (scalarType) {
      case 'String':
        const length = field.constraints.maxLength || 255;
        return `varchar('${field.columnName}', { length: ${length} })`;

      case 'UUID':
        if (provider === 'postgresql') {
          return `uuid('${field.columnName}')`;
        }
        return `varchar('${field.columnName}', { length: 36 })`;

      case 'Decimal':
        const precision = field.constraints.precision || 10;
        const scale = field.constraints.scale || 2;
        return `decimal('${field.columnName}', { precision: ${precision}, scale: ${scale} })`;

      case 'DateTime':
        return `timestamp('${field.columnName}')`;

      case 'Int':
        return `integer('${field.columnName}')`;

      case 'Float':
        return `real('${field.columnName}')`;

      case 'Boolean':
        return `boolean('${field.columnName}')`;

      case 'BigInt':
        return `bigint('${field.columnName}', { mode: 'number' })`;

      case 'Json':
        return `json('${field.columnName}')`;

      default:
        return `varchar('${field.columnName}', { length: 255 })`;
    }
  }

  private buildFieldModifiers(field: NormalizedField): string {
    const modifiers: string[] = [];

    // Primary key
    if (field.primaryKey) {
      modifiers.push('.primaryKey()');
      if (field.autoGenerate && field.type.scalarType === 'UUID') {
        modifiers.push('.defaultRandom()');
      } else if (field.autoGenerate && field.type.scalarType === 'Int') {
        // Auto-increment handled differently in Drizzle
      }
    }

    // Not null (unless optional)
    if (!field.nullable && !field.primaryKey) {
      modifiers.push('.notNull()');
    }

    // Unique
    if (field.unique && !field.primaryKey) {
      modifiers.push('.unique()');
    }

    // Default value
    if (!field.primaryKey && field.defaultValue) {
      const defaultMod = this.buildDefaultModifier(field.defaultValue);
      if (defaultMod) {
        modifiers.push(defaultMod);
      }
    }

    // Auto-generated timestamps
    const fieldName = field.name.toLowerCase();
    if (field.type.scalarType === 'DateTime') {
      if (fieldName.includes('created') || fieldName === 'createdat') {
        modifiers.push('.notNull()');
        modifiers.push('.defaultNow()');
      } else if (fieldName.includes('updated') || fieldName === 'updatedat') {
        modifiers.push('.notNull()');
        modifiers.push('.defaultNow()');
      }
    }

    return modifiers.join('');
  }

  private buildDefaultModifier(defaultValue: DefaultValue): string | null {
    switch (defaultValue.kind) {
      case 'literal':
        if (typeof defaultValue.value === 'string') {
          return `.default('${defaultValue.value}')`;
        } else if (typeof defaultValue.value === 'number' || typeof defaultValue.value === 'boolean') {
          return `.default(${defaultValue.value})`;
        }
        return null;

      case 'function':
        switch (defaultValue.function) {
          case 'now':
            return '.defaultNow()';
          case 'uuid':
            return '.defaultRandom()';
          default:
            return null;
        }

      default:
        return null;
    }
  }

  private generateRelations(entities: NormalizedEntity[]): string[] {
    const lines: string[] = [];

    // Generate relations based on entity relationships
    for (const entity of entities) {
      if (entity.relations.length > 0) {
        const tableName = toCase(entity.name, 'camel');
        lines.push(`export const ${tableName}Relations = relations(${tableName}, ({ one, many }) => ({`);

        for (const relation of entity.relations) {
          const targetTable = toCase(relation.target, 'camel');
          const relationType = relation.type === 'one-to-many' || relation.type === 'many-to-many' ? 'many' : 'one';
          lines.push(`  ${relation.name}: ${relationType}(${targetTable}),`);
        }

        lines.push('}));');
        lines.push('');
      }
    }

    return lines;
  }
}
