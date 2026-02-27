/**
 * ISL Studio - Message Protocol
 * 
 * Typed message protocol for communication between the ISL Studio
 * webview and the VS Code extension. Includes:
 * - Request/response message types
 * - Correlation IDs for async matching
 * - Type-safe discriminated unions
 */

// ============================================================================
// Correlation ID Generation
// ============================================================================

/**
 * Generate a unique correlation ID for request/response matching
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

// ============================================================================
// Base Message Types
// ============================================================================

/**
 * Base interface for all messages
 */
export interface BaseMessage {
  /** Unique correlation ID for request/response matching */
  correlationId: string;
  /** Timestamp when message was created */
  timestamp: number;
}

/**
 * Base request message (webview → extension)
 */
export interface BaseRequest extends BaseMessage {
  direction: 'request';
}

/**
 * Base response message (extension → webview)
 */
export interface BaseResponse extends BaseMessage {
  direction: 'response';
  /** Whether the operation succeeded */
  success: boolean;
  /** Error message if success is false */
  error?: string;
}

/**
 * Base notification message (one-way, no response expected)
 */
export interface BaseNotification extends BaseMessage {
  direction: 'notification';
}

// ============================================================================
// Request Types (Webview → Extension)
// ============================================================================

/**
 * Generate a new ISL specification from a prompt
 */
export interface GenerateSpecRequest extends BaseRequest {
  type: 'GenerateSpec';
  payload: {
    prompt: string;
    mode: 'generate' | 'generateAndBuild';
    /** Optional context about the target API/service */
    context?: string;
  };
}

/**
 * Build/compile an existing ISL specification
 */
export interface BuildRequest extends BaseRequest {
  type: 'Build';
  payload: {
    specPath: string;
    /** Output targets */
    targets?: ('typescript' | 'tests' | 'openapi')[];
  };
}

/**
 * Audit an existing ISL specification
 */
export interface AuditRequest extends BaseRequest {
  type: 'Audit';
  payload: {
    specPath: string;
    /** Include evidence collection */
    collectEvidence?: boolean;
  };
}

/**
 * Open a report in the Evidence View
 */
export interface OpenReportRequest extends BaseRequest {
  type: 'OpenReport';
  payload: {
    reportPath: string;
  };
}

/**
 * Save the current spec to disk
 */
export interface SaveSpecRequest extends BaseRequest {
  type: 'SaveSpec';
  payload: {
    content: string;
    path?: string;
  };
}

/**
 * Cancel an ongoing operation
 */
export interface CancelOperationRequest extends BaseRequest {
  type: 'CancelOperation';
  payload: {
    /** Optional: specific operation ID to cancel */
    operationId?: string;
  };
}

/**
 * Answer an open question from spec generation
 */
export interface AnswerQuestionRequest extends BaseRequest {
  type: 'AnswerQuestion';
  payload: {
    questionId: string;
    answer: string;
  };
}

/**
 * Get the persisted studio state
 */
export interface GetStateRequest extends BaseRequest {
  type: 'GetState';
  payload: Record<string, never>;
}

/**
 * List available spec files in the workspace
 */
export interface ListSpecsRequest extends BaseRequest {
  type: 'ListSpecs';
  payload: {
    /** Filter by directory */
    directory?: string;
  };
}

/**
 * List available report files
 */
export interface ListReportsRequest extends BaseRequest {
  type: 'ListReports';
  payload: {
    /** Filter by spec path */
    specPath?: string;
  };
}

/**
 * Open VS Code settings for ISL
 */
export interface OpenSettingsRequest extends BaseRequest {
  type: 'OpenSettings';
  payload: {
    /** Specific setting section to open */
    section?: string;
  };
}

/**
 * Copy content to clipboard
 */
export interface CopyToClipboardRequest extends BaseRequest {
  type: 'CopyToClipboard';
  payload: {
    content: string;
  };
}

/**
 * Union of all request types
 */
export type StudioRequest =
  | GenerateSpecRequest
  | BuildRequest
  | AuditRequest
  | OpenReportRequest
  | SaveSpecRequest
  | CancelOperationRequest
  | AnswerQuestionRequest
  | GetStateRequest
  | ListSpecsRequest
  | ListReportsRequest
  | OpenSettingsRequest
  | CopyToClipboardRequest;

/**
 * Extract request type names
 */
export type StudioRequestType = StudioRequest['type'];

// ============================================================================
// Response Types (Extension → Webview)
// ============================================================================

/**
 * Response to GenerateSpec request
 */
export interface GenerateSpecResponse extends BaseResponse {
  type: 'GenerateSpec';
  payload: {
    spec?: {
      raw: string;
      formatted: string;
      clauses: Array<{
        id: string;
        type: string;
        description: string;
        code?: string;
      }>;
      assumptions: Array<{
        id: string;
        topic: string;
        assumed: string;
        rationale: string;
        confidence: 'high' | 'medium' | 'low';
      }>;
      openQuestions: Array<{
        id: string;
        question: string;
        options?: string[];
        priority: 'critical' | 'high' | 'medium' | 'low';
      }>;
    };
    /** Path where spec was saved (if auto-save enabled) */
    savedPath?: string;
  };
}

/**
 * Response to Build request
 */
export interface BuildResponse extends BaseResponse {
  type: 'Build';
  payload: {
    /** Generated artifact paths */
    artifacts?: string[];
    /** Build log/output */
    log?: string[];
    /** Trust score from build */
    trustScore?: number;
  };
}

/**
 * Response to Audit request
 */
export interface AuditResponse extends BaseResponse {
  type: 'Audit';
  payload: {
    /** Overall trust score (0-100) */
    trustScore?: number;
    /** Individual clause results */
    results?: Array<{
      clauseId: string;
      status: 'passed' | 'failed' | 'skipped';
      message?: string;
    }>;
    /** Path to generated report */
    reportPath?: string;
  };
}

/**
 * Response to OpenReport request
 */
export interface OpenReportResponse extends BaseResponse {
  type: 'OpenReport';
  payload: Record<string, never>;
}

/**
 * Response to SaveSpec request
 */
export interface SaveSpecResponse extends BaseResponse {
  type: 'SaveSpec';
  payload: {
    path?: string;
  };
}

/**
 * Response to CancelOperation request
 */
export interface CancelOperationResponse extends BaseResponse {
  type: 'CancelOperation';
  payload: {
    /** Whether cancellation was successful */
    cancelled: boolean;
  };
}

/**
 * Response to AnswerQuestion request
 */
export interface AnswerQuestionResponse extends BaseResponse {
  type: 'AnswerQuestion';
  payload: Record<string, never>;
}

/**
 * Response to GetState request
 */
export interface GetStateResponse extends BaseResponse {
  type: 'GetState';
  payload: {
    recentPrompts: string[];
    lastSpecPath?: string;
    lastReportPath?: string;
  };
}

/**
 * Response to ListSpecs request
 */
export interface ListSpecsResponse extends BaseResponse {
  type: 'ListSpecs';
  payload: {
    specs: Array<{
      path: string;
      name: string;
      lastModified: number;
    }>;
  };
}

/**
 * Response to ListReports request
 */
export interface ListReportsResponse extends BaseResponse {
  type: 'ListReports';
  payload: {
    reports: Array<{
      path: string;
      specPath: string;
      trustScore: number;
      timestamp: number;
    }>;
  };
}

/**
 * Response to OpenSettings request
 */
export interface OpenSettingsResponse extends BaseResponse {
  type: 'OpenSettings';
  payload: Record<string, never>;
}

/**
 * Response to CopyToClipboard request
 */
export interface CopyToClipboardResponse extends BaseResponse {
  type: 'CopyToClipboard';
  payload: Record<string, never>;
}

/**
 * Union of all response types
 */
export type StudioResponse =
  | GenerateSpecResponse
  | BuildResponse
  | AuditResponse
  | OpenReportResponse
  | SaveSpecResponse
  | CancelOperationResponse
  | AnswerQuestionResponse
  | GetStateResponse
  | ListSpecsResponse
  | ListReportsResponse
  | OpenSettingsResponse
  | CopyToClipboardResponse;

// ============================================================================
// Notification Types (Extension → Webview, one-way)
// ============================================================================

/**
 * Progress update for long-running operations
 */
export interface ProgressNotification extends BaseNotification {
  type: 'Progress';
  payload: {
    /** Operation being tracked */
    operation: 'generate' | 'build' | 'audit';
    /** Progress percentage (0-100) */
    percent: number;
    /** Current step description */
    message: string;
  };
}

/**
 * Log message for activity feed
 */
export interface LogNotification extends BaseNotification {
  type: 'Log';
  payload: {
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
  };
}

/**
 * Status change notification
 */
export interface StatusNotification extends BaseNotification {
  type: 'Status';
  payload: {
    status: 'idle' | 'generating' | 'building' | 'auditing' | 'error' | 'success';
    message?: string;
  };
}

/**
 * State sync notification (full state update)
 */
export interface StateSyncNotification extends BaseNotification {
  type: 'StateSync';
  payload: {
    recentPrompts: string[];
    lastSpecPath?: string;
    lastReportPath?: string;
  };
}

/**
 * Union of all notification types
 */
export type StudioNotification =
  | ProgressNotification
  | LogNotification
  | StatusNotification
  | StateSyncNotification;

// ============================================================================
// Message Union & Type Guards
// ============================================================================

/**
 * All messages from webview to extension
 */
export type WebviewToExtensionMessage = StudioRequest;

/**
 * All messages from extension to webview
 */
export type ExtensionToWebviewMessage = StudioResponse | StudioNotification;

/**
 * All message types
 */
export type StudioMessage = WebviewToExtensionMessage | ExtensionToWebviewMessage;

/**
 * Type guard for request messages
 */
export function isRequest(msg: StudioMessage): msg is StudioRequest {
  return 'direction' in msg && msg.direction === 'request';
}

/**
 * Type guard for response messages
 */
export function isResponse(msg: StudioMessage): msg is StudioResponse {
  return 'direction' in msg && msg.direction === 'response';
}

/**
 * Type guard for notification messages
 */
export function isNotification(msg: StudioMessage): msg is StudioNotification {
  return 'direction' in msg && msg.direction === 'notification';
}

// ============================================================================
// Message Factories
// ============================================================================

/**
 * Create a request message
 */
export function createRequest<T extends StudioRequest['type']>(
  type: T,
  payload: Extract<StudioRequest, { type: T }>['payload']
): Extract<StudioRequest, { type: T }> {
  return {
    type,
    direction: 'request',
    correlationId: generateCorrelationId(),
    timestamp: Date.now(),
    payload,
  } as Extract<StudioRequest, { type: T }>;
}

/**
 * Create a response message
 */
export function createResponse<T extends StudioResponse['type']>(
  type: T,
  correlationId: string,
  success: boolean,
  payload: Extract<StudioResponse, { type: T }>['payload'],
  error?: string
): Extract<StudioResponse, { type: T }> {
  return {
    type,
    direction: 'response',
    correlationId,
    timestamp: Date.now(),
    success,
    error,
    payload,
  } as Extract<StudioResponse, { type: T }>;
}

/**
 * Create a notification message
 */
export function createNotification<T extends StudioNotification['type']>(
  type: T,
  payload: Extract<StudioNotification, { type: T }>['payload']
): Extract<StudioNotification, { type: T }> {
  return {
    type,
    direction: 'notification',
    correlationId: generateCorrelationId(),
    timestamp: Date.now(),
    payload,
  } as Extract<StudioNotification, { type: T }>;
}

// ============================================================================
// Request/Response Matching
// ============================================================================

/**
 * Pending request tracker for correlation
 */
export interface PendingRequest<T extends StudioRequest = StudioRequest> {
  request: T;
  resolve: (response: Extract<StudioResponse, { type: T['type'] }>) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Default timeout for requests (30 seconds)
 */
export const DEFAULT_REQUEST_TIMEOUT = 30000;

/**
 * Map of correlation IDs to pending requests
 */
export type PendingRequestMap = Map<string, PendingRequest>;

/**
 * Create a new pending request map
 */
export function createPendingRequestMap(): PendingRequestMap {
  return new Map();
}
