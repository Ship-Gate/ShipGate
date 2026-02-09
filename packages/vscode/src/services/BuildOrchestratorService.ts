/**
 * BuildOrchestratorService
 * 
 * Orchestrates the "Generate & Build" workflow:
 * 1. Translate prompt to ISL spec via MCP tool (isl_translate)
 * 2. Save spec to .shipgate/specs/
 * 3. Execute spec verification via MCP tool (execute_spec)
 * 4. Trigger shipgate scan/verify
 * 5. Write evidence report to .shipgate/reports/<fingerprint>.json
 */

import * as vscode from 'vscode';
import { SpecStorageService, StoredSpec } from './SpecStorageService';
import { EvidenceStorageService, EvidenceReport, BuildResult, VerificationResult, TrustScore } from './EvidenceStorageService';

// ============================================================================
// Types
// ============================================================================

export interface BuildContext {
  workspaceRoot: string;
  activeFile?: string;
  selectedText?: string;
  additionalContext?: Record<string, unknown>;
}

export interface BuildOrchestratorOptions {
  specStorage: SpecStorageService;
  evidenceStorage: EvidenceStorageService;
  mcpClient?: McpClientAbstraction;
  outputChannel?: vscode.OutputChannel;
}

export interface BuildRunResult {
  success: boolean;
  spec: StoredSpec;
  evidenceReport: EvidenceReport;
  errors: string[];
  warnings: string[];
}

export interface McpToolResponse {
  success: boolean;
  content?: unknown;
  error?: string;
}

/**
 * Abstraction for MCP client to allow for different implementations
 * and easier testing
 */
export interface McpClientAbstraction {
  callTool(toolName: string, args: Record<string, unknown>): Promise<McpToolResponse>;
}

// ============================================================================
// Default MCP Client (Stub Implementation)
// ============================================================================

/**
 * Default MCP client that provides stub implementations for missing tools
 * and integrates with existing MCP infrastructure when available.
 */
class DefaultMcpClient implements McpClientAbstraction {
  private outputChannel?: vscode.OutputChannel;

  constructor(outputChannel?: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<McpToolResponse> {
    this.log(`Calling MCP tool: ${toolName}`);

    switch (toolName) {
      case 'isl_translate':
        return this.handleIslTranslate(args);
      
      case 'execute_spec':
        return this.handleExecuteSpec(args);
      
      case 'isl_check':
        return this.handleIslCheck(args);
      
      case 'isl_generate':
        return this.handleIslGenerate(args);
      
      case 'shipgate_scan':
        return this.handleShipgateScan(args);
      
      case 'shipgate_verify':
        return this.handleShipgateVerify(args);
      
      default:
        return {
          success: false,
          error: `Unknown MCP tool: ${toolName}`,
        };
    }
  }

  /**
   * Handle isl_translate - Translate natural language prompt to ISL spec
   * TODO: Implement actual MCP call when tool is available
   */
  private async handleIslTranslate(args: Record<string, unknown>): Promise<McpToolResponse> {
    const prompt = args['prompt'] as string;
    const context = args['context'] as Record<string, unknown> | undefined;

    this.log(`isl_translate called with prompt: ${prompt?.substring(0, 100)}...`);

    // TODO: Replace with actual MCP isl_translate call
    // For now, return a stub response indicating the tool is not yet implemented
    return {
      success: false,
      error: 'isl_translate MCP tool not yet implemented. Please provide ISL spec directly.',
      content: {
        _stub: true,
        message: 'This is a placeholder. The isl_translate tool will convert natural language to ISL.',
        expectedInput: { prompt, context },
        expectedOutput: {
          success: true,
          islSpec: '// Generated ISL spec would appear here',
          confidence: 0.95,
        },
      },
    };
  }

  /**
   * Handle execute_spec - Execute and verify a spec
   * TODO: Implement actual MCP call when tool is available
   */
  private async handleExecuteSpec(args: Record<string, unknown>): Promise<McpToolResponse> {
    const specContent = args['spec'] as string;
    const specPath = args['specPath'] as string | undefined;

    this.log(`execute_spec called for spec: ${specPath || '(inline)'}`);

    // TODO: Replace with actual MCP execute_spec call
    // For now, return a stub response
    return {
      success: false,
      error: 'execute_spec MCP tool not yet implemented.',
      content: {
        _stub: true,
        message: 'This is a placeholder. The execute_spec tool will run verification.',
        expectedInput: { spec: specContent?.substring(0, 100), specPath },
        expectedOutput: {
          success: true,
          results: [],
          coverage: 1.0,
        },
      },
    };
  }

  /**
   * Handle isl_check - Parse and type check ISL spec
   * Delegates to actual MCP server if available
   */
  private async handleIslCheck(args: Record<string, unknown>): Promise<McpToolResponse> {
    const source = args['source'] as string;

    this.log('isl_check called');

    // TODO: Integrate with actual MCP server
    // For now, provide a basic validation stub
    try {
      // Basic syntax validation
      const hasDomain = /domain\s+\w+/.test(source);
      if (!hasDomain) {
        return {
          success: false,
          error: 'Missing domain declaration',
          content: {
            parseErrors: [{ message: 'Expected domain declaration', line: 1, column: 1 }],
          },
        };
      }

      return {
        success: true,
        content: {
          valid: true,
          domain: source.match(/domain\s+(\w+)/)?.[1] || 'Unknown',
          entities: [],
          behaviors: [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle isl_generate - Generate code from ISL spec
   */
  private async handleIslGenerate(args: Record<string, unknown>): Promise<McpToolResponse> {
    const source = args['source'] as string;
    const mode = args['mode'] as string || 'development';

    this.log(`isl_generate called with mode: ${mode}`);

    // TODO: Integrate with actual MCP server
    return {
      success: true,
      content: {
        _stub: true,
        files: [],
        message: 'Code generation placeholder',
      },
    };
  }

  /**
   * Handle shipgate_scan - Scan for implementation files
   */
  private async handleShipgateScan(args: Record<string, unknown>): Promise<McpToolResponse> {
    const specPath = args['specPath'] as string;

    this.log(`shipgate_scan called for: ${specPath}`);

    // TODO: Implement actual scan logic
    return {
      success: true,
      content: {
        _stub: true,
        implementations: [],
        message: 'Shipgate scan placeholder',
      },
    };
  }

  /**
   * Handle shipgate_verify - Verify implementation against spec
   */
  private async handleShipgateVerify(args: Record<string, unknown>): Promise<McpToolResponse> {
    const specPath = args['specPath'] as string;

    this.log(`shipgate_verify called for: ${specPath}`);

    // TODO: Implement actual verification logic
    return {
      success: true,
      content: {
        _stub: true,
        passed: true,
        results: [],
        trustScore: {
          overall: 0,
          breakdown: {
            preconditions: 0,
            postconditions: 0,
            invariants: 0,
            scenarios: 0,
          },
        },
        message: 'Shipgate verify placeholder',
      },
    };
  }

  private log(message: string): void {
    this.outputChannel?.appendLine(`[BuildOrchestrator] ${message}`);
  }
}

// ============================================================================
// BuildOrchestratorService
// ============================================================================

export class BuildOrchestratorService {
  private readonly specStorage: SpecStorageService;
  private readonly evidenceStorage: EvidenceStorageService;
  private readonly mcpClient: McpClientAbstraction;
  private readonly outputChannel?: vscode.OutputChannel;

  constructor(options: BuildOrchestratorOptions) {
    this.specStorage = options.specStorage;
    this.evidenceStorage = options.evidenceStorage;
    this.mcpClient = options.mcpClient || new DefaultMcpClient(options.outputChannel);
    this.outputChannel = options.outputChannel;
  }

  /**
   * Create service from VSCode workspace
   */
  static fromWorkspace(outputChannel?: vscode.OutputChannel): BuildOrchestratorService | null {
    const specStorage = SpecStorageService.fromWorkspace();
    const evidenceStorage = EvidenceStorageService.fromWorkspace();

    if (!specStorage || !evidenceStorage) {
      return null;
    }

    return new BuildOrchestratorService({
      specStorage,
      evidenceStorage,
      outputChannel,
    });
  }

  /**
   * Run the Generate & Build workflow
   * 
   * @param prompt Natural language prompt or ISL spec content
   * @param context Additional context for the build
   */
  async run(prompt: string, context: BuildContext): Promise<BuildRunResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    this.log('Starting Generate & Build workflow...');
    this.log(`Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);

    // Step 1: Determine if prompt is ISL spec or natural language
    let islSpec: string;
    const isIslSpec = this.detectIslSpec(prompt);

    if (isIslSpec) {
      this.log('Detected ISL spec input');
      islSpec = prompt;
    } else {
      this.log('Detected natural language prompt, attempting translation...');
      
      // Call MCP tool isl_translate
      const translateResult = await this.mcpClient.callTool('isl_translate', {
        prompt,
        context: context.additionalContext,
      });

      if (!translateResult.success) {
        errors.push(`Translation failed: ${translateResult.error}`);
        warnings.push('Using prompt as raw spec (translation not available)');
        // Fall back to using prompt as spec for development
        islSpec = this.wrapAsMinimalSpec(prompt);
      } else {
        islSpec = (translateResult.content as { islSpec: string }).islSpec;
      }
    }

    // Step 2: Validate the ISL spec
    this.log('Validating ISL spec...');
    const checkResult = await this.mcpClient.callTool('isl_check', {
      source: islSpec,
    });

    if (!checkResult.success) {
      errors.push(`Spec validation failed: ${checkResult.error}`);
    }

    // Step 3: Save spec to .shipgate/specs/
    this.log('Saving spec to storage...');
    const storedSpec = await this.specStorage.saveSpec(islSpec, {
      source: isIslSpec ? 'clipboard' : 'prompt',
      prompt: isIslSpec ? undefined : prompt,
    });
    this.log(`Spec saved with fingerprint: ${storedSpec.metadata.fingerprint}`);

    // Step 4: Generate code from spec
    this.log('Generating code...');
    const generateResult = await this.mcpClient.callTool('isl_generate', {
      source: islSpec,
      mode: 'development',
    });

    const buildResult: BuildResult = {
      success: generateResult.success,
      generatedFiles: generateResult.success 
        ? ((generateResult.content as { files?: string[] })?.files || [])
        : [],
      errors: generateResult.success ? [] : [generateResult.error || 'Generation failed'],
      warnings: [],
      duration: Date.now() - startTime,
    };

    // Step 5: Call execute_spec (or stub)
    this.log('Executing spec verification...');
    const executeResult = await this.mcpClient.callTool('execute_spec', {
      spec: islSpec,
      specPath: storedSpec.filePath,
    });

    let verificationResults: VerificationResult[] = [];
    if (executeResult.success && executeResult.content) {
      const content = executeResult.content as { results?: VerificationResult[] };
      verificationResults = content.results || [];
    } else if (executeResult.error) {
      warnings.push(`Spec execution: ${executeResult.error}`);
    }

    // Step 6: Trigger shipgate scan/verify
    this.log('Running shipgate verification...');
    const shipgateResult = await this.mcpClient.callTool('shipgate_verify', {
      specPath: storedSpec.filePath,
    });

    let trustScore: TrustScore | undefined;
    if (shipgateResult.success && shipgateResult.content) {
      const content = shipgateResult.content as { trustScore?: TrustScore };
      trustScore = content.trustScore;
    }

    // Step 7: Write evidence report
    this.log('Writing evidence report...');
    const passedCount = verificationResults.filter(r => r.passed).length;
    const failedCount = verificationResults.filter(r => !r.passed).length;

    const evidenceReport = await this.evidenceStorage.saveReport({
      specFingerprint: storedSpec.metadata.fingerprint,
      specName: storedSpec.metadata.name,
      source: 'generate-and-build',
      prompt: isIslSpec ? undefined : prompt,
      build: buildResult,
      verification: {
        results: verificationResults,
        passedCount,
        failedCount,
        totalCount: verificationResults.length,
        coverage: verificationResults.length > 0 ? passedCount / verificationResults.length : 0,
      },
      trustScore,
      mcpResponses: {
        translate: isIslSpec ? null : 'attempted',
        check: checkResult,
        generate: generateResult,
        execute: executeResult,
        shipgate: shipgateResult,
      },
    });

    this.log(`Evidence report saved: ${evidenceReport.fingerprint}`);
    this.log(`Workflow completed in ${Date.now() - startTime}ms`);

    const success = errors.length === 0 && buildResult.success;

    return {
      success,
      spec: storedSpec,
      evidenceReport,
      errors,
      warnings,
    };
  }

  /**
   * Run verification only (without generate)
   */
  async verify(specFingerprint: string): Promise<EvidenceReport | null> {
    const spec = await this.specStorage.loadSpec(specFingerprint);
    if (!spec) {
      this.log(`Spec not found: ${specFingerprint}`);
      return null;
    }

    const startTime = Date.now();

    // Run shipgate verification
    const shipgateResult = await this.mcpClient.callTool('shipgate_verify', {
      specPath: spec.filePath,
    });

    let verificationResults: VerificationResult[] = [];
    let trustScore: TrustScore | undefined;

    if (shipgateResult.success && shipgateResult.content) {
      const content = shipgateResult.content as {
        results?: VerificationResult[];
        trustScore?: TrustScore;
      };
      verificationResults = content.results || [];
      trustScore = content.trustScore;
    }

    const passedCount = verificationResults.filter(r => r.passed).length;
    const failedCount = verificationResults.filter(r => !r.passed).length;

    return this.evidenceStorage.saveReport({
      specFingerprint: spec.metadata.fingerprint,
      specName: spec.metadata.name,
      source: 'manual-verify',
      verification: {
        results: verificationResults,
        passedCount,
        failedCount,
        totalCount: verificationResults.length,
        coverage: verificationResults.length > 0 ? passedCount / verificationResults.length : 0,
      },
      trustScore,
      mcpResponses: {
        shipgate: shipgateResult,
      },
    });
  }

  /**
   * Get the spec storage service
   */
  getSpecStorage(): SpecStorageService {
    return this.specStorage;
  }

  /**
   * Get the evidence storage service
   */
  getEvidenceStorage(): EvidenceStorageService {
    return this.evidenceStorage;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Detect if the input is an ISL spec or natural language
   */
  private detectIslSpec(input: string): boolean {
    const trimmed = input.trim();
    
    // Check for domain declaration
    if (/^domain\s+\w+/m.test(trimmed)) {
      return true;
    }
    
    // Check for common ISL keywords at start of lines
    const islKeywords = ['entity', 'behavior', 'type', 'enum', 'scenario', 'invariant', 'pre', 'post'];
    for (const keyword of islKeywords) {
      if (new RegExp(`^${keyword}\\s+`, 'm').test(trimmed)) {
        return true;
      }
    }
    
    // Check for ISL-specific syntax patterns
    if (trimmed.includes('input {') || trimmed.includes('output {')) {
      return true;
    }
    
    return false;
  }

  /**
   * Wrap a simple description as a minimal ISL spec
   */
  private wrapAsMinimalSpec(description: string): string {
    const safeName = description
      .split(/\s+/)
      .slice(0, 3)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('')
      .replace(/[^a-zA-Z0-9]/g, '') || 'GeneratedSpec';

    return `// Auto-generated from prompt
// TODO: Replace with actual ISL translation

domain ${safeName} {
  version: "0.1.0"

  // Original prompt:
  // ${description.split('\n').join('\n  // ')}

  // TODO: Define entities and behaviors based on the prompt
}
`;
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString().substring(11, 23);
    this.outputChannel?.appendLine(`[${timestamp}] ${message}`);
  }
}

// ============================================================================
// Export for convenience
// ============================================================================

export { SpecStorageService } from './SpecStorageService';
export { EvidenceStorageService } from './EvidenceStorageService';
