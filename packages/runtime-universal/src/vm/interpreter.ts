/**
 * ISL Bytecode Interpreter
 * Executes ISL bytecode in a virtual machine
 */

import { Opcode, Instruction, BytecodeProgram } from './bytecode';

/**
 * Interpreter configuration
 */
export interface InterpreterConfig {
  maxStackSize: number;
  maxCallDepth: number;
  enableDebug: boolean;
  enableProfiling: boolean;
}

/**
 * Stack frame for function calls
 */
interface StackFrame {
  returnAddress: number;
  locals: Map<string, unknown>;
  savedStack: unknown[];
}

/**
 * ISL Interpreter
 */
export class ISLInterpreter {
  private config: InterpreterConfig;
  private stack: unknown[] = [];
  private callStack: StackFrame[] = [];
  private globals: Map<string, unknown> = new Map();
  private pc = 0; // Program counter
  private running = false;
  private debugBreakpoints: Set<number> = new Set();
  private profiler: Map<number, { count: number; time: number }> = new Map();

  constructor(config: Partial<InterpreterConfig> = {}) {
    this.config = {
      maxStackSize: 10000,
      maxCallDepth: 1000,
      enableDebug: false,
      enableProfiling: false,
      ...config,
    };
  }

  /**
   * Execute a bytecode program
   */
  async execute(program: BytecodeProgram): Promise<unknown> {
    this.reset();
    this.running = true;

    // Load constants
    for (const [index, value] of program.constants.entries()) {
      this.globals.set(`const_${index}`, value);
    }

    try {
      while (this.running && this.pc < program.instructions.length) {
        const instruction = program.instructions[this.pc]!;

        // Debug breakpoint
        if (this.config.enableDebug && this.debugBreakpoints.has(this.pc)) {
          await this.onBreakpoint(this.pc);
        }

        // Profile instruction
        const startTime = this.config.enableProfiling ? performance.now() : 0;

        // Execute instruction
        await this.executeInstruction(instruction);

        // Update profiler
        if (this.config.enableProfiling) {
          const elapsed = performance.now() - startTime;
          const stats = this.profiler.get(instruction.opcode) ?? { count: 0, time: 0 };
          stats.count++;
          stats.time += elapsed;
          this.profiler.set(instruction.opcode, stats);
        }
      }

      return this.stack.pop();
    } finally {
      this.running = false;
    }
  }

  /**
   * Execute a single instruction
   */
  private async executeInstruction(instruction: Instruction): Promise<void> {
    switch (instruction.opcode) {
      // Stack operations
      case Opcode.PUSH:
        this.push(instruction.operands[0]);
        break;

      case Opcode.POP:
        this.pop();
        break;

      case Opcode.DUP:
        this.push(this.peek());
        break;

      case Opcode.SWAP: {
        const a = this.pop();
        const b = this.pop();
        this.push(a);
        this.push(b);
        break;
      }

      // Arithmetic
      case Opcode.ADD: {
        const b = this.pop() as number;
        const a = this.pop() as number;
        this.push(a + b);
        break;
      }

      case Opcode.SUB: {
        const b = this.pop() as number;
        const a = this.pop() as number;
        this.push(a - b);
        break;
      }

      case Opcode.MUL: {
        const b = this.pop() as number;
        const a = this.pop() as number;
        this.push(a * b);
        break;
      }

      case Opcode.DIV: {
        const b = this.pop() as number;
        const a = this.pop() as number;
        if (b === 0) throw new Error('Division by zero');
        this.push(a / b);
        break;
      }

      case Opcode.MOD: {
        const b = this.pop() as number;
        const a = this.pop() as number;
        this.push(a % b);
        break;
      }

      case Opcode.NEG: {
        const a = this.pop() as number;
        this.push(-a);
        break;
      }

      // Comparison
      case Opcode.EQ: {
        const b = this.pop();
        const a = this.pop();
        this.push(a === b);
        break;
      }

      case Opcode.NE: {
        const b = this.pop();
        const a = this.pop();
        this.push(a !== b);
        break;
      }

      case Opcode.LT: {
        const b = this.pop() as number;
        const a = this.pop() as number;
        this.push(a < b);
        break;
      }

      case Opcode.LE: {
        const b = this.pop() as number;
        const a = this.pop() as number;
        this.push(a <= b);
        break;
      }

      case Opcode.GT: {
        const b = this.pop() as number;
        const a = this.pop() as number;
        this.push(a > b);
        break;
      }

      case Opcode.GE: {
        const b = this.pop() as number;
        const a = this.pop() as number;
        this.push(a >= b);
        break;
      }

      // Logic
      case Opcode.AND: {
        const b = this.pop() as boolean;
        const a = this.pop() as boolean;
        this.push(a && b);
        break;
      }

      case Opcode.OR: {
        const b = this.pop() as boolean;
        const a = this.pop() as boolean;
        this.push(a || b);
        break;
      }

      case Opcode.NOT: {
        const a = this.pop() as boolean;
        this.push(!a);
        break;
      }

      // Control flow
      case Opcode.JMP:
        this.pc = instruction.operands[0] as number;
        return; // Don't increment PC

      case Opcode.JMP_IF: {
        const condition = this.pop() as boolean;
        if (condition) {
          this.pc = instruction.operands[0] as number;
          return;
        }
        break;
      }

      case Opcode.JMP_IF_NOT: {
        const condition = this.pop() as boolean;
        if (!condition) {
          this.pc = instruction.operands[0] as number;
          return;
        }
        break;
      }

      // Function calls
      case Opcode.CALL: {
        const address = instruction.operands[0] as number;
        const argCount = instruction.operands[1] as number;
        
        // Save current state
        const args: unknown[] = [];
        for (let i = 0; i < argCount; i++) {
          args.unshift(this.pop());
        }

        this.callStack.push({
          returnAddress: this.pc + 1,
          locals: new Map(args.map((arg, i) => [`arg_${i}`, arg])),
          savedStack: [...this.stack],
        });

        if (this.callStack.length > this.config.maxCallDepth) {
          throw new Error('Call stack overflow');
        }

        this.pc = address;
        return;
      }

      case Opcode.RET: {
        const frame = this.callStack.pop();
        if (!frame) {
          this.running = false;
          return;
        }
        this.pc = frame.returnAddress;
        return;
      }

      // Variables
      case Opcode.LOAD: {
        const name = instruction.operands[0] as string;
        const frame = this.callStack[this.callStack.length - 1];
        const value = frame?.locals.get(name) ?? this.globals.get(name);
        this.push(value);
        break;
      }

      case Opcode.STORE: {
        const name = instruction.operands[0] as string;
        const value = this.pop();
        const frame = this.callStack[this.callStack.length - 1];
        if (frame) {
          frame.locals.set(name, value);
        } else {
          this.globals.set(name, value);
        }
        break;
      }

      case Opcode.LOAD_GLOBAL: {
        const name = instruction.operands[0] as string;
        this.push(this.globals.get(name));
        break;
      }

      case Opcode.STORE_GLOBAL: {
        const name = instruction.operands[0] as string;
        const value = this.pop();
        this.globals.set(name, value);
        break;
      }

      // Objects
      case Opcode.GET_PROP: {
        const prop = instruction.operands[0] as string;
        const obj = this.pop() as Record<string, unknown>;
        this.push(obj?.[prop]);
        break;
      }

      case Opcode.SET_PROP: {
        const prop = instruction.operands[0] as string;
        const value = this.pop();
        const obj = this.pop() as Record<string, unknown>;
        if (obj) obj[prop] = value;
        this.push(obj);
        break;
      }

      case Opcode.NEW_OBJECT:
        this.push({});
        break;

      case Opcode.NEW_ARRAY:
        this.push([]);
        break;

      // Special
      case Opcode.NOP:
        break;

      case Opcode.HALT:
        this.running = false;
        return;

      default:
        throw new Error(`Unknown opcode: ${instruction.opcode}`);
    }

    this.pc++;
  }

  /**
   * Push value onto stack
   */
  private push(value: unknown): void {
    if (this.stack.length >= this.config.maxStackSize) {
      throw new Error('Stack overflow');
    }
    this.stack.push(value);
  }

  /**
   * Pop value from stack
   */
  private pop(): unknown {
    if (this.stack.length === 0) {
      throw new Error('Stack underflow');
    }
    return this.stack.pop();
  }

  /**
   * Peek at top of stack
   */
  private peek(): unknown {
    return this.stack[this.stack.length - 1];
  }

  /**
   * Reset interpreter state
   */
  private reset(): void {
    this.stack = [];
    this.callStack = [];
    this.globals = new Map();
    this.pc = 0;
    this.running = false;
  }

  /**
   * Set a breakpoint
   */
  setBreakpoint(address: number): void {
    this.debugBreakpoints.add(address);
  }

  /**
   * Remove a breakpoint
   */
  removeBreakpoint(address: number): void {
    this.debugBreakpoints.delete(address);
  }

  /**
   * Breakpoint handler (can be overridden)
   */
  protected async onBreakpoint(address: number): Promise<void> {
    // Default: just continue
  }

  /**
   * Get profiling results
   */
  getProfilingResults(): Map<number, { count: number; time: number }> {
    return this.profiler;
  }

  /**
   * Get current state (for debugging)
   */
  getState(): InterpreterState {
    return {
      pc: this.pc,
      stack: [...this.stack],
      callStack: this.callStack.map((frame) => ({
        returnAddress: frame.returnAddress,
        locals: Object.fromEntries(frame.locals),
      })),
      globals: Object.fromEntries(this.globals),
      running: this.running,
    };
  }
}

/**
 * Interpreter state
 */
export interface InterpreterState {
  pc: number;
  stack: unknown[];
  callStack: Array<{
    returnAddress: number;
    locals: Record<string, unknown>;
  }>;
  globals: Record<string, unknown>;
  running: boolean;
}

/**
 * Create an interpreter
 */
export function createInterpreter(config?: Partial<InterpreterConfig>): ISLInterpreter {
  return new ISLInterpreter(config);
}
