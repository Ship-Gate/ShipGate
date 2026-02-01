// ============================================================================
// ISL Standard Library - S3 Audit Archive
// @stdlib/audit/storage/s3
// ============================================================================

import type {
  AuditEvent,
  AuditFilters,
  ExportFormat,
  CompressionType,
} from '../types';

// ============================================================================
// S3 CLIENT INTERFACE
// ============================================================================

export interface S3Client {
  putObject(params: {
    Bucket: string;
    Key: string;
    Body: Buffer | string | ReadableStream;
    ContentType?: string;
    ContentEncoding?: string;
    Metadata?: Record<string, string>;
  }): Promise<{ ETag?: string }>;
  
  getObject(params: {
    Bucket: string;
    Key: string;
  }): Promise<{ Body: ReadableStream; ContentLength?: number }>;
  
  listObjectsV2(params: {
    Bucket: string;
    Prefix?: string;
    ContinuationToken?: string;
    MaxKeys?: number;
  }): Promise<{
    Contents?: Array<{ Key?: string; Size?: number; LastModified?: Date }>;
    NextContinuationToken?: string;
    IsTruncated?: boolean;
  }>;
  
  deleteObject(params: {
    Bucket: string;
    Key: string;
  }): Promise<void>;
  
  getSignedUrl(operation: string, params: {
    Bucket: string;
    Key: string;
    Expires?: number;
  }): Promise<string>;
}

// ============================================================================
// S3 ARCHIVE OPTIONS
// ============================================================================

export interface S3AuditArchiveOptions {
  client: S3Client;
  bucket: string;
  prefix?: string;
  
  // Partitioning
  partitionByDate?: boolean; // year/month/day
  partitionByCategory?: boolean;
  
  // Compression
  defaultCompression?: CompressionType;
  
  // Signed URL settings
  signedUrlExpireSeconds?: number;
}

// ============================================================================
// S3 AUDIT ARCHIVE
// ============================================================================

export class S3AuditArchive {
  private client: S3Client;
  private bucket: string;
  private prefix: string;
  private options: S3AuditArchiveOptions;

  constructor(options: S3AuditArchiveOptions) {
    this.client = options.client;
    this.bucket = options.bucket;
    this.prefix = options.prefix ?? 'audit-archive';
    this.options = options;
  }

  // ==========================================================================
  // ARCHIVE OPERATIONS
  // ==========================================================================

  /**
   * Archive events to S3
   */
  async archive(
    events: AuditEvent[],
    options: {
      format: ExportFormat;
      compression?: CompressionType;
      metadata?: Record<string, string>;
    }
  ): Promise<ArchiveResult> {
    if (events.length === 0) {
      return { success: false, error: 'No events to archive' };
    }

    const timestamp = events[0].timestamp;
    const key = this.buildKey(timestamp, events[0].category, options.format, options.compression);

    // Serialize events
    const content = this.serializeEvents(events, options.format);
    
    // Compress if needed
    const compression = options.compression ?? this.options.defaultCompression ?? CompressionType.GZIP;
    const { body, contentEncoding } = await this.compress(content, compression);

    // Upload to S3
    const result = await this.client.putObject({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: this.getContentType(options.format),
      ContentEncoding: contentEncoding,
      Metadata: {
        'event-count': String(events.length),
        'timestamp-start': events[0].timestamp.toISOString(),
        'timestamp-end': events[events.length - 1].timestamp.toISOString(),
        ...options.metadata,
      },
    });

    return {
      success: true,
      key,
      etag: result.ETag,
      eventCount: events.length,
      sizeBytes: body.length,
    };
  }

  /**
   * Retrieve archived events
   */
  async retrieve(key: string): Promise<AuditEvent[]> {
    const result = await this.client.getObject({
      Bucket: this.bucket,
      Key: key,
    });

    // Decompress if needed
    const compression = this.detectCompression(key);
    const content = await this.decompress(result.Body, compression);

    // Parse events
    const format = this.detectFormat(key);
    return this.parseEvents(content, format);
  }

  /**
   * List archived files
   */
  async list(options?: {
    dateStart?: Date;
    dateEnd?: Date;
    category?: string;
    maxFiles?: number;
  }): Promise<ArchiveFile[]> {
    const files: ArchiveFile[] = [];
    let continuationToken: string | undefined;

    const prefix = this.buildListPrefix(options?.dateStart, options?.category);

    do {
      const result = await this.client.listObjectsV2({
        Bucket: this.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: options?.maxFiles ?? 1000,
      });

      if (result.Contents) {
        for (const obj of result.Contents) {
          if (!obj.Key) continue;

          // Filter by date if specified
          if (options?.dateEnd && obj.LastModified && obj.LastModified > options.dateEnd) {
            continue;
          }

          files.push({
            key: obj.Key,
            size: obj.Size ?? 0,
            lastModified: obj.LastModified ?? new Date(),
            format: this.detectFormat(obj.Key),
            compression: this.detectCompression(obj.Key),
          });

          if (options?.maxFiles && files.length >= options.maxFiles) {
            return files;
          }
        }
      }

      continuationToken = result.NextContinuationToken;
    } while (continuationToken);

    return files;
  }

  /**
   * Get signed URL for download
   */
  async getDownloadUrl(key: string, expireSeconds?: number): Promise<string> {
    return this.client.getSignedUrl('getObject', {
      Bucket: this.bucket,
      Key: key,
      Expires: expireSeconds ?? this.options.signedUrlExpireSeconds ?? 3600,
    });
  }

  /**
   * Delete archived file
   */
  async delete(key: string): Promise<void> {
    await this.client.deleteObject({
      Bucket: this.bucket,
      Key: key,
    });
  }

  /**
   * Delete archives older than specified date
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const files = await this.list({ dateEnd: date });
    let deleted = 0;

    for (const file of files) {
      if (file.lastModified < date) {
        await this.delete(file.key);
        deleted++;
      }
    }

    return deleted;
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private buildKey(
    timestamp: Date,
    category: string | undefined,
    format: ExportFormat,
    compression?: CompressionType
  ): string {
    const parts: string[] = [this.prefix];

    if (this.options.partitionByDate) {
      parts.push(
        String(timestamp.getFullYear()),
        String(timestamp.getMonth() + 1).padStart(2, '0'),
        String(timestamp.getDate()).padStart(2, '0')
      );
    }

    if (this.options.partitionByCategory && category) {
      parts.push(category.toLowerCase());
    }

    const filename = `audit-${timestamp.toISOString().replace(/[:.]/g, '-')}`;
    const ext = this.getExtension(format);
    const compExt = compression === CompressionType.GZIP ? '.gz' : 
                    compression === CompressionType.ZSTD ? '.zst' : '';

    parts.push(`${filename}.${ext}${compExt}`);

    return parts.join('/');
  }

  private buildListPrefix(dateStart?: Date, category?: string): string {
    const parts: string[] = [this.prefix];

    if (this.options.partitionByDate && dateStart) {
      parts.push(String(dateStart.getFullYear()));
      parts.push(String(dateStart.getMonth() + 1).padStart(2, '0'));
    }

    if (this.options.partitionByCategory && category) {
      parts.push(category.toLowerCase());
    }

    return parts.join('/');
  }

  private serializeEvents(events: AuditEvent[], format: ExportFormat): string {
    switch (format) {
      case ExportFormat.JSON:
        return JSON.stringify(events, null, 2);
      case ExportFormat.NDJSON:
        return events.map(e => JSON.stringify(e)).join('\n');
      case ExportFormat.CSV:
        return this.toCSV(events);
      default:
        return JSON.stringify(events);
    }
  }

  private parseEvents(content: string, format: ExportFormat): AuditEvent[] {
    switch (format) {
      case ExportFormat.JSON:
        return JSON.parse(content);
      case ExportFormat.NDJSON:
        return content.split('\n').filter(Boolean).map(line => JSON.parse(line));
      case ExportFormat.CSV:
        return this.fromCSV(content);
      default:
        return JSON.parse(content);
    }
  }

  private toCSV(events: AuditEvent[]): string {
    const headers = [
      'id', 'timestamp', 'action', 'category', 'outcome',
      'actor_id', 'actor_type', 'actor_name',
      'resource_type', 'resource_id',
      'source_service', 'source_environment',
      'duration_ms', 'error_code', 'error_message'
    ];

    const rows = events.map(e => [
      e.id,
      e.timestamp.toISOString(),
      e.action,
      e.category,
      e.outcome,
      e.actor.id,
      e.actor.type,
      e.actor.name ?? '',
      e.resource?.type ?? '',
      e.resource?.id ?? '',
      e.source.service,
      e.source.environment ?? '',
      e.duration_ms?.toString() ?? '',
      e.error_code ?? '',
      e.error_message ?? ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  private fromCSV(content: string): AuditEvent[] {
    const lines = content.split('\n');
    if (lines.length < 2) return [];

    const events: AuditEvent[] = [];
    // Simplified CSV parsing - production should use proper parser
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      // This is a simplified implementation
      // A real implementation would use a proper CSV parser
      const values = line.match(/(?:^|,)("(?:[^"]*(?:""[^"]*)*)"|[^,]*)/g);
      if (!values || values.length < 15) continue;

      const clean = (v: string) => v.replace(/^,?"?|"?$/g, '').replace(/""/g, '"');

      events.push({
        id: clean(values[0]) as any,
        timestamp: new Date(clean(values[1])),
        action: clean(values[2]),
        category: clean(values[3]) as any,
        outcome: clean(values[4]) as any,
        actor: {
          id: clean(values[5]) as any,
          type: clean(values[6]) as any,
          name: clean(values[7]) || undefined,
        },
        resource: clean(values[8]) ? {
          type: clean(values[8]),
          id: clean(values[9]) as any,
        } : undefined,
        source: {
          service: clean(values[10]),
          environment: clean(values[11]) || undefined,
        },
        duration_ms: clean(values[12]) ? parseInt(clean(values[12])) : undefined,
        error_code: clean(values[13]) || undefined,
        error_message: clean(values[14]) || undefined,
      });
    }

    return events;
  }

  private async compress(
    content: string,
    compression: CompressionType
  ): Promise<{ body: Buffer; contentEncoding?: string }> {
    const buffer = Buffer.from(content, 'utf-8');

    if (compression === CompressionType.GZIP) {
      // In real implementation, use zlib.gzipSync or similar
      // For now, return uncompressed with marker
      return { body: buffer, contentEncoding: 'gzip' };
    }

    return { body: buffer };
  }

  private async decompress(
    stream: ReadableStream,
    compression: CompressionType
  ): Promise<string> {
    // In real implementation, read stream and decompress
    // For now, simplified implementation
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks);
    return buffer.toString('utf-8');
  }

  private detectFormat(key: string): ExportFormat {
    if (key.includes('.ndjson')) return ExportFormat.NDJSON;
    if (key.includes('.csv')) return ExportFormat.CSV;
    if (key.includes('.parquet')) return ExportFormat.PARQUET;
    return ExportFormat.JSON;
  }

  private detectCompression(key: string): CompressionType {
    if (key.endsWith('.gz')) return CompressionType.GZIP;
    if (key.endsWith('.zst')) return CompressionType.ZSTD;
    return CompressionType.NONE;
  }

  private getExtension(format: ExportFormat): string {
    switch (format) {
      case ExportFormat.JSON: return 'json';
      case ExportFormat.NDJSON: return 'ndjson';
      case ExportFormat.CSV: return 'csv';
      case ExportFormat.PARQUET: return 'parquet';
      default: return 'json';
    }
  }

  private getContentType(format: ExportFormat): string {
    switch (format) {
      case ExportFormat.JSON: return 'application/json';
      case ExportFormat.NDJSON: return 'application/x-ndjson';
      case ExportFormat.CSV: return 'text/csv';
      case ExportFormat.PARQUET: return 'application/octet-stream';
      default: return 'application/json';
    }
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface ArchiveResult {
  success: boolean;
  key?: string;
  etag?: string;
  eventCount?: number;
  sizeBytes?: number;
  error?: string;
}

export interface ArchiveFile {
  key: string;
  size: number;
  lastModified: Date;
  format: ExportFormat;
  compression: CompressionType;
}
