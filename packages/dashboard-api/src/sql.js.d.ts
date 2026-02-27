declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }

  export interface ParamsObject {
    [key: string]: unknown;
  }

  export interface Statement {
    bind(params?: ParamsObject | unknown[]): boolean;
    step(): boolean;
    getAsObject(params?: ParamsObject | unknown[]): Record<string, unknown>;
    get(params?: ParamsObject | unknown[]): unknown[];
    free(): boolean;
    reset(): void;
    run(params?: ParamsObject | unknown[]): void;
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null);
    run(sql: string, params?: ParamsObject | unknown[]): Database;
    exec(sql: string, params?: ParamsObject | unknown[]): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export default function initSqlJs(config?: {
    locateFile?: (filename: string) => string;
  }): Promise<SqlJsStatic>;
}
