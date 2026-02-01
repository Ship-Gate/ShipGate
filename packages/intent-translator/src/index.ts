/**
 * Intent Translator
 * 
 * Converts natural language to ISL (Intent Specification Language)
 */

export {
  translate,
  detectLibraries,
  extractEntities,
  extractBehaviors,
  generateTemplate,
  type TranslationResult,
  type TranslatorOptions,
} from './translator.js';

export {
  ISL_LANGUAGE_REFERENCE,
  ISL_TRANSLATION_PROMPT,
} from './isl-reference.js';

export { ISL_AGENT_PROMPTS } from './agent-prompts.js';
