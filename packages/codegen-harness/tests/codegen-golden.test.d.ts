/**
 * Codegen Golden Output Tests
 *
 * For each generator × each sample ISL file:
 *   1. Parse the ISL
 *   2. Generate into memory
 *   3. Compare byte-for-byte against samples/golden/<generator>/<file>
 *
 * If a golden file is missing the test fails with instructions to run
 *   pnpm --filter @isl-lang/codegen-harness update-golden
 */
export {};
