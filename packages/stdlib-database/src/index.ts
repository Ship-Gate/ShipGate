/**
 * Database Standard Library for ISL
 * 
 * Database operations, queries, and transactions.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type DatabaseType = 'POSTGRESQL' | 'MYSQL' | 'SQLITE' | 'MONGODB' | 'REDIS';

export type IsolationLevel = 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';

export type TransactionStatus = 'ACTIVE' | 'COMMITTED' | 'ROLLED_BACK' | 'FAILED';

export interface Connection {
  id: string;
  type: DatabaseType;
  name: string;
  host: string;
  port: number;
  database: string;
  username?: string;
  poolMin: number;
  poolMax: number;
  idleTimeoutMs: number;
  connected: boolean;
  lastUsed?: Date;
  errorCount: number;
  createdAt: Date;
}

export interface QueryResult {
  id: string;
  query: string;
  params?: unknown[] | Record<string, unknown>;
  rows: Record<string, unknown>[];
  rowCount: number;
  affectedRows?: number;
  durationMs: number;
  executedAt: Date;
  connectionId: string;
}

export interface Transaction {
  id: string;
  connectionId: string;
  isolationLevel: IsolationLevel;
  status: TransactionStatus;
  startedAt: Date;
  completedAt?: Date;
  queries: string[];
}

export interface Table {
  name: string;
  schema?: string;
  columns: Column[];
  primaryKey: string[];
  indexes?: Index[];
  foreignKeys?: ForeignKey[];
}

export interface Column {
  name: string;
  type: ColumnType;
  nullable: boolean;
  default?: unknown;
  autoIncrement?: boolean;
  unique?: boolean;
}

export type ColumnType =
  | 'INTEGER' | 'BIGINT' | 'SMALLINT' | 'DECIMAL' | 'FLOAT' | 'DOUBLE'
  | 'VARCHAR' | 'TEXT' | 'CHAR'
  | 'BOOLEAN'
  | 'DATE' | 'TIME' | 'TIMESTAMP' | 'TIMESTAMPTZ'
  | 'UUID' | 'JSON' | 'JSONB' | 'BYTEA' | 'ARRAY';

export interface Index {
  name: string;
  columns: string[];
  unique: boolean;
  type?: 'BTREE' | 'HASH' | 'GIN' | 'GIST';
}

export interface ForeignKey {
  columns: string[];
  referencesTable: string;
  referencesColumns: string[];
  onDelete?: ForeignKeyAction;
  onUpdate?: ForeignKeyAction;
}

export type ForeignKeyAction = 'CASCADE' | 'SET_NULL' | 'SET_DEFAULT' | 'RESTRICT' | 'NO_ACTION';

// ─────────────────────────────────────────────────────────────────────────────
// Query Builder
// ─────────────────────────────────────────────────────────────────────────────

export type WhereClause = Record<string, unknown | WhereOperator>;

export interface WhereOperator {
  $eq?: unknown;
  $ne?: unknown;
  $gt?: unknown;
  $gte?: unknown;
  $lt?: unknown;
  $lte?: unknown;
  $in?: unknown[];
  $nin?: unknown[];
  $like?: string;
  $ilike?: string;
  $between?: [unknown, unknown];
  $isNull?: boolean;
}

export interface OrderBy {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * SQL Query Builder
 */
export class QueryBuilder {
  private _table: string = '';
  private _select: string[] = ['*'];
  private _where: Array<{ clause: string; params: unknown[] }> = [];
  private _orderBy: OrderBy[] = [];
  private _limit?: number;
  private _offset?: number;
  private _params: unknown[] = [];
  private _paramIndex = 1;

  /**
   * Select from table
   */
  from(table: string): this {
    this._table = table;
    return this;
  }

  /**
   * Select columns
   */
  select(...columns: string[]): this {
    this._select = columns.length > 0 ? columns : ['*'];
    return this;
  }

  /**
   * Add where clause
   */
  where(conditions: WhereClause): this {
    for (const [field, value] of Object.entries(conditions)) {
      if (this.isOperator(value)) {
        this.addOperatorClause(field, value);
      } else {
        this._where.push({
          clause: `"${field}" = $${this._paramIndex++}`,
          params: [value],
        });
      }
    }
    return this;
  }

  /**
   * Add OR where clause
   */
  orWhere(conditions: WhereClause): this {
    // For simplicity, just add as AND - full implementation would handle OR
    return this.where(conditions);
  }

  /**
   * Order by
   */
  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): this {
    this._orderBy.push({ field, direction });
    return this;
  }

  /**
   * Limit results
   */
  limit(n: number): this {
    this._limit = n;
    return this;
  }

  /**
   * Offset results
   */
  offset(n: number): this {
    this._offset = n;
    return this;
  }

  /**
   * Build SELECT query
   */
  buildSelect(): { sql: string; params: unknown[] } {
    const parts: string[] = ['SELECT'];
    const params: unknown[] = [];

    parts.push(this._select.map(c => c === '*' ? '*' : `"${c}"`).join(', '));
    parts.push(`FROM "${this._table}"`);

    if (this._where.length > 0) {
      parts.push('WHERE');
      const whereClauses: string[] = [];
      for (const w of this._where) {
        whereClauses.push(w.clause);
        params.push(...w.params);
      }
      parts.push(whereClauses.join(' AND '));
    }

    if (this._orderBy.length > 0) {
      parts.push('ORDER BY');
      parts.push(this._orderBy.map(o => `"${o.field}" ${o.direction.toUpperCase()}`).join(', '));
    }

    if (this._limit !== undefined) {
      parts.push(`LIMIT ${this._limit}`);
    }

    if (this._offset !== undefined) {
      parts.push(`OFFSET ${this._offset}`);
    }

    return { sql: parts.join(' '), params };
  }

  /**
   * Build INSERT query
   */
  buildInsert(data: Record<string, unknown>[]): { sql: string; params: unknown[] } {
    if (data.length === 0) {
      throw new Error('No data to insert');
    }

    const columns = Object.keys(data[0]);
    const params: unknown[] = [];
    const valuePlaceholders: string[] = [];

    let paramIndex = 1;
    for (const row of data) {
      const rowPlaceholders: string[] = [];
      for (const col of columns) {
        rowPlaceholders.push(`$${paramIndex++}`);
        params.push(row[col]);
      }
      valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
    }

    const sql = [
      `INSERT INTO "${this._table}"`,
      `(${columns.map(c => `"${c}"`).join(', ')})`,
      'VALUES',
      valuePlaceholders.join(', '),
      'RETURNING *',
    ].join(' ');

    return { sql, params };
  }

  /**
   * Build UPDATE query
   */
  buildUpdate(data: Record<string, unknown>): { sql: string; params: unknown[] } {
    const params: unknown[] = [];
    const setClauses: string[] = [];

    let paramIndex = 1;
    for (const [col, value] of Object.entries(data)) {
      setClauses.push(`"${col}" = $${paramIndex++}`);
      params.push(value);
    }

    const parts: string[] = [
      `UPDATE "${this._table}"`,
      `SET ${setClauses.join(', ')}`,
    ];

    if (this._where.length > 0) {
      parts.push('WHERE');
      const whereClauses: string[] = [];
      for (const w of this._where) {
        // Adjust parameter indices
        const adjustedClause = w.clause.replace(/\$(\d+)/g, () => `$${paramIndex++}`);
        whereClauses.push(adjustedClause);
        params.push(...w.params);
      }
      parts.push(whereClauses.join(' AND '));
    }

    parts.push('RETURNING *');

    return { sql: parts.join(' '), params };
  }

  /**
   * Build DELETE query
   */
  buildDelete(): { sql: string; params: unknown[] } {
    const parts: string[] = [`DELETE FROM "${this._table}"`];
    const params: unknown[] = [];

    if (this._where.length > 0) {
      parts.push('WHERE');
      const whereClauses: string[] = [];
      for (const w of this._where) {
        whereClauses.push(w.clause);
        params.push(...w.params);
      }
      parts.push(whereClauses.join(' AND '));
    }

    parts.push('RETURNING *');

    return { sql: parts.join(' '), params };
  }

  /**
   * Build COUNT query
   */
  buildCount(): { sql: string; params: unknown[] } {
    const parts: string[] = [`SELECT COUNT(*) as count FROM "${this._table}"`];
    const params: unknown[] = [];

    if (this._where.length > 0) {
      parts.push('WHERE');
      const whereClauses: string[] = [];
      for (const w of this._where) {
        whereClauses.push(w.clause);
        params.push(...w.params);
      }
      parts.push(whereClauses.join(' AND '));
    }

    return { sql: parts.join(' '), params };
  }

  private isOperator(value: unknown): value is WhereOperator {
    if (typeof value !== 'object' || value === null) return false;
    const keys = Object.keys(value);
    return keys.some(k => k.startsWith('$'));
  }

  private addOperatorClause(field: string, op: WhereOperator): void {
    if (op.$eq !== undefined) {
      this._where.push({
        clause: `"${field}" = $${this._paramIndex++}`,
        params: [op.$eq],
      });
    }
    if (op.$ne !== undefined) {
      this._where.push({
        clause: `"${field}" != $${this._paramIndex++}`,
        params: [op.$ne],
      });
    }
    if (op.$gt !== undefined) {
      this._where.push({
        clause: `"${field}" > $${this._paramIndex++}`,
        params: [op.$gt],
      });
    }
    if (op.$gte !== undefined) {
      this._where.push({
        clause: `"${field}" >= $${this._paramIndex++}`,
        params: [op.$gte],
      });
    }
    if (op.$lt !== undefined) {
      this._where.push({
        clause: `"${field}" < $${this._paramIndex++}`,
        params: [op.$lt],
      });
    }
    if (op.$lte !== undefined) {
      this._where.push({
        clause: `"${field}" <= $${this._paramIndex++}`,
        params: [op.$lte],
      });
    }
    if (op.$in !== undefined) {
      const placeholders = op.$in.map(() => `$${this._paramIndex++}`).join(', ');
      this._where.push({
        clause: `"${field}" IN (${placeholders})`,
        params: op.$in,
      });
    }
    if (op.$nin !== undefined) {
      const placeholders = op.$nin.map(() => `$${this._paramIndex++}`).join(', ');
      this._where.push({
        clause: `"${field}" NOT IN (${placeholders})`,
        params: op.$nin,
      });
    }
    if (op.$like !== undefined) {
      this._where.push({
        clause: `"${field}" LIKE $${this._paramIndex++}`,
        params: [op.$like],
      });
    }
    if (op.$ilike !== undefined) {
      this._where.push({
        clause: `"${field}" ILIKE $${this._paramIndex++}`,
        params: [op.$ilike],
      });
    }
    if (op.$between !== undefined) {
      this._where.push({
        clause: `"${field}" BETWEEN $${this._paramIndex++} AND $${this._paramIndex++}`,
        params: op.$between,
      });
    }
    if (op.$isNull !== undefined) {
      this._where.push({
        clause: op.$isNull ? `"${field}" IS NULL` : `"${field}" IS NOT NULL`,
        params: [],
      });
    }
  }
}

/**
 * Create a query builder
 */
export function query(table: string): QueryBuilder {
  return new QueryBuilder().from(table);
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build CREATE TABLE SQL
 */
export function buildCreateTable(table: Table): string {
  const lines: string[] = [];
  
  // Columns
  for (const col of table.columns) {
    let line = `  "${col.name}" ${mapColumnType(col.type)}`;
    if (!col.nullable) line += ' NOT NULL';
    if (col.default !== undefined) line += ` DEFAULT ${formatDefault(col.default)}`;
    if (col.autoIncrement) line += ' GENERATED ALWAYS AS IDENTITY';
    if (col.unique) line += ' UNIQUE';
    lines.push(line);
  }
  
  // Primary key
  lines.push(`  PRIMARY KEY (${table.primaryKey.map(k => `"${k}"`).join(', ')})`);
  
  // Foreign keys
  if (table.foreignKeys) {
    for (const fk of table.foreignKeys) {
      let line = `  FOREIGN KEY (${fk.columns.map(c => `"${c}"`).join(', ')})`;
      line += ` REFERENCES "${fk.referencesTable}" (${fk.referencesColumns.map(c => `"${c}"`).join(', ')})`;
      if (fk.onDelete) line += ` ON DELETE ${fk.onDelete.replace('_', ' ')}`;
      if (fk.onUpdate) line += ` ON UPDATE ${fk.onUpdate.replace('_', ' ')}`;
      lines.push(line);
    }
  }
  
  const schema = table.schema ? `"${table.schema}".` : '';
  return `CREATE TABLE ${schema}"${table.name}" (\n${lines.join(',\n')}\n)`;
}

/**
 * Build CREATE INDEX SQL
 */
export function buildCreateIndex(table: string, index: Index): string {
  const unique = index.unique ? 'UNIQUE ' : '';
  const using = index.type ? ` USING ${index.type}` : '';
  const columns = index.columns.map(c => `"${c}"`).join(', ');
  return `CREATE ${unique}INDEX "${index.name}" ON "${table}"${using} (${columns})`;
}

function mapColumnType(type: ColumnType): string {
  const mapping: Record<ColumnType, string> = {
    INTEGER: 'INTEGER',
    BIGINT: 'BIGINT',
    SMALLINT: 'SMALLINT',
    DECIMAL: 'DECIMAL',
    FLOAT: 'REAL',
    DOUBLE: 'DOUBLE PRECISION',
    VARCHAR: 'VARCHAR(255)',
    TEXT: 'TEXT',
    CHAR: 'CHAR(1)',
    BOOLEAN: 'BOOLEAN',
    DATE: 'DATE',
    TIME: 'TIME',
    TIMESTAMP: 'TIMESTAMP',
    TIMESTAMPTZ: 'TIMESTAMPTZ',
    UUID: 'UUID',
    JSON: 'JSON',
    JSONB: 'JSONB',
    BYTEA: 'BYTEA',
    ARRAY: 'TEXT[]',
  };
  return mapping[type] ?? 'TEXT';
}

function formatDefault(value: unknown): string {
  if (value === null) return 'NULL';
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escape identifier
 */
export function escapeIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Escape string value
 */
export function escapeString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Generate UUID
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
