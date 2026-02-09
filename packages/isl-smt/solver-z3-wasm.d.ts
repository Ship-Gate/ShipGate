declare module '@isl-lang/solver-z3-wasm' {
  export function isZ3WasmAvailable(): Promise<boolean>;
  export function createWasmSolver(options: {
    timeout?: number;
    produceModels?: boolean;
    verbose?: boolean;
    randomSeed?: number;
  }): {
    checkSat: (formula: unknown, declarations: unknown[]) => Promise<unknown>;
  };
}
