/**
 * ISL Adapters - MCP Types
 * 
 * Types for Model Context Protocol integration.
 * 
 * @module @isl-lang/adapters/mcp
 */

/**
 * MCP Tool definition
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

/**
 * MCP Tool result
 */
export interface MCPToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

/**
 * Firewall evaluate input
 */
export interface FirewallEvaluateInput {
  content: string;
  filePath: string;
  intent?: string;
}

/**
 * Firewall quick check input
 */
export interface FirewallQuickCheckInput {
  content: string;
  filePath: string;
}

/**
 * Gate check input
 */
export interface GateCheckInput {
  projectRoot: string;
  specPattern?: string;
  changedOnly?: boolean;
}
