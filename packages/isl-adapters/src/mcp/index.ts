/**
 * ISL Adapters - MCP Integration
 * 
 * @module @isl-lang/adapters/mcp
 */

export {
  firewallTools,
  firewallEvaluateTool,
  firewallQuickCheckTool,
  firewallStatusTool,
  firewallSetModeTool,
  handleFirewallEvaluate,
  handleFirewallQuickCheck,
  handleFirewallStatus,
} from './firewall-tools.js';

export {
  gateTools,
  gateCheckTool,
  gateQuickCheckTool,
  handleGateCheck,
  handleGateQuickCheck,
} from './gate-tools.js';

export type {
  MCPTool,
  MCPToolResult,
  FirewallEvaluateInput,
  FirewallQuickCheckInput,
  GateCheckInput,
} from './types.js';

import { firewallTools } from './firewall-tools.js';
import { gateTools } from './gate-tools.js';

/**
 * All available MCP tools
 */
export const allTools = [...firewallTools, ...gateTools];
