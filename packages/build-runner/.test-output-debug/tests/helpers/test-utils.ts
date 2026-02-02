// Test utilities for Minimal

export function createTestInputForCreateItem(): CreateItemInput {
  return {
    name: 'test-value'
  };
}

export function createInvalidInputForCreateItem(): CreateItemInput {
  return {
    name: ''
  };
}

export function captureState(): Record<string, unknown> {
  return {
    timestamp: Date.now(),
    // Add entity state captures here
  };
}

export function createTestInput(): unknown {
  return {};
}

export function createInvalidInput(): unknown {
  return {};
}

export function createInputThatCausesError(): unknown {
  return {};
}