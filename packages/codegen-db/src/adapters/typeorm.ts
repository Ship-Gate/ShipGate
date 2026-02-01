/**
 * TypeORM Entity Generator
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

export class TypeORMGenerator implements DatabaseAdapterGenerator {
  generateSchema(context: GeneratorContext): GeneratedFile[] {
    const { entities, enums, options } = context;
    const files: GeneratedFile[] = [];

    // Generate enum file
    if (enums.length > 0) {
      files.push({
        path: 'enums.ts',
        content: this.generateEnumsFile(enums),
        type: 'typescript',
      });
    }

    // Generate entity files
    for (const entity of entities) {
      files.push({
        path: `entities/${entity.name}.ts`,
        content: this.generateEntityFile(entity, enums, context),
        type: 'typescript',
      });
    }

    // Generate index file
    files.push({
      path: 'entities/index.ts',
      content: this.generateIndexFile(entities, enums),
      type: 'typescript',
    });

    return files;
  }

  getFileExtension(): string {
    return 'ts';
  }

  private generateEnumsFile(enums: NormalizedEnum[]): string {
    const lines: string[] = [];

    for (const enumDef of enums) {
      lines.push(`export enum ${enumDef.name} {`);
      for (const value of enumDef.values) {
        lines.push(`  ${value} = '${value}',`);
      }
      lines.push('}');
      lines.push('');
    }

    return lines.join('\n');
  }

  private generateEntityFile(
    entity: NormalizedEntity,
    enums: NormalizedEnum[],
    context: GeneratorContext
  ): string {
    const lines: string[] = [];
    const enumNames = new Set(enums.map(e => e.name));

    // Imports
    lines.push(...this.generateImports(entity, enumNames, context));
    lines.push('');

    // Entity decorator
    lines.push(`@Entity('${entity.tableName}')`);

    // Add indexes
    for (const index of entity.indexes) {
      if (!index.unique) {
        const fields = index.fields.map(f => `'${f}'`).join(', ');
        lines.push(`@Index([${fields}])`);
      }
    }

    // Class definition
    lines.push(`export class ${entity.name} {`);

    // Generate fields
    for (const field of entity.fields) {
      lines.push(...this.generateField(field, context));
      lines.push('');
    }

    // Add soft delete if enabled
    if (context.options.softDelete) {
      lines.push('  @DeleteDateColumn({ name: \'deleted_at\' })');
      lines.push('  deletedAt?: Date;');
      lines.push('');
    }

    // Add audit fields if enabled
    if (context.options.auditFields) {
      lines.push('  @Column({ name: \'created_by\', nullable: true })');
      lines.push('  createdBy?: string;');
      lines.push('');
      lines.push('  @Column({ name: \'updated_by\', nullable: true })');
      lines.push('  updatedBy?: string;');
      lines.push('');
    }

    lines.push('}');

    return lines.join('\n');
  }

  private generateImports(
    entity: NormalizedEntity,
    enumNames: Set<string>,
    context: GeneratorContext
  ): string[] {
    const typeormImports = new Set<string>(['Entity', 'Column']);

    // Check what decorators we need
    for (const field of entity.fields) {
      if (field.primaryKey) {
        typeormImports.add('PrimaryGeneratedColumn');
        if (!field.autoGenerate) {
          typeormImports.add('PrimaryColumn');
        }
      }

      const fieldName = field.name.toLowerCase();
      if (field.type.scalarType === 'DateTime') {
        if (fieldName.includes('created')) {
          typeormImports.add('CreateDateColumn');
        } else if (fieldName.includes('updated')) {
          typeormImports.add('UpdateDateColumn');
        }
      }
    }

    // Check for soft delete
    if (context.options.softDelete) {
      typeormImports.add('DeleteDateColumn');
    }

    // Check for indexes
    if (entity.indexes.length > 0) {
      typeormImports.add('Index');
    }

    // Check for unique constraints
    for (const field of entity.fields) {
      if (field.unique && !field.primaryKey) {
        typeormImports.add('Unique');
        break;
      }
    }

    const lines: string[] = [];
    lines.push(`import { ${Array.from(typeormImports).sort().join(', ')} } from 'typeorm';`);

    // Import enums if used
    const usedEnums = entity.fields
      .filter(f => f.type.kind === 'enum' && f.type.enumName)
      .map(f => f.type.enumName!);
    
    if (usedEnums.length > 0) {
      const uniqueEnums = [...new Set(usedEnums)];
      lines.push(`import { ${uniqueEnums.join(', ')} } from '../enums';`);
    }

    return lines;
  }

  private generateField(field: NormalizedField, context: GeneratorContext): string[] {
    const lines: string[] = [];
    const fieldName = toCase(field.name, 'camel');
    const provider = context.options.provider || 'postgresql';

    // Primary key handling
    if (field.primaryKey) {
      if (field.autoGenerate) {
        if (field.type.scalarType === 'UUID') {
          lines.push("  @PrimaryGeneratedColumn('uuid')");
        } else {
          lines.push("  @PrimaryGeneratedColumn('increment')");
        }
      } else {
        lines.push('  @PrimaryColumn()');
      }
      lines.push(`  ${fieldName}!: ${this.mapToTsType(field)};`);
      return lines;
    }

    // Timestamp columns
    const lowerName = field.name.toLowerCase();
    if (field.type.scalarType === 'DateTime') {
      if (lowerName.includes('created') || lowerName === 'createdat') {
        lines.push(`  @CreateDateColumn({ name: '${field.columnName}' })`);
        lines.push(`  ${fieldName}!: Date;`);
        return lines;
      }
      if (lowerName.includes('updated') || lowerName === 'updatedat') {
        lines.push(`  @UpdateDateColumn({ name: '${field.columnName}' })`);
        lines.push(`  ${fieldName}!: Date;`);
        return lines;
      }
    }

    // Regular column
    const columnOptions = this.buildColumnOptions(field, provider);
    lines.push(`  @Column(${columnOptions})`);

    // Add unique decorator if needed
    if (field.unique) {
      // Unique is handled in column options
    }

    // Field declaration
    const tsType = this.mapToTsType(field);
    const optional = field.nullable ? '?' : '!';
    lines.push(`  ${fieldName}${optional}: ${tsType};`);

    return lines;
  }

  private buildColumnOptions(field: NormalizedField, provider: string): string {
    const options: string[] = [];

    // Column name
    if (field.columnName !== toCase(field.name, 'camel')) {
      options.push(`name: '${field.columnName}'`);
    }

    // Type
    const dbType = this.mapToDbType(field, provider);
    if (dbType) {
      options.push(`type: '${dbType}'`);
    }

    // Enum
    if (field.type.kind === 'enum') {
      options.push(`type: 'enum'`);
      options.push(`enum: ${field.type.enumName}`);
    }

    // Length
    if (field.constraints.maxLength) {
      options.push(`length: ${field.constraints.maxLength}`);
    }

    // Precision and scale for decimals
    if (field.type.scalarType === 'Decimal') {
      if (field.constraints.precision) {
        options.push(`precision: ${field.constraints.precision}`);
      }
      if (field.constraints.scale) {
        options.push(`scale: ${field.constraints.scale}`);
      }
    }

    // Nullable
    if (field.nullable) {
      options.push('nullable: true');
    }

    // Unique
    if (field.unique && !field.primaryKey) {
      options.push('unique: true');
    }

    // Default value
    if (field.defaultValue) {
      const defaultVal = this.formatDefaultValue(field.defaultValue);
      if (defaultVal !== null) {
        options.push(`default: ${defaultVal}`);
      }
    }

    if (options.length === 0) {
      return '';
    }

    return `{ ${options.join(', ')} }`;
  }

  private mapToDbType(field: NormalizedField, provider: string): string | null {
    if (field.type.kind === 'enum') {
      return null; // Handled separately
    }

    const scalarType = field.type.scalarType || 'String';

    const mapping: Record<string, Record<string, string>> = {
      postgresql: {
        String: 'varchar',
        Int: 'int',
        Float: 'float',
        Boolean: 'boolean',
        DateTime: 'timestamp',
        UUID: 'uuid',
        BigInt: 'bigint',
        Decimal: 'decimal',
        Json: 'jsonb',
        Bytes: 'bytea',
      },
      mysql: {
        String: 'varchar',
        Int: 'int',
        Float: 'float',
        Boolean: 'tinyint',
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

    return mapping[provider]?.[scalarType] || null;
  }

  private mapToTsType(field: NormalizedField): string {
    if (field.type.kind === 'enum') {
      return field.type.enumName || field.type.name;
    }

    const scalarType = field.type.scalarType || 'String';
    const mapping: Record<string, string> = {
      String: 'string',
      Int: 'number',
      Float: 'number',
      Boolean: 'boolean',
      DateTime: 'Date',
      UUID: 'string',
      BigInt: 'bigint',
      Decimal: 'string',
      Json: 'Record<string, unknown>',
      Bytes: 'Buffer',
    };

    let tsType = mapping[scalarType] || 'string';

    if (field.type.isArray) {
      tsType = `${tsType}[]`;
    }

    return tsType;
  }

  private formatDefaultValue(defaultValue: DefaultValue): string | null {
    switch (defaultValue.kind) {
      case 'literal':
        if (typeof defaultValue.value === 'string') {
          return `'${defaultValue.value}'`;
        }
        return String(defaultValue.value);

      case 'function':
        switch (defaultValue.function) {
          case 'now':
            return "() => 'CURRENT_TIMESTAMP'";
          case 'uuid':
            return "() => 'uuid_generate_v4()'";
          default:
            return null;
        }

      default:
        return null;
    }
  }

  private generateIndexFile(entities: NormalizedEntity[], enums: NormalizedEnum[]): string {
    const lines: string[] = [];

    // Export enums
    if (enums.length > 0) {
      lines.push("export * from '../enums';");
    }

    // Export entities
    for (const entity of entities) {
      lines.push(`export { ${entity.name} } from './${entity.name}';`);
    }

    return lines.join('\n');
  }
}
