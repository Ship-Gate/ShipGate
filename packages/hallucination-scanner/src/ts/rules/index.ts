/**
 * Hallucination Rules — Built-in and custom rule exports
 * @module @isl-lang/hallucination-scanner/ts/rules
 */

export {
  getBuiltinRules,
  ALL_RULES,
  phantomApiRule,
  envVarsRule,
  fileReferencesRule,
  confidentButWrongRule,
  copyPasteArtifactsRule,
  staleDeprecatedRule,
} from './builtin.js';
