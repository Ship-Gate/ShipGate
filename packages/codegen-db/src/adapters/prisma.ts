/**
 * Prisma Schema Generator
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

export class PrismaGenerator implements DatabaseAdapterGenerator {
  generateSchema(context: GeneratorContext): GeneratedFile[] {
    const { entities, enums, options } = context;

    const lines: string[] = [];

    // Generator block
    lines.push('generator client {');
    lines.push('  provider = "prisma-client-js"');
    lines.push('}');
    lines.push('');

    // Datasource block
    lines.push('datasource db {');
    lines.push(`  provider = "${this.mapProvider(options.provider || 'postgresql')}"`);
    lines.push('  url      = env("DATABASE_URL")');
    lines.push('}');
    lines.push('');

    // Generate enums
    for (const enumDef of enums) {
      lines.push(...this.generateEnum(enumDef));
      lines.push('');
    }

    // Generate models
    for (const entity of entities) {
      lines.push(...this.generateModel(entity, context));
      lines.push('');
    }

    return [{
      path: 'schema.prisma',
      content: lines.join('\n'),
      type: 'prisma',
    }];
  }

  getFileExtension(): string {
    return 'prisma';
  }

  private mapProvider(provider: string): string {
    const mapping: Record<string, string> = {
      postgresql: 'postgresql',
      mysql: 'mysql',
      sqlite: 'sqlite',
      mongodb: 'mongodb',
    };
    return mapping[provider] || 'postgresql';
  }

  private generateEnum(enumDef: NormalizedEnum): string[] {
    const lines: string[] = [];
    lines.push(`enum ${enumDef.name} {`);
    for (const value of enumDef.values) {
      lines.push(`  ${value}`);
    }
    lines.push('}');
    return lines;
  }

  private generateModel(entity: NormalizedEntity, context: GeneratorContext): string[] {
    const lines: string[] = [];
    lines.push(`model ${entity.name} {`);

    // Generate fields
    for (const field of entity.fields) {
      lines.push(`  ${this.generateField(field, context)}`);
    }

    // Add soft delete fields if enabled
    if (context.options.softDelete) {
      lines.push('  deletedAt DateTime? @map("deleted_at")');
    }

    // Add audit fields if enabled
    if (context.options.auditFields) {
      lines.push('  createdBy String?  @map("created_by")');
      lines.push('  updatedBy String?  @map("updated_by")');
    }

    lines.push('');

    // Generate indexes
    for (const index of entity.indexes) {
      if (index.unique) {
        lines.push(`  @@unique([${index.fields.join(', ')}])`);
      } else {
        lines.push(`  @@index([${index.fields.join(', ')}])`);
      }
    }

    // Map to table name
    if (entity.tableName !== entity.name.toLowerCase()) {
      lines.push(`  @@map("${entity.tableName}")`);
    }

    lines.push('}');
    return lines;
  }

  private generateField(field: NormalizedField, context: GeneratorContext): string {
    const parts: string[] = [];

    // Field name (camelCase for Prisma)
    const fieldName = toCase(field.name, 'camel');
    parts.push(fieldName);

    // Field type
    const typeStr = this.mapFieldType(field, context);
    parts.push(typeStr);

    // Attributes
    const attrs = this.generateFieldAttributes(field, context);
    if (attrs.length > 0) {
      parts.push(attrs.join(' '));
    }

    return parts.join(' ').padEnd(50) + this.generateFieldComment(field);
  }

  private mapFieldType(field: NormalizedField, context: GeneratorContext): string {
    let baseType: string;

    switch (field.type.kind) {
      case 'enum':
        baseType = field.type.enumName || field.type.name;
        break;
      case 'json':
        baseType = 'Json';
        break;
      case 'scalar':
      default:
        baseType = this.mapScalarType(field.type.scalarType || 'String', context);
        break;
    }

    // Handle arrays
    if (field.type.isArray) {
      baseType = `${baseType}[]`;
    }

    // Handle nullable
    if (field.nullable && !field.type.isArray) {
      baseType = `${baseType}?`;
    }

    return baseType;
  }

  private mapScalarType(scalarType: string, _context: GeneratorContext): string {
    const mapping: Record<string, string> = {
      String: 'String',
      Int: 'Int',
      Float: 'Float',
      Boolean: 'Boolean',
      DateTime: 'DateTime',
      UUID: 'String',
      BigInt: 'BigInt',
      Decimal: 'Decimal',
      Json: 'Json',
      Bytes: 'Bytes',
    };
    return mapping[scalarType] || 'String';
  }

  private generateFieldAttributes(field: NormalizedField, context: GeneratorContext): string[] {
    const attrs: string[] = [];

    // Primary key with auto-generation
    if (field.primaryKey) {
      attrs.push('@id');
      if (field.autoGenerate) {
        if (field.type.scalarType === 'UUID') {
          attrs.push('@default(uuid())');
        } else if (field.type.scalarType === 'Int') {
          attrs.push('@default(autoincrement())');
        } else {
          attrs.push('@default(cuid())');
        }
      }
    }

    // Default value (non-primary key)
    if (!field.primaryKey && field.defaultValue) {
      const defaultAttr = this.generateDefaultAttribute(field.defaultValue, field);
      if (defaultAttr) {
        attrs.push(defaultAttr);
      }
    }

    // Unique constraint
    if (field.unique && !field.primaryKey) {
      attrs.push('@unique');
    }

    // Updated at
    if (field.name.toLowerCase().includes('updated') && field.type.scalarType === 'DateTime') {
      attrs.push('@updatedAt');
    }

    // Database type annotations
    const dbType = this.generateDbTypeAnnotation(field, context);
    if (dbType) {
      attrs.push(dbType);
    }

    // Column mapping
    if (field.columnName !== toCase(field.name, 'camel')) {
      attrs.push(`@map("${field.columnName}")`);
    }

    return attrs;
  }

  private generateDefaultAttribute(defaultValue: DefaultValue, _field: NormalizedField): string | null {
    switch (defaultValue.kind) {
      case 'literal':
        if (typeof defaultValue.value === 'string') {
          return `@default("${defaultValue.value}")`;
        } else if (typeof defaultValue.value === 'number') {
          return `@default(${defaultValue.value})`;
        } else if (typeof defaultValue.value === 'boolean') {
          return `@default(${defaultValue.value})`;
        }
        return null;

      case 'function':
        switch (defaultValue.function) {
          case 'now':
            return '@default(now())';
          case 'uuid':
            return '@default(uuid())';
          case 'cuid':
            return '@default(cuid())';
          case 'autoincrement':
            return '@default(autoincrement())';
          default:
            return null;
        }

      default:
        return null;
    }
  }

  private generateDbTypeAnnotation(field: NormalizedField, context: GeneratorContext): string | null {
    const { constraints } = field;
    const provider = context.options.provider || 'postgresql';

    // VarChar with length
    if (field.type.scalarType === 'String' && constraints.maxLength) {
      if (provider === 'postgresql') {
        return `@db.VarChar(${constraints.maxLength})`;
      } else if (provider === 'mysql') {
        return `@db.VarChar(${constraints.maxLength})`;
      }
    }

    // Decimal with precision/scale
    if (field.type.scalarType === 'Decimal' && (constraints.precision || constraints.scale)) {
      const precision = constraints.precision || 10;
      const scale = constraints.scale || 2;
      return `@db.Decimal(${precision}, ${scale})`;
    }

    // UUID type for PostgreSQL
    if (field.type.scalarType === 'UUID' && provider === 'postgresql') {
      return '@db.Uuid';
    }

    return null;
  }

  private generateFieldComment(field: NormalizedField): string {
    const comments: string[] = [];

    if (field.immutable) {
      comments.push('immutable');
    }

    if (field.constraints.minLength) {
      comments.push(`min: ${field.constraints.minLength}`);
    }

    if (field.constraints.pattern) {
      comments.push(`pattern: ${field.constraints.pattern}`);
    }

    if (comments.length > 0) {
      return `// ${comments.join(', ')}`;
    }

    return '';
  }
}
