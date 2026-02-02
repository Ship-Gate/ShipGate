// ============================================================================
// ISL Standard Library - CSV Audit Exporter
// @stdlib/audit/exporters/csv
// ============================================================================

import {
  ExportFormat,
  CompressionType,
  type AuditExporter,
  type AuditEvent,
  type ExportOptions,
  type ExportOutput,
} from '../types';
import { maskPii, redactPii } from '../utils/pii';

// ============================================================================
// CSV EXPORTER OPTIONS
// ============================================================================

export interface CsvExporterOptions {
  delimiter?: string;
  quoteChar?: string;
  escapeChar?: string;
  newline?: string;
  includeHeaders?: boolean;
  
  // Column configuration
  columns?: CsvColumn[];
  flattenNested?: boolean;
  dateFormat?: 'iso' | 'unix' | 'readable';
}

export interface CsvColumn {
  field: string;
  header?: string;
  transform?: (value: unknown, event: AuditEvent) => string;
}

// ============================================================================
// DEFAULT COLUMNS
// ============================================================================

const DEFAULT_COLUMNS: CsvColumn[] = [
  { field: 'id', header: 'Event ID' },
  { field: 'timestamp', header: 'Timestamp' },
  { field: 'action', header: 'Action' },
  { field: 'category', header: 'Category' },
  { field: 'outcome', header: 'Outcome' },
  { field: 'description', header: 'Description' },
  
  // Actor fields
  { field: 'actor.id', header: 'Actor ID' },
  { field: 'actor.type', header: 'Actor Type' },
  { field: 'actor.name', header: 'Actor Name' },
  { field: 'actor.email', header: 'Actor Email' },
  { field: 'actor.ip_address', header: 'IP Address' },
  
  // Resource fields
  { field: 'resource.type', header: 'Resource Type' },
  { field: 'resource.id', header: 'Resource ID' },
  { field: 'resource.name', header: 'Resource Name' },
  
  // Source fields
  { field: 'source.service', header: 'Service' },
  { field: 'source.environment', header: 'Environment' },
  { field: 'source.request_id', header: 'Request ID' },
  
  // Timing
  { field: 'duration_ms', header: 'Duration (ms)' },
  
  // Error
  { field: 'error_code', header: 'Error Code' },
  { field: 'error_message', header: 'Error Message' },
  
  // Tags
  { field: 'tags', header: 'Tags', transform: (v) => Array.isArray(v) ? v.join(';') : '' },
];

// ============================================================================
// CSV EXPORTER
// ============================================================================

export class CsvExporter implements AuditExporter {
  readonly format = ExportFormat.CSV;
  readonly supportedCompression: CompressionType[] = [
    CompressionType.NONE,
    CompressionType.GZIP,
  ];

  private options: Required<Omit<CsvExporterOptions, 'columns'>> & { columns: CsvColumn[] };

  constructor(options: CsvExporterOptions = {}) {
    this.options = {
      delimiter: options.delimiter ?? ',',
      quoteChar: options.quoteChar ?? '"',
      escapeChar: options.escapeChar ?? '"',
      newline: options.newline ?? '\n',
      includeHeaders: options.includeHeaders ?? true,
      columns: options.columns ?? DEFAULT_COLUMNS,
      flattenNested: options.flattenNested ?? true,
      dateFormat: options.dateFormat ?? 'iso',
    };
  }

  async export(
    events: AsyncIterable<AuditEvent>,
    options: ExportOptions
  ): Promise<ExportOutput> {
    const chunks: string[] = [];
    let size = 0;

    // Filter columns based on PII settings
    const columns = this.filterColumns(options);

    // Add headers
    if (this.options.includeHeaders) {
      const headerRow = this.formatRow(
        columns.map(c => c.header ?? c.field)
      );
      chunks.push(headerRow);
      size += Buffer.byteLength(headerRow, 'utf-8');
    }

    // Process events
    for await (const event of events) {
      const processedEvent = this.processEvent(event, options);
      const values = columns.map(col => this.getFieldValue(processedEvent, col));
      const row = this.formatRow(values);
      chunks.push(row);
      size += Buffer.byteLength(row, 'utf-8');
    }

    const content = chunks.join('');
    const buffer = Buffer.from(content, 'utf-8');

    // Compress if needed
    const compressedBuffer = await this.compress(buffer, options.compression);

    return {
      data: compressedBuffer,
      size_bytes: compressedBuffer.length,
      content_type: 'text/csv',
    };
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private filterColumns(options: ExportOptions): CsvColumn[] {
    const piiFields = ['actor.email', 'actor.ip_address'];
    
    if (!options.include_pii && !options.mask_pii) {
      return this.options.columns.filter(c => !piiFields.includes(c.field));
    }
    
    return this.options.columns;
  }

  private processEvent(event: AuditEvent, options: ExportOptions): AuditEvent {
    if (!options.include_pii && options.mask_pii) {
      return maskPii(event);
    }
    if (!options.include_pii) {
      return redactPii(event);
    }
    return event;
  }

  private getFieldValue(event: AuditEvent, column: CsvColumn): string {
    const value = this.getNestedValue(event, column.field);
    
    if (column.transform) {
      return column.transform(value, event);
    }

    return this.formatValue(value);
  }

  private getNestedValue(obj: any, path: string): unknown {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }

    return current;
  }

  private formatValue(value: unknown): string {
    if (value == null) return '';
    
    if (value instanceof Date) {
      switch (this.options.dateFormat) {
        case 'unix':
          return String(value.getTime());
        case 'readable':
          return value.toLocaleString();
        default:
          return value.toISOString();
      }
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  private formatRow(values: string[]): string {
    const { delimiter, quoteChar, escapeChar, newline } = this.options;

    const formatted = values.map(value => {
      // Escape special characters
      const needsQuoting = value.includes(delimiter) || 
                          value.includes(quoteChar) || 
                          value.includes('\n') ||
                          value.includes('\r');

      if (needsQuoting) {
        const escaped = value.replace(
          new RegExp(escapeChar, 'g'),
          escapeChar + escapeChar
        );
        return `${quoteChar}${escaped}${quoteChar}`;
      }

      return value;
    });

    return formatted.join(delimiter) + newline;
  }

  private async compress(buffer: Buffer, compression: CompressionType): Promise<Buffer> {
    if (compression === CompressionType.GZIP) {
      // In production, use zlib.gzipSync
      // const zlib = require('zlib');
      // return zlib.gzipSync(buffer);
    }
    return buffer;
  }
}

// ============================================================================
// STREAMING CSV WRITER
// ============================================================================

export class StreamingCsvWriter {
  private options: CsvExporterOptions;
  private columns: CsvColumn[];
  private headerWritten = false;

  constructor(options: CsvExporterOptions = {}) {
    this.options = {
      delimiter: options.delimiter ?? ',',
      quoteChar: options.quoteChar ?? '"',
      escapeChar: options.escapeChar ?? '"',
      newline: options.newline ?? '\n',
      includeHeaders: options.includeHeaders ?? true,
      columns: options.columns ?? DEFAULT_COLUMNS,
    };
    this.columns = this.options.columns ?? DEFAULT_COLUMNS;
  }

  writeHeader(): string {
    if (this.headerWritten || !this.options.includeHeaders) {
      return '';
    }
    this.headerWritten = true;
    return this.formatRow(this.columns.map(c => c.header ?? c.field));
  }

  writeRow(event: AuditEvent): string {
    const values = this.columns.map(col => {
      const value = this.getNestedValue(event, col.field);
      if (col.transform) {
        return col.transform(value, event);
      }
      return this.formatValue(value);
    });
    return this.formatRow(values);
  }

  private getNestedValue(obj: any, path: string): unknown {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  }

  private formatValue(value: unknown): string {
    if (value == null) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private formatRow(values: string[]): string {
    const { delimiter, quoteChar, escapeChar, newline } = this.options;
    const formatted = values.map(value => {
      const needsQuoting = value.includes(delimiter!) || 
                          value.includes(quoteChar!) || 
                          value.includes('\n');
      if (needsQuoting) {
        const escaped = value.replace(new RegExp(escapeChar!, 'g'), escapeChar! + escapeChar!);
        return `${quoteChar}${escaped}${quoteChar}`;
      }
      return value;
    });
    return formatted.join(delimiter) + newline;
  }
}
