/**
 * Prisma Schema Generator
 * 
 * Generates Prisma schema from ISL entities.
 */

import type { GeneratedFile, DomainSpec, EntitySpec, FieldSpec } from '../types.js';

// ============================================================================
// Types
// ============================================================================

export interface PrismaOptions {
  /** Database provider */
  provider: 'postgresql' | 'mysql' | 'sqlite' | 'mongodb';
  /** Output prefix */
  outputPrefix?: string;
}

// ============================================================================
// Prisma Generator
// ============================================================================

export class PrismaGenerator {
  private options: Required<PrismaOptions>;

  constructor(options: PrismaOptions) {
    this.options = {
      provider: options.provider,
      outputPrefix: options.outputPrefix || '',
    };
  }

  /**
   * Generate Prisma schema
   */
  generate(domain: DomainSpec): GeneratedFile[] {
    const lines = [
      '// ============================================================',
      `// Generated Prisma Schema for ${domain.name}`,
      '// DO NOT EDIT - Auto-generated from ISL',
      '// ============================================================',
      '',
      'generator client {',
      '  provider = "prisma-client-js"',
      '}',
      '',
      'datasource db {',
      `  provider = "${this.options.provider}"`,
      '  url      = env("DATABASE_URL")',
      '}',
      '',
    ];

    // Generate models for each entity
    for (const entity of domain.entities) {
      lines.push(...this.generateModel(entity, domain.entities));
      lines.push('');
    }

    return [{
      path: `${this.options.outputPrefix}schema.prisma`,
      content: lines.join('\n'),
      type: 'schema',
    }];
  }

  /**
   * Generate Prisma model for entity
   */
  private generateModel(entity: EntitySpec, allEntities: EntitySpec[]): string[] {
    const lines = [`model ${entity.name} {`];

    for (const field of entity.fields) {
      lines.push(`  ${this.generateField(field, allEntities)}`);
    }

    // Add index annotations
    if (entity.indexes?.length) {
      lines.push('');
      for (const idx of entity.indexes) {
        const fields = idx.fields.join(', ');
        if (idx.unique) {
          lines.push(`  @@unique([${fields}])`);
        } else {
          lines.push(`  @@index([${fields}])`);
        }
      }
    }

    // Map table name to snake_case
    const tableName = this.toSnakeCase(entity.name);
    lines.push(`  @@map("${tableName}")`);

    lines.push('}');
    return lines;
  }

  /**
   * Generate Prisma field
   */
  private generateField(field: FieldSpec, allEntities: EntitySpec[]): string {
    const parts: string[] = [field.name];

    // Type
    let prismaType = this.toPrismaType(field.type);
    
    // Check if it's a relation
    const isRelation = allEntities.some(e => e.name === field.type);
    if (isRelation) {
      prismaType = field.type;
    }

    // Optional modifier
    if (field.optional && !isRelation) {
      prismaType += '?';
    }

    parts.push(prismaType);

    // Attributes
    const attrs: string[] = [];

    if (field.name === 'id' && field.type === 'UUID') {
      attrs.push('@id');
      attrs.push('@default(uuid())');
    } else if (field.annotations.includes('unique')) {
      attrs.push('@unique');
    }

    if (field.annotations.includes('immutable') && field.type === 'Timestamp') {
      attrs.push('@default(now())');
    }

    if (field.type === 'Timestamp' && field.name.includes('updated')) {
      attrs.push('@updatedAt');
    }

    if (field.references) {
      attrs.push(`@relation(fields: [${field.name}Id], references: [${field.references.field}])`);
    }

    // Map column name to snake_case
    const columnName = this.toSnakeCase(field.name);
    if (columnName !== field.name) {
      attrs.push(`@map("${columnName}")`);
    }

    if (attrs.length > 0) {
      parts.push(attrs.join(' '));
    }

    return parts.join(' ');
  }

  /**
   * Convert ISL type to Prisma type
   */
  private toPrismaType(type: string): string {
    switch (type) {
      case 'String': return 'String';
      case 'Int': return 'Int';
      case 'Decimal': return 'Decimal';
      case 'Boolean': return 'Boolean';
      case 'UUID': return 'String';
      case 'Timestamp': return 'DateTime';
      default: return 'String';
    }
  }

  /**
   * Convert to snake_case
   */
  private toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }
}

export function generatePrismaSchema(domain: DomainSpec, options: PrismaOptions): GeneratedFile[] {
  return new PrismaGenerator(options).generate(domain);
}
