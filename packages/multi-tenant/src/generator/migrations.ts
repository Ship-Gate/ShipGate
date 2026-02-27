/**
 * Tenant Migration Generator
 * 
 * Generates database migrations for multi-tenant schemas.
 */

import type { IsolationStrategy } from '../tenant.js';

// ============================================================================
// Types
// ============================================================================

export interface MigrationConfig {
  isolation: IsolationStrategy;
  tenantIdColumn: string;
  tenantTable: string;
  targetTables: string[];
}

export interface Migration {
  version: string;
  name: string;
  timestamp: Date;
  up: string;
  down: string;
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  indexes: IndexSchema[];
  foreignKeys: ForeignKeySchema[];
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
}

export interface IndexSchema {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface ForeignKeySchema {
  name: string;
  column: string;
  references: { table: string; column: string };
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
}

// ============================================================================
// Migration Generator
// ============================================================================

export class MigrationGenerator {
  private config: MigrationConfig;

  constructor(config: MigrationConfig) {
    this.config = config;
  }

  /**
   * Generate migration to add tenant support to existing tables
   */
  generateAddTenantSupport(): Migration {
    const { tenantIdColumn, tenantTable, targetTables, isolation } = this.config;
    const version = generateVersion();

    const upStatements: string[] = [];
    const downStatements: string[] = [];

    // Create tenant table if not exists
    upStatements.push(this.generateTenantTable());
    downStatements.unshift(`DROP TABLE IF EXISTS ${tenantTable} CASCADE;`);

    // Add tenant_id to each target table
    for (const table of targetTables) {
      upStatements.push(`
-- Add tenant_id to ${table}
ALTER TABLE ${table} 
ADD COLUMN IF NOT EXISTS ${tenantIdColumn} UUID 
REFERENCES ${tenantTable}(id) ON DELETE CASCADE;

-- Create index for tenant filtering
CREATE INDEX IF NOT EXISTS idx_${table}_${tenantIdColumn} 
ON ${table}(${tenantIdColumn});`);

      downStatements.unshift(`
-- Remove tenant_id from ${table}
DROP INDEX IF EXISTS idx_${table}_${tenantIdColumn};
ALTER TABLE ${table} DROP COLUMN IF EXISTS ${tenantIdColumn};`);
    }

    // Add RLS policies for row-level isolation
    if (isolation === 'row_level') {
      for (const table of targetTables) {
        upStatements.push(this.generateRLSPolicy(table));
        downStatements.unshift(`
DROP POLICY IF EXISTS tenant_isolation_${table} ON ${table};
ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;`);
      }
    }

    return {
      version,
      name: 'add_tenant_support',
      timestamp: new Date(),
      up: upStatements.join('\n'),
      down: downStatements.join('\n'),
    };
  }

  /**
   * Generate tenant table creation SQL
   */
  private generateTenantTable(): string {
    const { tenantTable } = this.config;

    return `
-- Create tenant table
CREATE TABLE IF NOT EXISTS ${tenantTable} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(63) NOT NULL UNIQUE,
  plan VARCHAR(20) NOT NULL DEFAULT 'FREE',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  limits JSONB NOT NULL DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_plan CHECK (plan IN ('FREE', 'STARTER', 'PRO', 'ENTERPRISE')),
  CONSTRAINT valid_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETED', 'PENDING')),
  CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_${tenantTable}_slug ON ${tenantTable}(slug);
CREATE INDEX IF NOT EXISTS idx_${tenantTable}_status ON ${tenantTable}(status);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_${tenantTable}_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ${tenantTable}_updated_at ON ${tenantTable};
CREATE TRIGGER ${tenantTable}_updated_at
  BEFORE UPDATE ON ${tenantTable}
  FOR EACH ROW
  EXECUTE FUNCTION update_${tenantTable}_updated_at();`;
  }

  /**
   * Generate RLS policy for a table
   */
  private generateRLSPolicy(table: string): string {
    const { tenantIdColumn } = this.config;

    return `
-- Enable RLS on ${table}
ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policy
CREATE POLICY tenant_isolation_${table} ON ${table}
  USING (${tenantIdColumn} = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (${tenantIdColumn} = current_setting('app.current_tenant_id')::uuid);`;
  }

  /**
   * Generate migration to make existing unique constraints tenant-scoped
   */
  generateScopedUniques(tableUniques: Record<string, string[]>): Migration {
    const { tenantIdColumn } = this.config;
    const version = generateVersion();

    const upStatements: string[] = [];
    const downStatements: string[] = [];

    for (const [table, uniqueColumns] of Object.entries(tableUniques)) {
      for (const column of uniqueColumns) {
        const oldConstraint = `${table}_${column}_key`;
        const newConstraint = `${table}_${column}_tenant_unique`;

        upStatements.push(`
-- Make ${table}.${column} unique per tenant
ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${oldConstraint};
CREATE UNIQUE INDEX IF NOT EXISTS ${newConstraint} 
ON ${table}(${tenantIdColumn}, ${column});`);

        downStatements.unshift(`
-- Restore global unique constraint on ${table}.${column}
DROP INDEX IF EXISTS ${newConstraint};
ALTER TABLE ${table} ADD CONSTRAINT ${oldConstraint} UNIQUE (${column});`);
      }
    }

    return {
      version,
      name: 'scope_uniques_to_tenant',
      timestamp: new Date(),
      up: upStatements.join('\n'),
      down: downStatements.join('\n'),
    };
  }

  /**
   * Generate migration for schema-per-tenant
   */
  generateTenantSchema(tenantSlug: string, tables: TableSchema[]): Migration {
    const schemaName = `tenant_${tenantSlug.replace(/-/g, '_')}`;
    const version = generateVersion();

    const upStatements: string[] = [];
    const downStatements: string[] = [];

    // Create schema
    upStatements.push(`CREATE SCHEMA IF NOT EXISTS ${schemaName};`);
    downStatements.push(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE;`);

    // Create tables in schema
    for (const table of tables) {
      upStatements.push(this.generateTableSQL(schemaName, table));
    }

    return {
      version,
      name: `create_tenant_schema_${tenantSlug}`,
      timestamp: new Date(),
      up: upStatements.join('\n\n'),
      down: downStatements.join('\n'),
    };
  }

  /**
   * Generate CREATE TABLE SQL
   */
  private generateTableSQL(schema: string, table: TableSchema): string {
    const lines: string[] = [];

    lines.push(`CREATE TABLE ${schema}.${table.name} (`);

    // Columns
    const columnDefs = table.columns.map(col => {
      let def = `  ${col.name} ${col.type}`;
      if (!col.nullable) def += ' NOT NULL';
      if (col.default) def += ` DEFAULT ${col.default}`;
      return def;
    });
    lines.push(columnDefs.join(',\n'));

    lines.push(');');

    // Indexes
    for (const index of table.indexes) {
      const unique = index.unique ? 'UNIQUE ' : '';
      lines.push(`CREATE ${unique}INDEX ${index.name} ON ${schema}.${table.name}(${index.columns.join(', ')});`);
    }

    // Foreign keys
    for (const fk of table.foreignKeys) {
      const onDelete = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
      lines.push(`ALTER TABLE ${schema}.${table.name} ADD CONSTRAINT ${fk.name} FOREIGN KEY (${fk.column}) REFERENCES ${fk.references.table}(${fk.references.column})${onDelete};`);
    }

    return lines.join('\n');
  }

  /**
   * Generate data migration for existing records
   */
  generateBackfillTenantId(
    table: string,
    defaultTenantId: string
  ): Migration {
    const { tenantIdColumn } = this.config;
    const version = generateVersion();

    return {
      version,
      name: `backfill_${table}_tenant_id`,
      timestamp: new Date(),
      up: `
-- Backfill tenant_id for existing ${table} records
UPDATE ${table} 
SET ${tenantIdColumn} = '${defaultTenantId}'
WHERE ${tenantIdColumn} IS NULL;

-- Make tenant_id NOT NULL
ALTER TABLE ${table} ALTER COLUMN ${tenantIdColumn} SET NOT NULL;`,
      down: `
-- Allow NULL tenant_id
ALTER TABLE ${table} ALTER COLUMN ${tenantIdColumn} DROP NOT NULL;`,
    };
  }
}

// ============================================================================
// Utilities
// ============================================================================

function generateVersion(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
}

/**
 * Format migration as file content
 */
export function formatMigration(migration: Migration): string {
  return `-- Migration: ${migration.name}
-- Version: ${migration.version}
-- Created: ${migration.timestamp.toISOString()}

-- UP
${migration.up}

-- DOWN (for rollback)
-- ${migration.down.split('\n').join('\n-- ')}
`;
}

/**
 * Generate migration filename
 */
export function getMigrationFilename(migration: Migration): string {
  return `${migration.version}_${migration.name}.sql`;
}
