/**
 * Recording Manager
 *
 * Record and replay HTTP interactions for testing.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface Recording {
  /** Timestamp of the recording */
  timestamp: string;
  /** HTTP method */
  method: string;
  /** Request path */
  path: string;
  /** Request body */
  request: unknown;
  /** Response body */
  response: unknown;
  /** HTTP status code */
  status: number;
  /** Response time in milliseconds */
  duration?: number;
  /** Request headers */
  requestHeaders?: Record<string, string>;
  /** Response headers */
  responseHeaders?: Record<string, string>;
}

export interface RecordingOptions {
  /** Enable recording mode */
  enabled?: boolean;
  /** Output directory for recordings */
  outputDir?: string;
  /** Maximum number of recordings to keep in memory */
  maxRecordings?: number;
  /** Filter function to decide what to record */
  filter?: (recording: Recording) => boolean;
  /** Transform function to modify recordings before storage */
  transform?: (recording: Recording) => Recording;
  /** Enable replay mode */
  replayMode?: boolean;
  /** Recordings to replay from */
  replaySource?: string | Recording[];
}

export class RecordingManager {
  private recordings: Recording[];
  private options: Required<RecordingOptions>;
  private replayRecordings: Recording[];
  private replayIndex: Map<string, number>;

  constructor(options: RecordingOptions = {}) {
    this.options = {
      enabled: options.enabled ?? false,
      outputDir: options.outputDir ?? './recordings',
      maxRecordings: options.maxRecordings ?? 1000,
      filter: options.filter ?? (() => true),
      transform: options.transform ?? ((r) => r),
      replayMode: options.replayMode ?? false,
      replaySource: options.replaySource ?? [],
    };

    this.recordings = [];
    this.replayRecordings = [];
    this.replayIndex = new Map();

    // Load replay recordings if provided
    if (this.options.replayMode) {
      this.loadReplaySource();
    }
  }

  private loadReplaySource(): void {
    const source = this.options.replaySource;

    if (typeof source === 'string') {
      // Load from file
      try {
        const content = fs.readFileSync(source, 'utf-8');
        this.replayRecordings = JSON.parse(content);
      } catch (error) {
        console.error(`Failed to load replay source: ${source}`);
      }
    } else if (Array.isArray(source)) {
      this.replayRecordings = source;
    }

    // Build index for quick lookup
    for (let i = 0; i < this.replayRecordings.length; i++) {
      const recording = this.replayRecordings[i];
      if (recording) {
        const key = this.getRecordingKey(recording);
        if (!this.replayIndex.has(key)) {
          this.replayIndex.set(key, i);
        }
      }
    }
  }

  private getRecordingKey(recording: Recording): string {
    return `${recording.method}:${recording.path}`;
  }

  /**
   * Record an HTTP interaction
   */
  record(recording: Omit<Recording, 'duration'>): void {
    if (!this.options.enabled) {
      return;
    }

    const fullRecording: Recording = {
      ...recording,
      duration: Date.now() - new Date(recording.timestamp).getTime(),
    };

    // Apply filter
    if (!this.options.filter(fullRecording)) {
      return;
    }

    // Apply transform
    const transformed = this.options.transform(fullRecording);

    // Add to recordings
    this.recordings.push(transformed);

    // Enforce max recordings limit
    if (this.recordings.length > this.options.maxRecordings) {
      this.recordings.shift();
    }
  }

  /**
   * Get all recordings
   */
  getRecordings(): Recording[] {
    return [...this.recordings];
  }

  /**
   * Get recordings for a specific path
   */
  getRecordingsForPath(path: string): Recording[] {
    return this.recordings.filter((r) => r.path === path);
  }

  /**
   * Get recordings for a specific method
   */
  getRecordingsForMethod(method: string): Recording[] {
    return this.recordings.filter((r) => r.method === method);
  }

  /**
   * Get the last N recordings
   */
  getLastRecordings(count: number): Recording[] {
    return this.recordings.slice(-count);
  }

  /**
   * Get recording count
   */
  count(): number {
    return this.recordings.length;
  }

  /**
   * Clear all recordings
   */
  clear(): void {
    this.recordings = [];
  }

  /**
   * Save recordings to file
   */
  async save(filename?: string): Promise<string> {
    const outputDir = this.options.outputDir;
    const outputFile = filename ?? `recording-${Date.now()}.json`;
    const outputPath = path.join(outputDir, outputFile);

    // Ensure output directory exists
    await fs.promises.mkdir(outputDir, { recursive: true });

    // Write recordings
    await fs.promises.writeFile(
      outputPath,
      JSON.stringify(this.recordings, null, 2),
      'utf-8'
    );

    return outputPath;
  }

  /**
   * Load recordings from file
   */
  async load(filepath: string): Promise<Recording[]> {
    const content = await fs.promises.readFile(filepath, 'utf-8');
    const loaded = JSON.parse(content) as Recording[];
    this.recordings.push(...loaded);
    return loaded;
  }

  /**
   * Get replay response for a request
   */
  getReplayResponse(method: string, path: string, body?: unknown): Recording | undefined {
    if (!this.options.replayMode) {
      return undefined;
    }

    const key = `${method}:${path}`;
    const index = this.replayIndex.get(key);

    if (index === undefined) {
      return undefined;
    }

    const recording = this.replayRecordings[index];

    if (!recording) {
      return undefined;
    }

    // If body matching is needed
    if (body !== undefined && recording.request !== undefined) {
      const bodyStr = JSON.stringify(body);
      const recordedStr = JSON.stringify(recording.request);
      if (bodyStr !== recordedStr) {
        // Try to find a matching recording
        return this.replayRecordings.find(
          (r) =>
            r.method === method &&
            r.path === path &&
            JSON.stringify(r.request) === bodyStr
        );
      }
    }

    return recording;
  }

  /**
   * Export recordings as HAR format
   */
  exportAsHAR(): HARLog {
    return {
      log: {
        version: '1.2',
        creator: {
          name: 'ISL Mock Server',
          version: '0.1.0',
        },
        entries: this.recordings.map((r) => ({
          startedDateTime: r.timestamp,
          time: r.duration ?? 0,
          request: {
            method: r.method,
            url: r.path,
            httpVersion: 'HTTP/1.1',
            headers: Object.entries(r.requestHeaders ?? {}).map(([name, value]) => ({
              name,
              value,
            })),
            queryString: [],
            cookies: [],
            headersSize: -1,
            bodySize: r.request ? JSON.stringify(r.request).length : 0,
            postData: r.request
              ? {
                  mimeType: 'application/json',
                  text: JSON.stringify(r.request),
                }
              : undefined,
          },
          response: {
            status: r.status,
            statusText: getStatusText(r.status),
            httpVersion: 'HTTP/1.1',
            headers: Object.entries(r.responseHeaders ?? {}).map(([name, value]) => ({
              name,
              value,
            })),
            cookies: [],
            content: {
              size: r.response ? JSON.stringify(r.response).length : 0,
              mimeType: 'application/json',
              text: JSON.stringify(r.response),
            },
            redirectURL: '',
            headersSize: -1,
            bodySize: r.response ? JSON.stringify(r.response).length : 0,
          },
          cache: {},
          timings: {
            send: 0,
            wait: r.duration ?? 0,
            receive: 0,
          },
        })),
      },
    };
  }

  /**
   * Generate test cases from recordings
   */
  generateTestCases(): TestCase[] {
    return this.recordings.map((r, i) => ({
      name: `${r.method} ${r.path} - Case ${i + 1}`,
      method: r.method,
      path: r.path,
      input: r.request,
      expectedOutput: r.response,
      expectedStatus: r.status,
    }));
  }

  /**
   * Find similar recordings (for deduplication)
   */
  findSimilar(recording: Recording): Recording[] {
    return this.recordings.filter(
      (r) =>
        r.method === recording.method &&
        r.path === recording.path &&
        r.status === recording.status
    );
  }

  /**
   * Get statistics about recordings
   */
  getStats(): RecordingStats {
    const byMethod: Record<string, number> = {};
    const byPath: Record<string, number> = {};
    const byStatus: Record<number, number> = {};
    let totalDuration = 0;

    for (const r of this.recordings) {
      byMethod[r.method] = (byMethod[r.method] ?? 0) + 1;
      byPath[r.path] = (byPath[r.path] ?? 0) + 1;
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      totalDuration += r.duration ?? 0;
    }

    return {
      total: this.recordings.length,
      byMethod,
      byPath,
      byStatus,
      averageDuration: this.recordings.length > 0 ? totalDuration / this.recordings.length : 0,
    };
  }

  /**
   * Enable or disable recording
   */
  setEnabled(enabled: boolean): void {
    this.options.enabled = enabled;
  }

  /**
   * Check if recording is enabled
   */
  isEnabled(): boolean {
    return this.options.enabled;
  }

  /**
   * Set replay mode
   */
  setReplayMode(enabled: boolean, source?: string | Recording[]): void {
    this.options.replayMode = enabled;
    if (source) {
      this.options.replaySource = source;
      this.loadReplaySource();
    }
  }
}

// Helper types
interface HARLog {
  log: {
    version: string;
    creator: { name: string; version: string };
    entries: HAREntry[];
  };
}

interface HAREntry {
  startedDateTime: string;
  time: number;
  request: {
    method: string;
    url: string;
    httpVersion: string;
    headers: Array<{ name: string; value: string }>;
    queryString: unknown[];
    cookies: unknown[];
    headersSize: number;
    bodySize: number;
    postData?: { mimeType: string; text: string };
  };
  response: {
    status: number;
    statusText: string;
    httpVersion: string;
    headers: Array<{ name: string; value: string }>;
    cookies: unknown[];
    content: { size: number; mimeType: string; text: string };
    redirectURL: string;
    headersSize: number;
    bodySize: number;
  };
  cache: Record<string, unknown>;
  timings: { send: number; wait: number; receive: number };
}

interface TestCase {
  name: string;
  method: string;
  path: string;
  input: unknown;
  expectedOutput: unknown;
  expectedStatus: number;
}

interface RecordingStats {
  total: number;
  byMethod: Record<string, number>;
  byPath: Record<string, number>;
  byStatus: Record<number, number>;
  averageDuration: number;
}

function getStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };
  return statusTexts[status] ?? 'Unknown';
}
