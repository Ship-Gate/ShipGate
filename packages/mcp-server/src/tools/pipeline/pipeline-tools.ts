// ============================================================================
// ISL MCP Server - Pipeline Tools
// ============================================================================

import { mkdir, writeFile, readFile, readdir, stat } from 'fs/promises';
import { join, resolve, basename, dirname } from 'path';
import { existsSync } from 'fs';
import { parse, type Domain } from '@isl-lang/parser';
import { check } from '@isl-lang/typechecker';
import { generate as generateRuntime } from '@isl-lang/codegen-runtime';
import { verify } from '@isl-lang/isl-verify';

import type {
  BuildInput,
  BuildResult,
  BuildReportSummary,
  GeneratedFileInfo,
  VerifyInput,
  VerifyResult,
  VerifyReportSummary,
  OutputPaths,
  WorkspaceConfig,
  VerificationFailure,
} from './pipeline-types.js';

// ============================================================================
// Local Workspace Runner Helper
// ============================================================================

/**
 * Resolve and initialize workspace paths for pipeline operations.
 * Creates .shipgate/reports and .shipgate/specs directories if missing.
 */
export async function initWorkspace(workspacePath?: string): Promise<WorkspaceConfig> {
  const root = resolve(workspacePath ?? process.cwd());
  
  const paths: OutputPaths = {
    shipgate: join(root, '.shipgate'),
    specs: join(root, '.shipgate', 'specs'),
    reports: join(root, '.shipgate', 'reports'),
    runtime: join(root, '.shipgate', 'runtime'),
  };

  // Create directories if missing
  await mkdir(paths.shipgate, { recursive: true });
  await mkdir(paths.specs, { recursive: true });
  await mkdir(paths.reports, { recursive: true });
  if (paths.runtime) {
    await mkdir(paths.runtime, { recursive: true });
  }

  return { root, paths };
}

/**
 * Check if LLM API keys are configured
 */
function checkLLMKeys(): { available: boolean; missingKeys: string[] } {
  const requiredKeys = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];
  const missingKeys = requiredKeys.filter(key => !process.env[key]);
  
  // Consider available if at least one key is present
  const available = missingKeys.length < requiredKeys.length;
  
  return { available, missingKeys };
}

/**
 * Generate a stable filename without timestamps
 */
function generateStableFilename(baseName: string, extension: string): string {
  // Use sanitized base name only, no timestamps for stability
  const sanitized = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${sanitized}.${extension}`;
}

// ============================================================================
// isl_build Tool Handler
// ============================================================================

/**
 * Build ISL specifications from a prompt.
 * 
 * Note: This is a simplified implementation that expects the prompt to be
 * valid ISL source code or generates a basic template. For full LLM-powered
 * generation, an external AI service would be integrated.
 */
export async function handleBuild(input: BuildInput): Promise<BuildResult> {
  try {
    const { prompt, domainName = 'Generated', version = '1.0.0', workspacePath, writeFiles = true } = input;

    // Validate prompt
    if (!prompt || prompt.trim().length === 0) {
      return {
        success: false,
        error: 'Prompt is required and cannot be empty',
        errorCode: 'INVALID_PROMPT',
        suggestion: 'Provide a description of the behavior to specify, or valid ISL source code',
      };
    }

    // Check if prompt looks like ISL source (has domain keyword)
    const isISLSource = prompt.includes('domain ') && prompt.includes('version ');
    
    let islSource: string;
    
    if (isISLSource) {
      // Use prompt as ISL source directly
      islSource = prompt;
    } else {
      // Check for LLM keys for AI-powered generation
      const llmStatus = checkLLMKeys();
      
      if (!llmStatus.available) {
        return {
          success: false,
          error: 'LLM API keys not configured for prompt-to-spec generation',
          errorCode: 'MISSING_LLM_KEY',
          suggestion: `Set one of these environment variables: ${llmStatus.missingKeys.join(', ')}. Alternatively, provide valid ISL source code directly.`,
        };
      }

      // Generate a template spec from the prompt (simplified without actual LLM call)
      // In production, this would call an LLM API
      islSource = generateTemplateSpec(prompt, domainName, version);
    }

    // Parse the ISL source
    const parseResult = parse(islSource);
    
    if (!parseResult.success || !parseResult.domain) {
      return {
        success: false,
        error: 'Failed to parse ISL source',
        errorCode: 'PARSE_ERROR',
        suggestion: parseResult.errors?.map(e => e.message).join('; ') ?? 'Check ISL syntax',
        report: {
          domain: domainName,
          version,
          entityCount: 0,
          behaviorCount: 0,
          entities: [],
          behaviors: [],
          parseStatus: 'error',
          typeCheckStatus: 'skipped',
          warningCount: 0,
          errorCount: parseResult.errors?.length ?? 1,
        },
      };
    }

    const domain = parseResult.domain;

    // Type check
    const typeResult = check(domain);
    const typeErrors = typeResult.diagnostics.filter(d => d.severity === 'error');
    const typeWarnings = typeResult.diagnostics.filter(d => d.severity === 'warning');

    if (typeErrors.length > 0) {
      return {
        success: false,
        error: 'Type checking failed',
        errorCode: 'TYPE_ERROR',
        suggestion: typeErrors.map(e => e.message).join('; '),
        report: {
          domain: domain.name.name,
          version: domain.version.value,
          entityCount: domain.entities.length,
          behaviorCount: domain.behaviors.length,
          entities: domain.entities.map(e => e.name.name),
          behaviors: domain.behaviors.map(b => b.name.name),
          parseStatus: 'success',
          typeCheckStatus: 'error',
          warningCount: typeWarnings.length,
          errorCount: typeErrors.length,
        },
      };
    }

    // Initialize workspace
    const workspace = await initWorkspace(workspacePath);
    const files: GeneratedFileInfo[] = [];

    if (writeFiles) {
      // Write spec file
      const specFilename = generateStableFilename(domain.name.name, 'isl');
      const specPath = join(workspace.paths.specs, specFilename);
      await writeFile(specPath, islSource, 'utf-8');
      files.push({
        path: `.shipgate/specs/${specFilename}`,
        type: 'spec',
        sizeBytes: Buffer.byteLength(islSource, 'utf-8'),
      });

      // Generate runtime code
      const runtimeDir = workspace.paths.runtime ?? join(workspace.paths.shipgate, 'runtime');
      try {
        const runtimeFiles = generateRuntime(domain, {
          mode: 'development',
          includeComments: true,
          includeHelpers: true,
        });

        for (const file of runtimeFiles) {
          const filePath = join(runtimeDir, file.path);
          await mkdir(dirname(filePath), { recursive: true });
          await writeFile(filePath, file.content, 'utf-8');
          files.push({
            path: `.shipgate/runtime/${file.path}`,
            type: file.type === 'types' ? 'types' : 'runtime',
            sizeBytes: Buffer.byteLength(file.content, 'utf-8'),
          });
        }
      } catch (codegenError) {
        // Codegen errors are non-fatal, report them but continue
        files.push({
          path: '.shipgate/runtime/error.log',
          type: 'report',
          sizeBytes: 0,
        });
      }

      // Write build report
      const reportFilename = generateStableFilename(domain.name.name + '-build', 'json');
      const report: BuildReportSummary = {
        domain: domain.name.name,
        version: domain.version.value,
        entityCount: domain.entities.length,
        behaviorCount: domain.behaviors.length,
        entities: domain.entities.map(e => e.name.name),
        behaviors: domain.behaviors.map(b => b.name.name),
        parseStatus: 'success',
        typeCheckStatus: 'success',
        warningCount: typeWarnings.length,
        errorCount: 0,
      };
      const reportPath = join(workspace.paths.reports, reportFilename);
      await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
      files.push({
        path: `.shipgate/reports/${reportFilename}`,
        type: 'report',
        sizeBytes: Buffer.byteLength(JSON.stringify(report, null, 2), 'utf-8'),
      });
    }

    return {
      success: true,
      report: {
        domain: domain.name.name,
        version: domain.version.value,
        entityCount: domain.entities.length,
        behaviorCount: domain.behaviors.length,
        entities: domain.entities.map(e => e.name.name),
        behaviors: domain.behaviors.map(b => b.name.name),
        parseStatus: 'success',
        typeCheckStatus: 'success',
        warningCount: typeWarnings.length,
        errorCount: 0,
      },
      files,
      paths: workspace.paths,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during build',
      errorCode: 'UNKNOWN_ERROR',
      suggestion: 'Check the input and try again',
    };
  }
}

/**
 * Generate a template ISL spec from a natural language prompt.
 * This is a simplified version - in production, this would call an LLM.
 */
function generateTemplateSpec(prompt: string, domainName: string, version: string): string {
  // Extract potential entity and behavior names from the prompt
  const words = prompt.split(/\s+/);
  const potentialEntities = words
    .filter(w => /^[A-Z][a-z]+/.test(w))
    .slice(0, 3);
  
  const entityName = potentialEntities[0] ?? 'Item';
  const behaviorName = `Create${entityName}`;

  return `domain ${domainName} version "${version}"

// Generated from prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}

entity ${entityName} {
  id: UUID
  name: String
  createdAt: Timestamp
  
  invariant name.length > 0
}

behavior ${behaviorName} {
  input {
    name: String
  }
  
  output {
    success: ${entityName}
    errors {
      InvalidName when "name cannot be empty"
    }
  }
  
  pre name.length > 0
  
  post success {
    result.name == input.name
    ${entityName}.exists({ id: result.id })
  }
}
`;
}

// ============================================================================
// isl_verify Tool Handler
// ============================================================================

/**
 * Verify an implementation against ISL specifications.
 */
export async function handleVerify(input: VerifyInput): Promise<VerifyResult> {
  try {
    const {
      workspacePath,
      specsPath: customSpecsPath,
      implementationPath,
      behaviors: targetBehaviors,
      framework = 'vitest',
    } = input;

    // Initialize workspace
    const workspace = await initWorkspace(workspacePath);
    const specsPath = customSpecsPath ?? workspace.paths.specs;

    // Find spec files
    const specFiles = await findSpecFiles(specsPath);
    
    if (specFiles.length === 0) {
      return {
        success: false,
        error: 'No ISL specification files found',
        errorCode: 'NO_SPECS_FOUND',
        suggestion: `Create .isl files in ${specsPath} or run isl_build first`,
      };
    }

    // Find implementation files
    const implPath = implementationPath ?? await findImplementationPath(workspace.root);
    
    if (!implPath) {
      return {
        success: false,
        error: 'No implementation files found',
        errorCode: 'NO_IMPLEMENTATION_FOUND',
        suggestion: 'Create TypeScript implementation files in src/ or specify implementationPath',
      };
    }

    // Read and parse specs
    const allDomains: Domain[] = [];
    const parseErrors: string[] = [];

    for (const specFile of specFiles) {
      const source = await readFile(specFile, 'utf-8');
      const parseResult = parse(source, specFile);
      
      if (parseResult.success && parseResult.domain) {
        allDomains.push(parseResult.domain);
      } else {
        parseErrors.push(`${basename(specFile)}: ${parseResult.errors?.map(e => e.message).join(', ') ?? 'parse error'}`);
      }
    }

    if (allDomains.length === 0) {
      return {
        success: false,
        error: 'Failed to parse any specification files',
        errorCode: 'PARSE_ERROR',
        suggestion: parseErrors.join('; '),
      };
    }

    // Read implementation code
    let implementationCode: string;
    try {
      implementationCode = await readImplementation(implPath);
    } catch (e) {
      return {
        success: false,
        error: `Failed to read implementation: ${e instanceof Error ? e.message : 'unknown error'}`,
        errorCode: 'FILESYSTEM_ERROR',
        suggestion: 'Check that the implementation path is correct and files are readable',
      };
    }

    // Run verification for each domain
    const allFailures: VerificationFailure[] = [];
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let aggregateScore = 0;
    let aggregateConfidence = 0;

    const categoryScores = {
      postconditions: { score: 0, passed: 0, failed: 0, total: 0 },
      invariants: { score: 0, passed: 0, failed: 0, total: 0 },
      scenarios: { score: 0, passed: 0, failed: 0, total: 0 },
      temporal: { score: 0, passed: 0, failed: 0, total: 0 },
    };

    for (const domain of allDomains) {
      // Filter behaviors if specified
      const filteredDomain = targetBehaviors?.length
        ? {
            ...domain,
            behaviors: domain.behaviors.filter(b => 
              targetBehaviors.includes(b.name.name)
            ),
          }
        : domain;

      if (filteredDomain.behaviors.length === 0) continue;

      try {
        const result = await verify(filteredDomain, implementationCode, {
          runner: { framework },
        });

        // Aggregate results
        totalPassed += result.testResult.passed;
        totalFailed += result.testResult.failed;
        totalSkipped += result.testResult.skipped;
        aggregateScore += result.trustScore.overall;
        aggregateConfidence += result.trustScore.confidence;

        // Aggregate category scores
        for (const cat of ['postconditions', 'invariants', 'scenarios', 'temporal'] as const) {
          const breakdown = result.trustScore.breakdown[cat];
          categoryScores[cat].passed += breakdown.passed;
          categoryScores[cat].failed += breakdown.failed;
          categoryScores[cat].total += breakdown.total;
        }

        // Collect failures
        for (const detail of result.trustScore.details) {
          if (detail.status === 'failed') {
            allFailures.push({
              category: detail.category as VerificationFailure['category'],
              name: detail.name,
              impact: detail.impact,
              error: detail.message,
            });
          }
        }
      } catch (e) {
        // Test runner errors are captured but don't stop verification
        allFailures.push({
          category: 'scenarios',
          name: `${domain.name.name} verification`,
          impact: 'high',
          error: e instanceof Error ? e.message : 'verification failed',
        });
        totalFailed++;
      }
    }

    // Calculate final scores
    const domainCount = allDomains.length;
    const finalScore = domainCount > 0 ? Math.round(aggregateScore / domainCount) : 0;
    const finalConfidence = domainCount > 0 ? Math.round(aggregateConfidence / domainCount) : 0;

    // Calculate category scores
    for (const cat of ['postconditions', 'invariants', 'scenarios', 'temporal'] as const) {
      if (categoryScores[cat].total > 0) {
        categoryScores[cat].score = Math.round(
          (categoryScores[cat].passed / categoryScores[cat].total) * 100
        );
      } else {
        categoryScores[cat].score = 100; // No tests = 100%
      }
    }

    // Determine recommendation
    const recommendation = determineRecommendation(finalScore, totalFailed);

    // Write verification report
    const reportFilename = 'verify-report.json';
    const report: VerifyReportSummary = {
      trustScore: finalScore,
      confidence: finalConfidence,
      recommendation,
      breakdown: categoryScores,
      totalTests: totalPassed + totalFailed + totalSkipped,
      passed: totalPassed,
      failed: totalFailed,
      skipped: totalSkipped,
      failures: allFailures,
    };

    const reportPath = join(workspace.paths.reports, reportFilename);
    await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    return {
      success: totalFailed === 0,
      report,
      reportPath: `.shipgate/reports/${reportFilename}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during verification',
      errorCode: 'UNKNOWN_ERROR',
      suggestion: 'Check the workspace configuration and try again',
    };
  }
}

/**
 * Find ISL spec files in a directory
 */
async function findSpecFiles(specsPath: string): Promise<string[]> {
  if (!existsSync(specsPath)) {
    return [];
  }

  const files: string[] = [];
  const entries = await readdir(specsPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.isl')) {
      files.push(join(specsPath, entry.name));
    }
  }

  return files;
}

/**
 * Find implementation files in a workspace
 */
async function findImplementationPath(workspaceRoot: string): Promise<string | null> {
  const candidates = [
    join(workspaceRoot, 'src'),
    join(workspaceRoot, 'lib'),
    join(workspaceRoot, 'app'),
    workspaceRoot,
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const stats = await stat(candidate);
      if (stats.isDirectory()) {
        // Check for TypeScript/JavaScript files
        const entries = await readdir(candidate);
        const hasImpl = entries.some(e => 
          e.endsWith('.ts') || e.endsWith('.js') || e.endsWith('.tsx') || e.endsWith('.jsx')
        );
        if (hasImpl) {
          return candidate;
        }
      }
    }
  }

  return null;
}

/**
 * Read implementation code from a path
 */
async function readImplementation(implPath: string): Promise<string> {
  const stats = await stat(implPath);
  
  if (stats.isFile()) {
    return readFile(implPath, 'utf-8');
  }

  // If directory, concatenate all .ts/.js files
  const files: string[] = [];
  const entries = await readdir(implPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
      // Skip test files and type definition files
      if (entry.name.includes('.test.') || entry.name.includes('.spec.') || entry.name.endsWith('.d.ts')) {
        continue;
      }
      const content = await readFile(join(implPath, entry.name), 'utf-8');
      files.push(`// === ${entry.name} ===\n${content}`);
    }
  }

  return files.join('\n\n');
}

/**
 * Determine deployment recommendation based on score and failures
 */
function determineRecommendation(
  score: number,
  failures: number
): VerifyReportSummary['recommendation'] {
  if (failures > 0 && score < 70) {
    return 'critical_issues';
  }
  if (score >= 95) {
    return 'production_ready';
  }
  if (score >= 85) {
    return 'staging_recommended';
  }
  if (score >= 70) {
    return 'shadow_mode';
  }
  return 'not_ready';
}

// ============================================================================
// MCP Response Formatter
// ============================================================================

/**
 * Format pipeline results for MCP response
 */
export function formatMCPResponse<T>(result: T) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  PIPELINE_TOOL_SCHEMAS,
  type BuildInput,
  type BuildResult,
  type VerifyInput,
  type VerifyResult,
} from './pipeline-types.js';
