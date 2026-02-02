/**
 * Counter Implementation
 * 
 * Reference implementation for mutation testing.
 */

// Validation function - target for bypass-precondition mutation
function validateInput(amount: number): boolean {
  return amount > 0 && Number.isInteger(amount);
}

// Boundary check - target for change-comparator mutation  
function checkBoundary(value: number): boolean {
  return value > 0;
}

// Main increment function
export function increment(counterId: string, amount: number): { 
  id: string; 
  value: number; 
  updated_at: Date;
} {
  // Assertion - target for remove-assert mutation
  assert(validateInput(amount), 'Amount must be a positive integer');
  
  // Simulate fetching current counter value
  const currentValue = getCounterValue(counterId);
  
  // Calculate new value
  const newValue = currentValue + amount;
  
  // Check boundary conditions
  if (!checkBoundary(newValue)) {
    throw new CounterError('OVERFLOW', 'Value would exceed bounds');
  }
  
  // Update and return
  return {
    id: counterId,
    value: newValue,
    updated_at: new Date(),
  };
}

// Decrement function
export function decrement(counterId: string, amount: number): {
  id: string;
  value: number;
  updated_at: Date;
} {
  assert(validateInput(amount), 'Amount must be a positive integer');
  
  const currentValue = getCounterValue(counterId);
  
  if (currentValue < amount) {
    throw new CounterError('UNDERFLOW', 'Cannot decrement below zero');
  }
  
  const newValue = currentValue - amount;
  
  return {
    id: counterId,
    value: newValue,
    updated_at: new Date(),
  };
}

// Helper: Get counter value (simulated store)
function getCounterValue(counterId: string): number {
  // In a real implementation, this would fetch from a store
  // For testing, return a default value
  if (!counterId) {
    throw new CounterError('COUNTER_NOT_FOUND', 'Counter ID is required');
  }
  return 10; // Simulated current value
}

// Custom assertion helper
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new CounterError('INVALID_AMOUNT', message);
  }
}

// Custom error class
export class CounterError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'CounterError';
  }
}
