/**
 * ISL Vibe Panel — State types for WebView ↔ Extension Host
 */

export type VibeFramework = 'nextjs' | 'express' | 'fastify';
export type VibeDatabase = 'sqlite' | 'postgresql';

export interface VibePipelineStage {
  id: number;
  name: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  duration?: number;
  tokenCount?: number;
  error?: string;
}

export interface VibeGeneratedFile {
  path: string;
  type: string;
  size: number;
  existedBefore?: boolean;
}

export interface VibeCertificate {
  verdict: 'SHIP' | 'NO_SHIP' | 'WARN';
  testResults?: { passed: number; failed: number };
  securityFindings?: string[];
  raw?: Record<string, unknown>;
}

/** State pushed from extension host to WebView */
export interface VibePanelUiState {
  phase: 'idle' | 'running' | 'done';
  prompt: string | null;
  message: string | null;
  error: string | null;
  verdict: 'SHIP' | 'NO_SHIP' | 'WARN' | null;
  score: number | null;
  outputDir: string | null;
  files: VibeGeneratedFile[];
  stages: VibePipelineStage[];
  overallProgress: number;
  etaSeconds: number | null;
  certificate: VibeCertificate | null;
  recentPrompts: string[];
  lastFramework: VibeFramework;
  lastDatabase: VibeDatabase;
}

/** Messages from WebView to extension host */
export type VibePanelWebviewMessage =
  | { type: 'requestState' }
  | { type: 'generate'; payload: { prompt: string; framework: VibeFramework; database: VibeDatabase } }
  | { type: 'selectOutputDir' }
  | { type: 'openFile'; payload: string }
  | { type: 'runTests' }
  | { type: 'startDevServer' }
  | { type: 'heal' }
  | { type: 'regenerateFile'; payload: string }
  | { type: 'openCertificate' }
  | { type: 'retryStage'; payload: number }
  | { type: 'selectRecentPrompt'; payload: string };
