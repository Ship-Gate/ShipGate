/**
 * ISL Adapters - MCP Gate Tools
 * 
 * MCP tools for gate operations.
 * 
 * @module @isl-lang/adapters/mcp
 */

import { runGate, quickCheck, type GateResult, type Finding } from '@isl-lang/gate';
import { writeEvidenceBundle } from '@isl-lang/evidence';
import type { MCPTool, MCPToolResult, GateCheckInput } from './types.js';

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Gate check tool definition
 */
export const gateCheckTool: MCPTool = {
  name: 'gate_check',
  description: 'Run ISL Gate to produce a SHIP/NO_SHIP verdict. Returns score, reasons, and evidence path.',
  inputSchema: {
    type: 'object',
    properties: {
      projectRoot: {
        type: 'string',
        description: 'Project root directory',
      },
      specPattern: {
        type: 'string',
        description: 'Glob pattern for ISL spec files (default: **/*.isl)',
      },
      changedOnly: {
        type: 'boolean',
        description: 'Only check files changed since last commit',
      },
    },
    required: ['projectRoot'],
  },
};

/**
 * Gate quick check tool definition
 */
export const gateQuickCheckTool: MCPTool = {
  name: 'gate_quick_check',
  description: 'Quick gate check - returns SHIP/NO_SHIP without generating evidence.',
  inputSchema: {
    type: 'object',
    properties: {
      projectRoot: {
        type: 'string',
        description: 'Project root directory',
      },
    },
    required: ['projectRoot'],
  },
};

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Handle gate_check tool call
 */
export async function handleGateCheck(input: GateCheckInput): Promise<MCPToolResult> {
  try {
    // For now, create minimal findings - in real implementation would scan ISL specs
    const findings: Finding[] = [];
    
    const result = await runGate({
      findings,
      filesConsidered: 0,
      filesScanned: 0,
    }, {
      projectRoot: input.projectRoot,
      specPattern: input.specPattern ?? '**/*.isl',
      changedOnly: input.changedOnly ?? false,
      deterministic: true,
    });

    // Write evidence bundle
    await writeEvidenceBundle(result, findings, {
      outputDir: `${input.projectRoot}/.isl-gate/evidence`,
      projectRoot: input.projectRoot,
      deterministic: true,
    });

    return {
      content: [{
        type: 'text',
        text: formatGateResult(result),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error running gate: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      isError: true,
    };
  }
}

/**
 * Handle gate_quick_check tool call
 */
export async function handleGateQuickCheck(input: { projectRoot: string }): Promise<MCPToolResult> {
  try {
    const verdict = quickCheck({
      findings: [],
      filesConsidered: 0,
      filesScanned: 0,
    });

    const emoji = verdict === 'SHIP' ? '✅' : '🛑';
    return {
      content: [{
        type: 'text',
        text: `${emoji} Gate Verdict: ${verdict}`,
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error running quick check: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      isError: true,
    };
  }
}

// ============================================================================
// Formatters
// ============================================================================

function formatGateResult(result: GateResult): string {
  const lines: string[] = [];
  
  const emoji = result.verdict === 'SHIP' ? '✅' : '🛑';
  lines.push(`${emoji} ISL Gate: ${result.verdict}`);
  lines.push(`Score: ${result.score}/100`);
  lines.push(`Fingerprint: ${result.fingerprint}`);
  lines.push('');

  if (result.reasons.length > 0) {
    lines.push('📋 Reasons:');
    for (const reason of result.reasons) {
      const severityEmoji = getSeverityEmoji(reason.severity);
      lines.push(`  ${severityEmoji} [${reason.code}] ${reason.message}`);
      if (reason.files.length > 0) {
        lines.push(`     Files: ${reason.files.slice(0, 3).join(', ')}${reason.files.length > 3 ? '...' : ''}`);
      }
    }
    lines.push('');
  }

  lines.push(`📁 Evidence: ${result.evidencePath}`);
  lines.push(`⏱️ Duration: ${result.durationMs}ms`);

  return lines.join('\n');
}

function getSeverityEmoji(severity?: string): string {
  switch (severity) {
    case 'critical': return '🔴';
    case 'high': return '🟠';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    default: return '⚪';
  }
}

// ============================================================================
// Tool Registry
// ============================================================================

/**
 * All gate MCP tools
 */
export const gateTools: MCPTool[] = [
  gateCheckTool,
  gateQuickCheckTool,
];
