// ============================================================================
// ISL Standard Library - AI Agents
// @isl-lang/stdlib-ai
// ============================================================================

import {
  type Agent,
  type AgentRun,
  type AgentStep,
  type RunAgentInput,
  type RunAgentOutput,
  type ToolDefinition,
  type ToolCall,
  type ToolResult,
  type Message,
  type ProviderConfig,
  AgentStatus,
  StepType,
  MessageRole,
  AIError,
  AIErrorCode,
} from './types';

// ============================================================================
// Agent Store (In-Memory)
// ============================================================================

const agentStore = new Map<string, Agent>();
const runStore = new Map<string, AgentRun>();

// ============================================================================
// Agent Management
// ============================================================================

/**
 * Create a new agent
 */
export function createAgent(config: Omit<Agent, 'id'>): Agent {
  const agent: Agent = {
    ...config,
    id: generateAgentId(),
  };
  agentStore.set(agent.id, agent);
  return agent;
}

/**
 * Get an agent by ID
 */
export function getAgent(agentId: string): Agent | undefined {
  return agentStore.get(agentId);
}

/**
 * Update an agent
 */
export function updateAgent(agentId: string, updates: Partial<Agent>): Agent {
  const agent = agentStore.get(agentId);
  if (!agent) {
    throw new AIError(AIErrorCode.AGENT_NOT_FOUND, `Agent not found: ${agentId}`);
  }
  const updated = { ...agent, ...updates, id: agentId };
  agentStore.set(agentId, updated);
  return updated;
}

/**
 * Delete an agent
 */
export function deleteAgent(agentId: string): boolean {
  return agentStore.delete(agentId);
}

/**
 * List all agents
 */
export function listAgents(): Agent[] {
  return Array.from(agentStore.values());
}

// ============================================================================
// Agent Execution
// ============================================================================

/**
 * Tool executor function type
 */
export type ToolExecutor = (
  name: string,
  args: Record<string, unknown>
) => Promise<unknown>;

/**
 * Run an agent task
 */
export async function runAgent(
  input: RunAgentInput,
  toolExecutor: ToolExecutor,
  config?: ProviderConfig
): Promise<RunAgentOutput> {
  const agent = agentStore.get(input.agent_id);
  if (!agent) {
    throw new AIError(AIErrorCode.AGENT_NOT_FOUND, `Agent not found: ${input.agent_id}`);
  }

  // Create agent run
  const run: AgentRun = {
    id: generateRunId(),
    agent_id: agent.id,
    input: input.input,
    status: AgentStatus.RUNNING,
    steps: [],
    started_at: new Date(),
    total_tokens: 0,
  };
  runStore.set(run.id, run);

  try {
    // Execute agent loop
    const result = await executeAgentLoop(agent, run, input, toolExecutor, config);
    
    // Update run status
    run.status = AgentStatus.COMPLETED;
    run.output = result.output;
    run.completed_at = new Date();
    run.total_tokens = result.usage.total_tokens;
    runStore.set(run.id, run);

    return result;
  } catch (error) {
    run.status = AgentStatus.FAILED;
    run.error = error instanceof Error ? error.message : String(error);
    run.completed_at = new Date();
    runStore.set(run.id, run);
    throw error;
  }
}

/**
 * Execute the agent reasoning loop
 */
async function executeAgentLoop(
  agent: Agent,
  run: AgentRun,
  input: RunAgentInput,
  _toolExecutor: ToolExecutor,
  _config?: ProviderConfig
): Promise<RunAgentOutput> {
  const steps: AgentStep[] = [];
  let totalTokens = 0;
  let iteration = 0;

  // Build conversation
  const messages: Message[] = [
    { role: MessageRole.SYSTEM, content: agent.system_prompt },
    { role: MessageRole.USER, content: input.input },
  ];

  if (input.context) {
    messages.push({
      role: MessageRole.SYSTEM,
      content: `Context: ${JSON.stringify(input.context)}`,
    });
  }

  while (iteration < agent.max_iterations) {
    iteration++;

    // Think step - this is a placeholder
    const thinkStep: AgentStep = {
      index: steps.length,
      type: StepType.THINK,
      timestamp: new Date(),
      thought: `[Iteration ${iteration}] Analyzing the request...`,
      tokens_used: 50,
    };
    steps.push(thinkStep);
    totalTokens += thinkStep.tokens_used;

    // For now, we'll simulate a simple response after one iteration
    // Real implementation would call LLM and parse tool calls
    if (iteration === 1) {
      const respondStep: AgentStep = {
        index: steps.length,
        type: StepType.RESPOND,
        timestamp: new Date(),
        response: `[Placeholder agent response for: "${input.input}"]`,
        tokens_used: 100,
      };
      steps.push(respondStep);
      totalTokens += respondStep.tokens_used;

      return {
        run_id: run.id,
        output: respondStep.response || '',
        steps,
        usage: {
          input_tokens: Math.floor(totalTokens * 0.6),
          output_tokens: Math.floor(totalTokens * 0.4),
          total_tokens: totalTokens,
        },
      };
    }
  }

  // Max iterations reached
  run.status = AgentStatus.MAX_ITERATIONS;
  throw new AIError(
    AIErrorCode.MAX_ITERATIONS_REACHED,
    `Agent reached max iterations (${agent.max_iterations})`
  );
}

/**
 * Get an agent run by ID
 */
export function getAgentRun(runId: string): AgentRun | undefined {
  return runStore.get(runId);
}

/**
 * Cancel an agent run
 */
export function cancelAgentRun(runId: string): boolean {
  const run = runStore.get(runId);
  if (!run || run.status !== AgentStatus.RUNNING) {
    return false;
  }
  run.status = AgentStatus.CANCELLED;
  run.completed_at = new Date();
  runStore.set(runId, run);
  return true;
}

/**
 * List runs for an agent
 */
export function listAgentRuns(agentId: string): AgentRun[] {
  return Array.from(runStore.values()).filter(run => run.agent_id === agentId);
}

// ============================================================================
// Tool Helpers
// ============================================================================

/**
 * Create a tool definition
 */
export function defineTool(
  name: string,
  description: string,
  parameters: Record<string, unknown>
): ToolDefinition {
  return {
    name,
    description,
    parameters,
  };
}

/**
 * Create a tool call
 */
export function createToolCall(
  name: string,
  args: Record<string, unknown>
): ToolCall {
  return {
    id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    name,
    arguments: args,
  };
}

/**
 * Create a tool result
 */
export function createToolResult(
  toolCallId: string,
  content: unknown,
  isError = false
): ToolResult {
  return {
    tool_call_id: toolCallId,
    content: typeof content === 'string' ? content : JSON.stringify(content),
    is_error: isError,
  };
}

// ============================================================================
// Memory Helpers
// ============================================================================

/**
 * Simple buffer memory - keeps last N messages
 */
export function createBufferMemory(maxMessages: number): {
  add: (message: Message) => void;
  get: () => Message[];
  clear: () => void;
} {
  const messages: Message[] = [];
  return {
    add: (message: Message) => {
      messages.push(message);
      while (messages.length > maxMessages) {
        messages.shift();
      }
    },
    get: () => [...messages],
    clear: () => {
      messages.length = 0;
    },
  };
}

/**
 * Window memory - keeps messages within token limit
 */
export function createWindowMemory(maxTokens: number): {
  add: (message: Message, tokens: number) => void;
  get: () => Message[];
  clear: () => void;
} {
  const messages: Array<{ message: Message; tokens: number }> = [];
  let totalTokens = 0;

  return {
    add: (message: Message, tokens: number) => {
      messages.push({ message, tokens });
      totalTokens += tokens;
      while (totalTokens > maxTokens && messages.length > 0) {
        const removed = messages.shift();
        if (removed) {
          totalTokens -= removed.tokens;
        }
      }
    },
    get: () => messages.map(m => m.message),
    clear: () => {
      messages.length = 0;
      totalTokens = 0;
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateAgentId(): string {
  return `agent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  createAgent,
  getAgent,
  updateAgent,
  deleteAgent,
  listAgents,
  runAgent,
  getAgentRun,
  cancelAgentRun,
  listAgentRuns,
  defineTool,
  createToolCall,
  createToolResult,
  createBufferMemory,
  createWindowMemory,
};
