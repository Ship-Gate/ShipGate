// ============================================================================
// ISL Standard Library - JSON Audit Exporters
// @stdlib/audit/exporters/json
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
// JSON EXPORTER OPTIONS
// ============================================================================

export interface JsonExporterOptions {
  pretty?: boolean;
  indent?: number;
  dateFormat?: 'iso' | 'unix';
  
  // Field selection
  fields?: string[];
  excludeFields?: string[];
}

// ============================================================================
// JSON EXPORTER (Array format)
// ============================================================================

export class JsonExporter implements AuditExporter {
  readonly format = ExportFormat.JSON;
  readonly supportedCompression: CompressionType[] = [
    CompressionType.NONE,
    CompressionType.GZIP,
    CompressionType.ZSTD,
  ];

  private options: JsonExporterOptions;

  constructor(options: JsonExporterOptions = {}) {
    this.options = options;
  }

  async export(
    events: AsyncIterable<AuditEvent>,
    options: ExportOptions
  ): Promise<ExportOutput> {
    const allEvents: unknown[] = [];

    for await (const event of events) {
      const processed = this.processEvent(event, options);
      const filtered = this.filterFields(processed);
      const formatted = this.formatDates(filtered);
      allEvents.push(formatted);
    }

    const content = this.options.pretty
      ? JSON.stringify(allEvents, null, this.options.indent ?? 2)
      : JSON.stringify(allEvents);

    const buffer = Buffer.from(content, 'utf-8');
    const compressed = await this.compress(buffer, options.compression);

    return {
      data: compressed,
      size_bytes: compressed.length,
      content_type: 'application/json',
    };
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

  private filterFields(event: AuditEvent): Record<string, unknown> {
    const obj = event as unknown as Record<string, unknown>;

    if (this.options.fields && this.options.fields.length > 0) {
      const filtered: Record<string, unknown> = {};
      for (const field of this.options.fields) {
        if (field in obj) {
          filtered[field] = obj[field];
        }
      }
      return filtered;
    }

    if (this.options.excludeFields && this.options.excludeFields.length > 0) {
      const filtered: Record<string, unknown> = { ...obj };
      for (const field of this.options.excludeFields) {
        delete filtered[field];
      }
      return filtered;
    }

    return obj;
  }

  private formatDates(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value instanceof Date) {
        result[key] = this.options.dateFormat === 'unix'
          ? value.getTime()
          : value.toISOString();
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.formatDates(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private async compress(buffer: Buffer, _compression: CompressionType): Promise<Buffer> {
    // In production, implement actual compression
    return buffer;
  }
}

// ============================================================================
// NDJSON EXPORTER (Newline-delimited JSON)
// ============================================================================

export class NdjsonExporter implements AuditExporter {
  readonly format = ExportFormat.NDJSON;
  readonly supportedCompression: CompressionType[] = [
    CompressionType.NONE,
    CompressionType.GZIP,
    CompressionType.ZSTD,
  ];

  private options: JsonExporterOptions;

  constructor(options: JsonExporterOptions = {}) {
    this.options = options;
  }

  async export(
    events: AsyncIterable<AuditEvent>,
    options: ExportOptions
  ): Promise<ExportOutput> {
    const lines: string[] = [];
    let totalSize = 0;

    for await (const event of events) {
      const processed = this.processEvent(event, options);
      const filtered = this.filterFields(processed);
      const formatted = this.formatDates(filtered);
      const line = JSON.stringify(formatted) + '\n';
      lines.push(line);
      totalSize += Buffer.byteLength(line, 'utf-8');
    }

    const content = lines.join('');
    const buffer = Buffer.from(content, 'utf-8');
    const compressed = await this.compress(buffer, options.compression);

    return {
      data: compressed,
      size_bytes: compressed.length,
      content_type: 'application/x-ndjson',
    };
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

  private filterFields(event: AuditEvent): Record<string, unknown> {
    const obj = event as unknown as Record<string, unknown>;

    if (this.options.fields && this.options.fields.length > 0) {
      const filtered: Record<string, unknown> = {};
      for (const field of this.options.fields) {
        if (field in obj) {
          filtered[field] = obj[field];
        }
      }
      return filtered;
    }

    if (this.options.excludeFields && this.options.excludeFields.length > 0) {
      const filtered: Record<string, unknown> = { ...obj };
      for (const field of this.options.excludeFields) {
        delete filtered[field];
      }
      return filtered;
    }

    return obj;
  }

  private formatDates(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value instanceof Date) {
        result[key] = this.options.dateFormat === 'unix'
          ? value.getTime()
          : value.toISOString();
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.formatDates(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private async compress(buffer: Buffer, _compression: CompressionType): Promise<Buffer> {
    // In production, implement actual compression
    return buffer;
  }
}

// ============================================================================
// STREAMING JSON WRITER
// ============================================================================

export class StreamingJsonWriter {
  private first = true;
  private options: JsonExporterOptions;

  constructor(options: JsonExporterOptions = {}) {
    this.options = options;
  }

  writeStart(): string {
    return '[\n';
  }

  writeEvent(event: AuditEvent): string {
    const prefix = this.first ? '' : ',\n';
    this.first = false;

    const formatted = this.formatDates(event as unknown as Record<string, unknown>);
    const json = this.options.pretty
      ? JSON.stringify(formatted, null, this.options.indent ?? 2)
      : JSON.stringify(formatted);

    return prefix + json;
  }

  writeEnd(): string {
    return '\n]\n';
  }

  private formatDates(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value instanceof Date) {
        result[key] = this.options.dateFormat === 'unix'
          ? value.getTime()
          : value.toISOString();
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.formatDates(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}

// ============================================================================
// STREAMING NDJSON WRITER
// ============================================================================

export class StreamingNdjsonWriter {
  private options: JsonExporterOptions;

  constructor(options: JsonExporterOptions = {}) {
    this.options = options;
  }

  writeEvent(event: AuditEvent): string {
    const formatted = this.formatDates(event as unknown as Record<string, unknown>);
    return JSON.stringify(formatted) + '\n';
  }

  private formatDates(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value instanceof Date) {
        result[key] = this.options.dateFormat === 'unix'
          ? value.getTime()
          : value.toISOString();
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.formatDates(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}
