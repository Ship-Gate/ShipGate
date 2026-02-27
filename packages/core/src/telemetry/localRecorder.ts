/**
 * ISL Telemetry - Local File Recorder
 * 
 * Writes telemetry events to a local JSONL file.
 * No network calls are made - all data stays local.
 * 
 * File location: .shipgate/telemetry/events.jsonl
 */

import { existsSync, mkdirSync, appendFileSync, statSync, renameSync } from 'fs';
import { writeFile, appendFile, mkdir, stat, rename } from 'fs/promises';
import { join, dirname } from 'path';
import type {
  TelemetryConfig,
  TelemetryEvent,
  TelemetryMetadata,
  TelemetryRecorder,
} from './telemetryTypes.js';
import { DEFAULT_REDACTION_PATTERNS } from './telemetryTypes.js';
import { redactSecrets } from './telemetry.js';

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `ses_${timestamp}_${random}`;
}

/**
 * Get system metadata for telemetry events
 */
function getMetadata(): TelemetryMetadata {
  const metadata: TelemetryMetadata = {};
  
  if (typeof process !== 'undefined') {
    metadata.nodeVersion = process.version;
    metadata.os = process.platform;
  }
  
  metadata.islVersion = '0.1.0';
  
  return metadata;
}

/**
 * Local file telemetry recorder
 * 
 * Writes events to a JSONL file with automatic buffering and rotation.
 */
export class LocalTelemetryRecorder implements TelemetryRecorder {
  private config: Required<TelemetryConfig>;
  private sessionId: string;
  private correlationId?: string;
  private buffer: TelemetryEvent[] = [];
  private flushTimer?: NodeJS.Timeout;
  private filePath: string;
  private initialized = false;
  private closed = false;
  
  constructor(config: Required<TelemetryConfig>) {
    this.config = config;
    this.sessionId = generateSessionId();
    this.filePath = join(config.outputDir, config.filename);
    
    // Start flush timer if interval is set
    if (config.flushIntervalMs > 0) {
      this.flushTimer = setInterval(() => {
        this.flushSync();
      }, config.flushIntervalMs);
      
      // Unref so it doesn't keep the process alive
      if (this.flushTimer.unref) {
        this.flushTimer.unref();
      }
    }
    
    // Ensure directory exists synchronously on construction
    this.ensureDirectorySync();
    
    // Record session start
    this.recordEvent('session:start', {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
    });
  }
  
  /**
   * Ensure the output directory exists (sync)
   */
  private ensureDirectorySync(): void {
    if (this.initialized) return;
    
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    this.initialized = true;
  }
  
  /**
   * Ensure the output directory exists (async)
   */
  private async ensureDirectory(): Promise<void> {
    if (this.initialized) return;
    
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true });
    
    this.initialized = true;
  }
  
  /**
   * Check if file needs rotation based on size
   */
  private async checkRotation(): Promise<void> {
    try {
      if (!existsSync(this.filePath)) return;
      
      const stats = await stat(this.filePath);
      if (stats.size >= this.config.maxFileSize) {
        await this.rotateFile();
      }
    } catch {
      // Ignore rotation errors
    }
  }
  
  /**
   * Rotate the log file
   */
  private async rotateFile(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedPath = this.filePath.replace('.jsonl', `-${timestamp}.jsonl`);
    
    try {
      await rename(this.filePath, rotatedPath);
    } catch {
      // Ignore rotation errors
    }
  }
  
  /**
   * Create a telemetry event from name and payload
   */
  private createEvent(event: string, payload: Record<string, unknown>): TelemetryEvent {
    const redactedPayload = this.config.redactSecrets
      ? redactSecrets(payload, this.config.redactionPatterns) as Record<string, unknown>
      : payload;
    
    const telemetryEvent: TelemetryEvent = {
      timestamp: new Date().toISOString(),
      event,
      sessionId: this.sessionId,
      payload: redactedPayload,
    };
    
    if (this.correlationId) {
      telemetryEvent.correlationId = this.correlationId;
    }
    
    if (this.config.includeMetadata) {
      telemetryEvent.metadata = getMetadata();
    }
    
    return telemetryEvent;
  }
  
  /**
   * Record a telemetry event (non-blocking)
   */
  recordEvent(event: string, payload: Record<string, unknown>): void {
    if (this.closed || !this.config.enabled) return;
    
    const telemetryEvent = this.createEvent(event, payload);
    this.buffer.push(telemetryEvent);
    
    // Flush immediately if buffer is getting large
    if (this.buffer.length >= 100) {
      this.flushSync();
    }
  }
  
  /**
   * Record a telemetry event (async, waits for write)
   */
  async recordEventAsync(event: string, payload: Record<string, unknown>): Promise<void> {
    if (this.closed || !this.config.enabled) return;
    
    const telemetryEvent = this.createEvent(event, payload);
    
    await this.ensureDirectory();
    await this.checkRotation();
    
    const line = JSON.stringify(telemetryEvent) + '\n';
    await appendFile(this.filePath, line, 'utf-8');
  }
  
  /**
   * Flush buffered events to disk (sync)
   */
  private flushSync(): void {
    if (this.buffer.length === 0 || this.closed) return;
    
    try {
      this.ensureDirectorySync();
      
      // Check file size for rotation (sync)
      try {
        if (existsSync(this.filePath)) {
          const stats = statSync(this.filePath);
          if (stats.size >= this.config.maxFileSize) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const rotatedPath = this.filePath.replace('.jsonl', `-${timestamp}.jsonl`);
            renameSync(this.filePath, rotatedPath);
          }
        }
      } catch {
        // Ignore rotation errors
      }
      
      // Write buffered events
      const lines = this.buffer.map(e => JSON.stringify(e)).join('\n') + '\n';
      appendFileSync(this.filePath, lines, 'utf-8');
      this.buffer = [];
    } catch {
      // Silently ignore write errors - telemetry should never crash the app
    }
  }
  
  /**
   * Flush buffered events to disk (async)
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0 || this.closed) return;
    
    try {
      await this.ensureDirectory();
      await this.checkRotation();
      
      const lines = this.buffer.map(e => JSON.stringify(e)).join('\n') + '\n';
      await appendFile(this.filePath, lines, 'utf-8');
      this.buffer = [];
    } catch {
      // Silently ignore write errors
    }
  }
  
  /**
   * Close the recorder and flush remaining events
   */
  async close(): Promise<void> {
    if (this.closed) return;
    
    // Record session end
    this.recordEvent('session:end', {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
    });
    
    // Stop flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    
    // Final flush
    await this.flush();
    
    this.closed = true;
  }
  
  /**
   * Check if telemetry is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && !this.closed;
  }
  
  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
  
  /**
   * Set correlation ID for subsequent events
   */
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }
}

/**
 * Create a local file telemetry recorder
 * 
 * @param config Telemetry configuration
 * @returns LocalTelemetryRecorder instance
 */
export function createLocalRecorder(config: Required<TelemetryConfig>): LocalTelemetryRecorder {
  return new LocalTelemetryRecorder(config);
}
