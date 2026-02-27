/**
 * ISL Studio Bridge
 * 
 * Message bridge for ISL Studio webview communication.
 * 
 * @module bridge
 */

// Bridge
export {
  StudioBridge,
  createStudioBridge,
  createDefaultHandlers,
  type RequestHandler,
  type RequestHandlerMap,
  type StudioBridgeOptions,
  type BridgeEvent,
  type BridgeEventListener,
} from './bridge';

// Messages
export {
  // Correlation IDs
  generateCorrelationId,
  DEFAULT_REQUEST_TIMEOUT,
  
  // Base types
  type BaseMessage,
  type BaseRequest,
  type BaseResponse,
  type BaseNotification,
  
  // Request types
  type GenerateSpecRequest,
  type BuildRequest,
  type AuditRequest,
  type OpenReportRequest,
  type SaveSpecRequest,
  type CancelOperationRequest,
  type AnswerQuestionRequest,
  type GetStateRequest,
  type ListSpecsRequest,
  type ListReportsRequest,
  type OpenSettingsRequest,
  type CopyToClipboardRequest,
  type StudioRequest,
  type StudioRequestType,
  
  // Response types
  type GenerateSpecResponse,
  type BuildResponse,
  type AuditResponse,
  type OpenReportResponse,
  type SaveSpecResponse,
  type CancelOperationResponse,
  type AnswerQuestionResponse,
  type GetStateResponse,
  type ListSpecsResponse,
  type ListReportsResponse,
  type OpenSettingsResponse,
  type CopyToClipboardResponse,
  type StudioResponse,
  
  // Notification types
  type ProgressNotification,
  type LogNotification,
  type StatusNotification,
  type StateSyncNotification,
  type StudioNotification,
  
  // Union types
  type WebviewToExtensionMessage,
  type ExtensionToWebviewMessage,
  type StudioMessage,
  
  // Type guards
  isRequest,
  isResponse,
  isNotification,
  
  // Factories
  createRequest,
  createResponse,
  createNotification,
  
  // Request tracking
  type PendingRequest,
  type PendingRequestMap,
  createPendingRequestMap,
} from './messages';

// Persistence
export {
  StudioPersistence,
  getStudioPersistence,
  resetStudioPersistence,
  createDefaultState,
  MAX_RECENT_PROMPTS,
  STATE_VERSION,
  type StoredPrompt,
  type PersistedStudioState,
  type StudioPersistenceOptions,
} from './persistence';
