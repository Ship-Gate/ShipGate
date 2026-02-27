/**
 * Prompts Module
 * 
 * System and behavior-specific prompts for AI code generation.
 */

export {
  getSystemPrompt,
  getCompleteSystemPrompt,
  getLanguageAdditions,
  getTypeScriptAdditions,
  getJavaScriptAdditions,
  getPythonAdditions,
  type SystemPromptOptions,
} from './system.js';

export {
  generateBehaviorPrompt,
  generateTypesFromDomain,
  expressionToReadable,
  typeToString,
  type BehaviorPromptContext,
} from './behavior.js';
