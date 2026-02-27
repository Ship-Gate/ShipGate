# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createAgent, getAgent, updateAgent, deleteAgent, listAgents, runAgent, getAgentRun, cancelAgentRun, listAgentRuns, defineTool, createToolCall, createToolResult, createBufferMemory, createWindowMemory, ToolExecutor
# dependencies: 

domain Agents {
  version: "1.0.0"

  type ToolExecutor = String

  invariants exports_present {
    - true
  }
}
