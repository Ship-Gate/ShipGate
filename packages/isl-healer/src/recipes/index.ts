/**
 * Fix Recipes - Built-in recipes for common violations
 *
 * @module @isl-lang/healer/recipes
 */

import type { FixRecipe } from '../types';

// Re-export from recipe-registry
export { BUILTIN_RECIPES, FixRecipeRegistryImpl } from '../recipe-registry';
import { BUILTIN_RECIPES } from '../recipe-registry';

// ============================================================================
// Recipe Lookup Helpers
// ============================================================================

/**
 * Get all built-in recipe IDs
 */
export function getBuiltinRecipeIds(): string[] {
  return BUILTIN_RECIPES.map(r => r.ruleId);
}

/**
 * Get a built-in recipe by rule ID
 */
export function getBuiltinRecipe(ruleId: string): FixRecipe | undefined {
  return BUILTIN_RECIPES.find(r => r.ruleId === ruleId);
}

// ============================================================================
// Named Recipe Exports (aliases for common recipes)
// ============================================================================

export const RateLimitRecipe = BUILTIN_RECIPES.find(r => r.ruleId === 'intent/rate-limit-required');
export const AuditRecipe = BUILTIN_RECIPES.find(r => r.ruleId === 'intent/audit-required');
export const NoPIILoggingRecipe = BUILTIN_RECIPES.find(r => r.ruleId === 'intent/no-pii-logging');
export const PIIConsoleRecipe = BUILTIN_RECIPES.find(r => r.ruleId === 'intent/no-pii-console');
export const InputValidationRecipe = BUILTIN_RECIPES.find(r => r.ruleId === 'intent/input-validation');
export const IdempotencyRecipe = BUILTIN_RECIPES.find(r => r.ruleId === 'intent/idempotency-key-required');
export const ServerSideAmountRecipe = BUILTIN_RECIPES.find(r => r.ruleId === 'intent/server-side-amount');
export const EncryptionRecipe = BUILTIN_RECIPES.find(r => r.ruleId === 'intent/encryption-required');
export const AuthRequiredRecipe = BUILTIN_RECIPES.find(r => r.ruleId === 'intent/auth-required');
export const NoStubbedHandlersRecipe = BUILTIN_RECIPES.find(r => r.ruleId === 'intent/no-stubbed-handlers');
