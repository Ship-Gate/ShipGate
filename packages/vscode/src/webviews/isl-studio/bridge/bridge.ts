/**
 * ISL Studio - Message Bridge
 * 
 * The main communication bridge between the ISL Studio webview and
 * the VS Code extension. Handles:
 * - Request/response correlation
 * - Message routing
 * - Timeout handling
 * - State persistence integration
 */

import type * as vscode from 'vscode';
import {
  type StudioRequest,
  type StudioResponse,
  type StudioNotification,
  type WebviewToExtensionMessage,
  type ExtensionToWebviewMessage,
  type PendingRequest,
  type PendingRequestMap,
  createPendingRequestMap,
  createResponse,
  createNotification,
  isResponse,
  DEFAULT_REQUEST_TIMEOUT,
  generateCorrelationId,
} from './messages';
import { StudioPersistence } from './persistence';

// ============================================================================
// Types
// ============================================================================

/**
 * Handler function for processing requests
 */
export type RequestHandler<T extends StudioRequest = StudioRequest> = (
  request: T,
  bridge: StudioBridge
) => Promise<Extract<StudioResponse, { type: T['type'] }>['payload']>;

/**
 * Map of request type to handler
 */
export type RequestHandlerMap = {
  [K in StudioRequest['type']]?: RequestHandler<Extract<StudioRequest, { type: K }>>;
};

/**
 * Bridge configuration options
 */
export interface StudioBridgeOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Whether to auto-persist prompts */
  autoPersistPrompts?: boolean;
  /** Whether to auto-persist paths */
  autoPersistPaths?: boolean;
}

const DEFAULT_OPTIONS: Required<StudioBridgeOptions> = {
  timeout: DEFAULT_REQUEST_TIMEOUT,
  autoPersistPrompts: true,
  autoPersistPaths: true,
};

/**
 * Bridge event types
 */
export type BridgeEvent =
  | { type: 'request'; request: StudioRequest }
  | { type: 'response'; response: StudioResponse }
  | { type: 'notification'; notification: StudioNotification }
  | { type: 'error'; error: Error; correlationId?: string };

/**
 * Event listener callback
 */
export type BridgeEventListener = (event: BridgeEvent) => void;

// ============================================================================
// Studio Bridge
// ============================================================================

/**
 * Message bridge for ISL Studio webview communication
 * 
 * Usage (in extension):
 * ```typescript
 * const bridge = new StudioBridge(webview, workspaceRoot);
 * 
 * // Register handlers
 * bridge.registerHandler('GenerateSpec', async (request, bridge) => {
 *   const result = await generateSpec(request.payload.prompt);
 *   return { spec: result };
 * });
 * 
 * // Start listening
 * bridge.start();
 * 
 * // Send notifications
 * bridge.notify('Progress', { operation: 'generate', percent: 50, message: 'Processing...' });
 * ```
 */
export class StudioBridge {
  private readonly webview: vscode.Webview;
  private readonly options: Required<StudioBridgeOptions>;
  private readonly handlers: RequestHandlerMap = {};
  private readonly pendingRequests: PendingRequestMap;
  private readonly eventListeners: Set<BridgeEventListener> = new Set();
  private readonly persistence: StudioPersistence;
  private disposables: vscode.Disposable[] = [];
  private isStarted = false;

  constructor(
    webview: vscode.Webview,
    workspaceRoot: string,
    options: StudioBridgeOptions = {}
  ) {
    this.webview = webview;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.pendingRequests = createPendingRequestMap();
    this.persistence = new StudioPersistence(workspaceRoot);
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Start the bridge and begin listening for messages
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    // Initialize persistence
    await this.persistence.initialize();

    // Listen for messages from webview
    const messageDisposable = this.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => this.handleMessage(message)
    );
    this.disposables.push(messageDisposable);

    this.isStarted = true;

    // Send initial state sync
    const state = await this.persistence.getSummary();
    this.notify('StateSync', state);
  }

  /**
   * Stop the bridge and clean up resources
   */
  stop(): void {
    // Cancel all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Bridge stopped'));
    }
    this.pendingRequests.clear();

    // Dispose listeners
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];

    this.isStarted = false;
  }

  /**
   * Check if bridge is running
   */
  isRunning(): boolean {
    return this.isStarted;
  }

  // ==========================================================================
  // Handler Registration
  // ==========================================================================

  /**
   * Register a handler for a specific request type
   */
  registerHandler<T extends StudioRequest['type']>(
    type: T,
    handler: RequestHandler<Extract<StudioRequest, { type: T }>>
  ): void {
    this.handlers[type] = handler as RequestHandler;
  }

  /**
   * Register multiple handlers at once
   */
  registerHandlers(handlers: RequestHandlerMap): void {
    for (const [type, handler] of Object.entries(handlers)) {
      if (handler) {
        this.handlers[type as StudioRequest['type']] = handler;
      }
    }
  }

  /**
   * Unregister a handler
   */
  unregisterHandler(type: StudioRequest['type']): void {
    delete this.handlers[type];
  }

  // ==========================================================================
  // Message Handling
  // ==========================================================================

  /**
   * Handle incoming message from webview
   */
  private async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
    this.emit({ type: 'request', request: message });

    const handler = this.handlers[message.type];
    
    if (!handler) {
      // No handler registered - send error response
      this.sendResponse(message.type, message.correlationId, false, {}, 
        `No handler registered for ${message.type}`);
      return;
    }

    try {
      // Auto-persist prompts for generate requests
      if (this.options.autoPersistPrompts && 
          (message.type === 'GenerateSpec') &&
          'prompt' in message.payload) {
        await this.persistence.addPrompt(
          message.payload.prompt,
          message.payload.mode
        );
      }

      // Execute handler
      const payload = await handler(message as StudioRequest, this);

      // Auto-persist paths
      if (this.options.autoPersistPaths) {
        if (message.type === 'SaveSpec' && payload && 'path' in payload) {
          await this.persistence.setLastSpecPath(payload.path as string);
        }
        if (message.type === 'Audit' && payload && 'reportPath' in payload) {
          await this.persistence.setLastReportPath(payload.reportPath as string);
        }
      }

      // Send success response
      this.sendResponse(message.type, message.correlationId, true, payload);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit({ type: 'error', error: error as Error, correlationId: message.correlationId });
      this.sendResponse(message.type, message.correlationId, false, {}, errorMessage);
    }
  }

  /**
   * Send a response to the webview
   */
  private sendResponse<T extends StudioResponse['type']>(
    type: T,
    correlationId: string,
    success: boolean,
    payload: Extract<StudioResponse, { type: T }>['payload'],
    error?: string
  ): void {
    const response = createResponse(type, correlationId, success, payload, error);
    this.emit({ type: 'response', response });
    this.webview.postMessage(response);
  }

  // ==========================================================================
  // Outgoing Messages
  // ==========================================================================

  /**
   * Send a notification to the webview
   */
  notify<T extends StudioNotification['type']>(
    type: T,
    payload: Extract<StudioNotification, { type: T }>['payload']
  ): void {
    const notification = createNotification(type, payload);
    this.emit({ type: 'notification', notification });
    this.webview.postMessage(notification);
  }

  /**
   * Send a progress notification
   */
  notifyProgress(
    operation: 'generate' | 'build' | 'audit',
    percent: number,
    message: string
  ): void {
    this.notify('Progress', { operation, percent, message });
  }

  /**
   * Send a log notification
   */
  log(level: 'info' | 'warn' | 'error' | 'debug', message: string): void {
    this.notify('Log', { level, message });
  }

  /**
   * Send a status notification
   */
  setStatus(
    status: 'idle' | 'generating' | 'building' | 'auditing' | 'error' | 'success',
    message?: string
  ): void {
    this.notify('Status', { status, message });
  }

  /**
   * Send a state sync notification
   */
  async syncState(): Promise<void> {
    const state = await this.persistence.getSummary();
    this.notify('StateSync', state);
  }

  // ==========================================================================
  // Persistence Access
  // ==========================================================================

  /**
   * Get the persistence manager
   */
  getPersistence(): StudioPersistence {
    return this.persistence;
  }

  /**
   * Add a prompt to history
   */
  async addPromptToHistory(
    prompt: string,
    mode?: 'generate' | 'generateAndBuild'
  ): Promise<void> {
    await this.persistence.addPrompt(prompt, mode);
    await this.syncState();
  }

  /**
   * Update the last spec path
   */
  async setLastSpecPath(path: string | null): Promise<void> {
    await this.persistence.setLastSpecPath(path);
    await this.syncState();
  }

  /**
   * Update the last report path
   */
  async setLastReportPath(path: string | null): Promise<void> {
    await this.persistence.setLastReportPath(path);
    await this.syncState();
  }

  // ==========================================================================
  // Event System
  // ==========================================================================

  /**
   * Add an event listener
   */
  addEventListener(listener: BridgeEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Remove an event listener
   */
  removeEventListener(listener: BridgeEventListener): void {
    this.eventListeners.delete(listener);
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: BridgeEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        // Don't let listener errors break the bridge
        console.error('[StudioBridge] Event listener error:', error);
      }
    }
  }
}

// ============================================================================
// Built-in Handlers
// ============================================================================

/**
 * Create default handlers for common operations
 * These can be used as a starting point or overridden
 */
export function createDefaultHandlers(
  context: {
    executeCommand: (command: string, ...args: unknown[]) => Promise<unknown>;
    showOpenDialog: typeof import('vscode').window.showOpenDialog;
    showSaveDialog: typeof import('vscode').window.showSaveDialog;
    clipboard: typeof import('vscode').env.clipboard;
    openSettings: () => Promise<void>;
  }
): RequestHandlerMap {
  return {
    GetState: async (_request, bridge) => {
      return bridge.getPersistence().getSummary();
    },

    CancelOperation: async (_request, bridge) => {
      await context.executeCommand('isl.cancelOperation');
      bridge.setStatus('idle', 'Operation cancelled');
      return { cancelled: true };
    },

    OpenSettings: async () => {
      await context.openSettings();
      return {};
    },

    CopyToClipboard: async (request) => {
      await context.clipboard.writeText(request.payload.content);
      return {};
    },
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create and configure a StudioBridge instance
 */
export function createStudioBridge(
  webview: vscode.Webview,
  workspaceRoot: string,
  handlers?: RequestHandlerMap,
  options?: StudioBridgeOptions
): StudioBridge {
  const bridge = new StudioBridge(webview, workspaceRoot, options);
  
  if (handlers) {
    bridge.registerHandlers(handlers);
  }
  
  return bridge;
}
