/**
 * ISL Adapters - MCP Firewall Tools
 * 
 * MCP tools for firewall operations.
 * 
 * @module @isl-lang/adapters/mcp
 */

import { createAgentFirewall, createAllowlistManager, type FirewallResult } from '@isl-lang/firewall';
import type { MCPTool, MCPToolResult, FirewallEvaluateInput, FirewallQuickCheckInput } from './types.js';

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Firewall evaluate tool definition
 */
export const firewallEvaluateTool: MCPTool = {
  name: 'firewall_evaluate',
  description: 'Evaluate code content against firewall policies. Returns detailed analysis of claims, evidence, and policy violations.',
  inputSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The code content to evaluate',
      },
      filePath: {
        type: 'string',
        description: 'The file path for context',
      },
      intent: {
        type: 'string',
        description: 'Optional intent/purpose of the change',
      },
    },
    required: ['content', 'filePath'],
  },
};

/**
 * Firewall quick check tool definition
 */
export const firewallQuickCheckTool: MCPTool = {
  name: 'firewall_quick_check',
  description: 'Quick check if code content would be allowed. Returns simple allow/deny decision.',
  inputSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The code content to check',
      },
      filePath: {
        type: 'string',
        description: 'The file path for context',
      },
    },
    required: ['content', 'filePath'],
  },
};

/**
 * Firewall status tool definition
 */
export const firewallStatusTool: MCPTool = {
  name: 'firewall_status',
  description: 'Get current firewall status including mode and enabled policies.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

/**
 * Firewall set mode tool definition
 */
export const firewallSetModeTool: MCPTool = {
  name: 'firewall_set_mode',
  description: 'Set the firewall operating mode.',
  inputSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        description: 'The mode to set',
        enum: ['observe', 'enforce', 'lockdown'],
      },
    },
    required: ['mode'],
  },
};

/**
 * Firewall apply allowlist tool definition
 * Apply a quick fix by adding route/env to allowlist, then re-run gate.
 */
export const firewallApplyAllowlistTool: MCPTool = {
  name: 'firewall_apply_allowlist',
  description: 'Apply a quick fix: add route prefix or env var to the firewall allowlist. Use when firewall_evaluate returns quickFixes of type allow_pattern. Then re-run firewall_evaluate to verify.',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Type of allowlist entry',
        enum: ['route', 'env'],
      },
      value: {
        type: 'string',
        description: 'Value to add (e.g. route prefix like /api/users/ or env var name)',
      },
    },
    required: ['type', 'value'],
  },
};

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Handle firewall_evaluate tool call
 */
export async function handleFirewallEvaluate(
  input: FirewallEvaluateInput,
  projectRoot: string
): Promise<MCPToolResult> {
  const firewall = createAgentFirewall({
    mode: 'observe',
    projectRoot,
  });

  try {
    const result = await firewall.evaluate({
      content: input.content,
      filePath: input.filePath,
    });

    return {
      content: [{
        type: 'text',
        text: formatFirewallResult(result),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error evaluating content: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      isError: true,
    };
  }
}

/**
 * Handle firewall_quick_check tool call
 */
export async function handleFirewallQuickCheck(
  input: FirewallQuickCheckInput,
  projectRoot: string
): Promise<MCPToolResult> {
  const firewall = createAgentFirewall({
    mode: 'observe',
    projectRoot,
  });

  try {
    const fullResult = await firewall.evaluate({
      content: input.content,
      filePath: input.filePath,
    });
    const allowed = fullResult.allowed;
    const emoji = allowed ? '✅' : '🛑';
    let text = `${emoji} ${allowed ? 'ALLOWED' : 'BLOCKED'}: ${fullResult.violations.length > 0 ? `${fullResult.violations.length} violation(s)` : 'All checks passed'}`;
    if (!allowed && fullResult.violations.length > 0) {
      text += '\n💡 Run `isl heal ./src` to auto-fix many violations, then re-gate.';
    }
    return {
      content: [{ type: 'text', text }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error checking content: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      isError: true,
    };
  }
}

/**
 * Handle firewall_apply_allowlist tool call
 */
export async function handleFirewallApplyAllowlist(
  input: { type: 'route' | 'env'; value: string },
  projectRoot: string
): Promise<MCPToolResult> {
  try {
    const manager = createAllowlistManager(projectRoot);
    await manager.load();

    if (input.type === 'route') {
      await manager.addRoutePrefix(input.value);
      return {
        content: [{
          type: 'text',
          text: `✅ Added route prefix "${input.value}" to allowlist. Re-run firewall_evaluate to verify.`,
        }],
      };
    }
    if (input.type === 'env') {
      await manager.addEnvVar(input.value);
      return {
        content: [{
          type: 'text',
          text: `✅ Added env var "${input.value}" to allowlist. Re-run firewall_evaluate to verify.`,
        }],
      };
    }

    return {
      content: [{ type: 'text', text: `Unknown type: ${input.type}. Use 'route' or 'env'.` }],
      isError: true,
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error applying allowlist: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      isError: true,
    };
  }
}

/**
 * Handle firewall_status tool call
 */
export function handleFirewallStatus(projectRoot: string): MCPToolResult {
  const firewall = createAgentFirewall({ projectRoot });
  const status = firewall.getStatus();

  return {
    content: [{
      type: 'text',
      text: [
        '🔥 Firewall Status',
        `Mode: ${status.mode}`,
        `Policies: ${status.policies.join(', ')}`,
        `Project: ${status.projectRoot}`,
      ].join('\n'),
    }],
  };
}

// ============================================================================
// Formatters
// ============================================================================

/** Healer recipe rule IDs (fix-then-re-gate flow) */
const HEALER_RULE_IDS = new Set([
  'intent/rate-limit-required',
  'intent/audit-required',
  'intent/no-pii-logging',
  'intent/input-validation',
  'intent/encryption-required',
  'quality/no-stubbed-handlers',
  'quality/validation-before-use',
  'auth/bypass-detected',
  'auth/hardcoded-credentials',
  'pii/console-in-production',
  'pii/logged-sensitive-data',
]);

function formatFirewallResult(result: FirewallResult): string {
  const lines: string[] = [];

  const emoji = result.allowed ? '✅' : '🛑';
  lines.push(`${emoji} Firewall Result: ${result.allowed ? 'ALLOWED' : 'BLOCKED'}`);
  lines.push(`Mode: ${result.mode}`);
  lines.push('');

  lines.push('📊 Statistics:');
  lines.push(`  Claims extracted: ${result.stats.claimsExtracted}`);
  lines.push(`  Evidence found: ${result.stats.evidenceFound}`);
  lines.push(`  Evidence missing: ${result.stats.evidenceMissing}`);
  lines.push(`  Violations: ${result.stats.violationsTotal}`);
  lines.push(`  - Hard blocks: ${result.stats.hardBlocks}`);
  lines.push(`  - Soft blocks: ${result.stats.softBlocks}`);
  lines.push(`  - Warnings: ${result.stats.warnings}`);
  lines.push('');

  if (result.violations.length > 0) {
    lines.push('🚨 Violations:');
    for (const v of result.violations) {
      const tierEmoji = v.tier === 'hard_block' ? '🛑' : v.tier === 'soft_block' ? '⚠️' : 'ℹ️';
      lines.push(`  ${tierEmoji} [${v.policyId}] ${v.message}`);
      if (v.suggestion) {
        lines.push(`     Fix: ${v.suggestion}`);
      }
      if (v.quickFixes?.length) {
        for (const qf of v.quickFixes) {
          lines.push(`     Quick fix: ${qf.label}`);
        }
      }
    }
    lines.push('');

    // Fix-then-re-gate hint when blocked and healer may help
    const hasHealerRules = result.violations.some((v) => HEALER_RULE_IDS.has(v.policyId));
    if (!result.allowed && (hasHealerRules || result.stats.hardBlocks > 0)) {
      lines.push('💡 Fix-then-re-gate:');
      lines.push('   Run `isl heal ./src` or `pnpm isl heal ./src` to auto-fix many violations.');
      lines.push('   Then re-run the firewall to verify.');
      lines.push('');
    }
  }

  lines.push(`⏱️ Duration: ${result.durationMs}ms`);

  return lines.join('\n');
}

// ============================================================================
// Tool Registry
// ============================================================================

/**
 * All firewall MCP tools
 */
export const firewallTools: MCPTool[] = [
  firewallEvaluateTool,
  firewallQuickCheckTool,
  firewallStatusTool,
  firewallSetModeTool,
  firewallApplyAllowlistTool,
];
