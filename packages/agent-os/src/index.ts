/**
 * Agent OS - Orchestration System for IntentOS
 * 
 * The intelligent backbone that:
 * 1. Triages user requests
 * 2. Translates plain English to ISL
 * 3. Plans execution strategies
 * 4. Coordinates specialized agents
 * 5. Verifies results against specs
 */

export {
  Orchestrator,
  type RequestScope,
  type RequestType,
  type TriageResult,
  type PlanStep,
  type ExecutionPlan,
  type ExecutionResult,
  type GeneratedFile,
  type VerificationResult,
  type OrchestratorResult,
  type OrchestratorOptions,
  type OrchestratorEvent,
} from './orchestrator.js';

// Re-export agent prompts for use by LangChain
export { ISL_AGENT_PROMPTS } from '@isl-lang/intent-translator';

/**
 * Quick helper to run the full pipeline
 */
export async function runPipeline(
  request: string,
  options?: import('./orchestrator.js').OrchestratorOptions
): Promise<import('./orchestrator.js').OrchestratorResult> {
  const { Orchestrator } = await import('./orchestrator.js');
  const orchestrator = new Orchestrator(options);
  return orchestrator.run(request);
}
