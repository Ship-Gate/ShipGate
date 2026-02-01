/**
 * Drizzle Migration Generator
 * 
 * Generates Drizzle ORM-compatible TypeScript migrations from ISL domain diffs.
 */

import type {
  DomainDiff,
  EntityDiff,
  FieldChange,
  EnumDiff,
  GeneratorOptions,
  MigrationOutput,
  SqlDialect,
} from '../types.js';

import {
  toSnakeCase,
  toCamelCase,
  islTypeToSql,
  generateMigrationName,
  defaultNamingConvention,
} from '../utils.js';

import { checkMigrationSafety } from '../validators/safe.js';

/**
 * Default Drizzle generator options
 */
const defaultOptions: GeneratorOptions = {
  dialect: 'postgresql',
  includeComments: true,
  includeSafetyWarnings: true,
  generateRollback: true,
  namingConvention: defaultNamingConvention,
};

/**
 * Generate Drizzle migration from domain diff
 */
export function generateDrizzleMigration(
  diff: DomainDiff,
  options: Partial<GeneratorOptions> = {}
): MigrationOutput {
  const opts = { ...defaultOptions, ...options };
  const safety = checkMigrationSafety(diff);
  
  const upStatements = generateDrizzleUpMigration(diff, opts);
  const downStatements = opts.generateRollback 
    ? generateDrizzleDownMigration(diff, opts) 
    : '// Rollback not generated';
  
  return {
    name: generateMigrationName(getDrizzleDiffDescription(diff)),
    timestamp: new Date(),
    up: upStatements,
    down: downStatements,
    breaking: diff.breaking,
    safety,
    metadata: {
      domain: diff.domain,
      fromVersion: diff.oldVersion,
      toVersion: diff.newVersion,
      generator: 'drizzle',
      tablesAffected: diff.entities.map(e => toSnakeCase(e.entity)),
      columnsAffected: getAffectedColumns(diff),
    },
  };
}

/**
 * Generate Drizzle up migration
 */
function generateDrizzleUpMigration(diff: DomainDiff, opts: GeneratorOptions): string {
  const lines: string[] = [];
  
  // Imports
  lines.push(getDrizzleImports(diff, opts));
  lines.push('');
  
  // Migration function
  lines.push('export async function up(db: any) {');
  
  // Process enums
  for (const enumDiff of diff.enums) {
    if (enumDiff.type === 'added') {
      lines.push(generateDrizzleCreateEnum(enumDiff, opts));
    }
  }
  
  // Process entities
  for (const entityDiff of diff.entities) {
    switch (entityDiff.type) {
      case 'added':
        lines.push(generateDrizzleCreateTable(entityDiff, opts));
        break;
      case 'removed':
        lines.push(generateDrizzleDropTable(entityDiff, opts));
        break;
      case 'modified':
        lines.push(generateDrizzleAlterTable(entityDiff, opts));
        break;
    }
  }
  
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Generate Drizzle down migration
 */
function generateDrizzleDownMigration(diff: DomainDiff, opts: GeneratorOptions): string {
  const lines: string[] = [];
  
  lines.push(getDrizzleImports(diff, opts));
  lines.push('');
  lines.push('export async function down(db: any) {');
  
  // Reverse entity operations
  for (const entityDiff of [...diff.entities].reverse()) {
    switch (entityDiff.type) {
      case 'added':
        lines.push(`  await db.execute(sql\`DROP TABLE IF EXISTS "${toSnakeCase(entityDiff.entity)}"\`);`);
        break;
      case 'removed':
        lines.push(`  // Cannot automatically recreate dropped table "${entityDiff.entity}"`);
        break;
      case 'modified':
        lines.push(generateDrizzleReverseAlter(entityDiff, opts));
        break;
    }
  }
  
  // Reverse enum operations
  for (const enumDiff of [...diff.enums].reverse()) {
    if (enumDiff.type === 'added' && opts.dialect === 'postgresql') {
      lines.push(`  await db.execute(sql\`DROP TYPE IF EXISTS "${toSnakeCase(enumDiff.enum)}"\`);`);
    }
  }
  
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Get Drizzle imports
 */
function getDrizzleImports(diff: DomainDiff, opts: GeneratorOptions): string {
  const imports = ['sql'];
  
  switch (opts.dialect) {
    case 'postgresql':
      imports.push('pgTable', 'pgEnum');
      break;
    case 'mysql':
      imports.push('mysqlTable', 'mysqlEnum');
      break;
    case 'sqlite':
      imports.push('sqliteTable');
      break;
  }
  
  // Add column type imports
  const columnTypes = new Set<string>();
  for (const entity of diff.entities) {
    if (entity.changes) {
      for (const change of entity.changes) {
        const drizzleType = getDrizzleColumnType(change.newType || change.oldType || 'String', opts.dialect);
        columnTypes.add(drizzleType);
      }
    }
  }
  
  imports.push(...Array.from(columnTypes));
  
  const dialectPackage = opts.dialect === 'postgresql' 
    ? 'drizzle-orm/pg-core'
    : opts.dialect === 'mysql'
    ? 'drizzle-orm/mysql-core'
    : 'drizzle-orm/sqlite-core';
  
  return `import { ${imports.join(', ')} } from '${dialectPackage}';`;
}

/**
 * Generate Drizzle CREATE TABLE
 */
function generateDrizzleCreateTable(entityDiff: EntityDiff, opts: GeneratorOptions): string {
  const tableName = toSnakeCase(entityDiff.entity);
  const varName = toCamelCase(entityDiff.entity);
  const lines: string[] = [];
  
  if (opts.includeComments) {
    lines.push(`  // Create table: ${entityDiff.entity}`);
  }
  
  const tableFunc = opts.dialect === 'postgresql' ? 'pgTable' 
    : opts.dialect === 'mysql' ? 'mysqlTable' 
    : 'sqliteTable';
  
  lines.push(`  const ${varName} = ${tableFunc}('${tableName}', {`);
  
  for (const change of entityDiff.changes!) {
    const colName = toSnakeCase(change.field);
    const drizzleType = getDrizzleColumnType(change.newType!, opts.dialect);
    const modifiers = getDrizzleColumnModifiers(change, opts);
    
    lines.push(`    ${toCamelCase(change.field)}: ${drizzleType}('${colName}')${modifiers},`);
  }
  
  lines.push('  });');
  lines.push('');
  lines.push(`  await db.execute(sql\`CREATE TABLE IF NOT EXISTS "${tableName}" (\${${varName}._.columns.map(c => c.sql).join(', ')})\`);`);
  
  return lines.join('\n');
}

/**
 * Generate Drizzle DROP TABLE
 */
function generateDrizzleDropTable(entityDiff: EntityDiff, opts: GeneratorOptions): string {
  const tableName = toSnakeCase(entityDiff.entity);
  const lines: string[] = [];
  
  if (opts.includeSafetyWarnings) {
    lines.push(`  // WARNING: Dropping table "${tableName}" will cause data loss`);
  }
  
  lines.push(`  await db.execute(sql\`DROP TABLE IF EXISTS "${tableName}"\`);`);
  
  return lines.join('\n');
}

/**
 * Generate Drizzle ALTER TABLE
 */
function generateDrizzleAlterTable(entityDiff: EntityDiff, opts: GeneratorOptions): string {
  const tableName = toSnakeCase(entityDiff.entity);
  const lines: string[] = [];
  
  if (opts.includeComments) {
    lines.push(`  // Modify table: ${entityDiff.entity}`);
  }
  
  for (const change of entityDiff.changes!) {
    const colName = toSnakeCase(change.field);
    
    switch (change.type) {
      case 'added':
        const sqlType = islTypeToSql(change.newType!, opts.dialect, opts.typeMapping);
        const nullable = change.nullable ? '' : ' NOT NULL';
        let defaultVal = '';
        if (change.defaultValue) {
          defaultVal = ` DEFAULT ${serializeDrizzleDefault(change.defaultValue)}`;
        }
        
        lines.push(`  await db.execute(sql\`ALTER TABLE "${tableName}" ADD COLUMN "${colName}" ${sqlType}${nullable}${defaultVal}\`);`);
        break;
      
      case 'removed':
        if (opts.includeSafetyWarnings) {
          lines.push(`  // WARNING: Dropping column "${colName}" will cause data loss`);
        }
        lines.push(`  await db.execute(sql\`ALTER TABLE "${tableName}" DROP COLUMN "${colName}"\`);`);
        break;
      
      case 'modified':
        lines.push(...generateDrizzleModifyColumn(tableName, change, opts));
        break;
    }
  }
  
  return lines.join('\n');
}

/**
 * Generate Drizzle column modification
 */
function generateDrizzleModifyColumn(
  tableName: string, 
  change: FieldChange, 
  opts: GeneratorOptions
): string[] {
  const lines: string[] = [];
  const colName = toSnakeCase(change.field);
  
  // Type change
  if (change.oldType && change.newType && change.oldType !== change.newType) {
    if (opts.includeSafetyWarnings) {
      lines.push(`  // WARNING: Type change from ${change.oldType} to ${change.newType}`);
    }
    
    const newSqlType = islTypeToSql(change.newType, opts.dialect, opts.typeMapping);
    
    if (opts.dialect === 'postgresql') {
      lines.push(`  await db.execute(sql\`ALTER TABLE "${tableName}" ALTER COLUMN "${colName}" TYPE ${newSqlType}\`);`);
    } else if (opts.dialect === 'mysql') {
      lines.push(`  await db.execute(sql\`ALTER TABLE "${tableName}" MODIFY COLUMN "${colName}" ${newSqlType}\`);`);
    }
  }
  
  // Nullable change
  if (change.oldNullable !== undefined && change.nullable !== undefined && change.oldNullable !== change.nullable) {
    if (!change.nullable && opts.includeSafetyWarnings) {
      lines.push(`  // WARNING: Making column non-nullable may fail if null values exist`);
    }
    
    if (opts.dialect === 'postgresql') {
      const action = change.nullable ? 'DROP NOT NULL' : 'SET NOT NULL';
      lines.push(`  await db.execute(sql\`ALTER TABLE "${tableName}" ALTER COLUMN "${colName}" ${action}\`);`);
    }
  }
  
  return lines;
}

/**
 * Generate Drizzle reverse ALTER
 */
function generateDrizzleReverseAlter(entityDiff: EntityDiff, opts: GeneratorOptions): string {
  const tableName = toSnakeCase(entityDiff.entity);
  const lines: string[] = [];
  
  for (const change of [...entityDiff.changes!].reverse()) {
    const colName = toSnakeCase(change.field);
    
    switch (change.type) {
      case 'added':
        lines.push(`  await db.execute(sql\`ALTER TABLE "${tableName}" DROP COLUMN "${colName}"\`);`);
        break;
      
      case 'removed':
        if (change.oldType) {
          const sqlType = islTypeToSql(change.oldType, opts.dialect, opts.typeMapping);
          lines.push(`  await db.execute(sql\`ALTER TABLE "${tableName}" ADD COLUMN "${colName}" ${sqlType}\`);`);
        }
        break;
      
      case 'modified':
        if (change.oldType && change.newType && change.oldType !== change.newType) {
          const oldSqlType = islTypeToSql(change.oldType, opts.dialect, opts.typeMapping);
          lines.push(`  await db.execute(sql\`ALTER TABLE "${tableName}" ALTER COLUMN "${colName}" TYPE ${oldSqlType}\`);`);
        }
        break;
    }
  }
  
  return lines.join('\n');
}

/**
 * Generate Drizzle CREATE ENUM
 */
function generateDrizzleCreateEnum(enumDiff: EnumDiff, opts: GeneratorOptions): string {
  if (opts.dialect !== 'postgresql') {
    return `  // Enums not directly supported in ${opts.dialect}`;
  }
  
  const enumName = toSnakeCase(enumDiff.enum);
  const varName = toCamelCase(enumDiff.enum);
  const variants = enumDiff.addedVariants!.map(v => `'${v}'`).join(', ');
  
  return [
    `  const ${varName}Enum = pgEnum('${enumName}', [${variants}]);`,
    `  await db.execute(sql\`CREATE TYPE "${enumName}" AS ENUM (${variants})\`);`,
  ].join('\n');
}

/**
 * Get Drizzle column type
 */
function getDrizzleColumnType(islType: string, dialect: SqlDialect): string {
  const typeMap: Record<SqlDialect, Record<string, string>> = {
    postgresql: {
      String: 'text',
      Int: 'integer',
      Float: 'doublePrecision',
      Boolean: 'boolean',
      DateTime: 'timestamp',
      Date: 'date',
      Time: 'time',
      UUID: 'uuid',
      JSON: 'jsonb',
      Decimal: 'decimal',
      BigInt: 'bigint',
      Bytes: 'bytea',
    },
    mysql: {
      String: 'varchar',
      Int: 'int',
      Float: 'double',
      Boolean: 'boolean',
      DateTime: 'datetime',
      Date: 'date',
      Time: 'time',
      UUID: 'char',
      JSON: 'json',
      Decimal: 'decimal',
      BigInt: 'bigint',
      Bytes: 'blob',
    },
    sqlite: {
      String: 'text',
      Int: 'integer',
      Float: 'real',
      Boolean: 'integer',
      DateTime: 'text',
      Date: 'text',
      Time: 'text',
      UUID: 'text',
      JSON: 'text',
      Decimal: 'real',
      BigInt: 'integer',
      Bytes: 'blob',
    },
    mssql: {
      String: 'nvarchar',
      Int: 'int',
      Float: 'float',
      Boolean: 'bit',
      DateTime: 'datetime2',
      Date: 'date',
      Time: 'time',
      UUID: 'uniqueidentifier',
      JSON: 'nvarchar',
      Decimal: 'decimal',
      BigInt: 'bigint',
      Bytes: 'varbinary',
    },
  };
  
  return typeMap[dialect][islType] || 'text';
}

/**
 * Get Drizzle column modifiers
 */
function getDrizzleColumnModifiers(change: FieldChange, opts: GeneratorOptions): string {
  const modifiers: string[] = [];
  
  // Primary key
  if (change.field.toLowerCase() === 'id') {
    modifiers.push('.primaryKey()');
  }
  
  // Not null
  if (!change.nullable) {
    modifiers.push('.notNull()');
  }
  
  // Default value
  if (change.defaultValue) {
    modifiers.push(`.default(${serializeDrizzleDefault(change.defaultValue)})`);
  }
  
  return modifiers.join('');
}

/**
 * Serialize default value for Drizzle
 */
function serializeDrizzleDefault(value: { kind: string; value?: unknown }): string {
  switch (value.kind) {
    case 'string':
      return `'${value.value}'`;
    case 'number':
      return String(value.value);
    case 'boolean':
      return String(value.value);
    case 'null':
      return 'null';
    default:
      return 'sql`DEFAULT`';
  }
}

/**
 * Get description for migration name
 */
function getDrizzleDiffDescription(diff: DomainDiff): string {
  const parts: string[] = [];
  
  for (const entity of diff.entities) {
    switch (entity.type) {
      case 'added':
        parts.push(`create_${toSnakeCase(entity.entity)}`);
        break;
      case 'removed':
        parts.push(`drop_${toSnakeCase(entity.entity)}`);
        break;
      case 'modified':
        parts.push(`alter_${toSnakeCase(entity.entity)}`);
        break;
    }
  }
  
  return parts.slice(0, 3).join('_') || 'migration';
}

/**
 * Get affected columns list
 */
function getAffectedColumns(diff: DomainDiff): string[] {
  const columns: string[] = [];
  
  for (const entity of diff.entities) {
    const tableName = toSnakeCase(entity.entity);
    if (entity.changes) {
      for (const change of entity.changes) {
        columns.push(`${tableName}.${toSnakeCase(change.field)}`);
      }
    }
  }
  
  return columns;
}

/**
 * Generate Drizzle schema file
 */
export function generateDrizzleSchema(
  diff: DomainDiff, 
  opts: Partial<GeneratorOptions> = {}
): string {
  const options = { ...defaultOptions, ...opts };
  const lines: string[] = [];
  
  // Imports
  lines.push(getDrizzleImports(diff, options));
  lines.push('');
  
  // Generate table schemas for added entities
  for (const entity of diff.entities) {
    if (entity.type === 'added' && entity.changes) {
      lines.push(generateDrizzleTableSchema(entity, options));
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

/**
 * Generate Drizzle table schema
 */
function generateDrizzleTableSchema(entityDiff: EntityDiff, opts: GeneratorOptions): string {
  const tableName = toSnakeCase(entityDiff.entity);
  const varName = toCamelCase(entityDiff.entity);
  const tableFunc = opts.dialect === 'postgresql' ? 'pgTable' 
    : opts.dialect === 'mysql' ? 'mysqlTable' 
    : 'sqliteTable';
  
  const lines: string[] = [];
  lines.push(`export const ${varName} = ${tableFunc}('${tableName}', {`);
  
  for (const change of entityDiff.changes!) {
    const colName = toSnakeCase(change.field);
    const drizzleType = getDrizzleColumnType(change.newType!, opts.dialect);
    const modifiers = getDrizzleColumnModifiers(change, opts);
    
    lines.push(`  ${toCamelCase(change.field)}: ${drizzleType}('${colName}')${modifiers},`);
  }
  
  lines.push('});');
  
  return lines.join('\n');
}
