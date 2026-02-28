# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateCorrelationId, isRequest, isResponse, isNotification, createRequest, createResponse, createNotification, createPendingRequestMap, DEFAULT_REQUEST_TIMEOUT, BaseMessage, BaseRequest, BaseResponse, BaseNotification, GenerateSpecRequest, BuildRequest, AuditRequest, OpenReportRequest, SaveSpecRequest, CancelOperationRequest, AnswerQuestionRequest, GetStateRequest, ListSpecsRequest, ListReportsRequest, OpenSettingsRequest, CopyToClipboardRequest, StudioRequest, StudioRequestType, GenerateSpecResponse, BuildResponse, AuditResponse, OpenReportResponse, SaveSpecResponse, CancelOperationResponse, AnswerQuestionResponse, GetStateResponse, ListSpecsResponse, ListReportsResponse, OpenSettingsResponse, CopyToClipboardResponse, StudioResponse, ProgressNotification, LogNotification, StatusNotification, StateSyncNotification, StudioNotification, WebviewToExtensionMessage, ExtensionToWebviewMessage, StudioMessage, PendingRequest, PendingRequestMap
# dependencies: 

domain Messages {
  version: "1.0.0"

  type BaseMessage = String
  type BaseRequest = String
  type BaseResponse = String
  type BaseNotification = String
  type GenerateSpecRequest = String
  type BuildRequest = String
  type AuditRequest = String
  type OpenReportRequest = String
  type SaveSpecRequest = String
  type CancelOperationRequest = String
  type AnswerQuestionRequest = String
  type GetStateRequest = String
  type ListSpecsRequest = String
  type ListReportsRequest = String
  type OpenSettingsRequest = String
  type CopyToClipboardRequest = String
  type StudioRequest = String
  type StudioRequestType = String
  type GenerateSpecResponse = String
  type BuildResponse = String
  type AuditResponse = String
  type OpenReportResponse = String
  type SaveSpecResponse = String
  type CancelOperationResponse = String
  type AnswerQuestionResponse = String
  type GetStateResponse = String
  type ListSpecsResponse = String
  type ListReportsResponse = String
  type OpenSettingsResponse = String
  type CopyToClipboardResponse = String
  type StudioResponse = String
  type ProgressNotification = String
  type LogNotification = String
  type StatusNotification = String
  type StateSyncNotification = String
  type StudioNotification = String
  type WebviewToExtensionMessage = String
  type ExtensionToWebviewMessage = String
  type StudioMessage = String
  type PendingRequest = String
  type PendingRequestMap = String

  invariants exports_present {
    - true
  }
}
