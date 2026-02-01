/**
 * ISL Bytecode Definition
 * Low-level representation of ISL programs
 */

/**
 * Opcodes for the ISL VM
 */
export enum Opcode {
  // Stack operations
  PUSH = 0x01,
  POP = 0x02,
  DUP = 0x03,
  SWAP = 0x04,

  // Arithmetic
  ADD = 0x10,
  SUB = 0x11,
  MUL = 0x12,
  DIV = 0x13,
  MOD = 0x14,
  NEG = 0x15,

  // Comparison
  EQ = 0x20,
  NE = 0x21,
  LT = 0x22,
  LE = 0x23,
  GT = 0x24,
  GE = 0x25,

  // Logic
  AND = 0x30,
  OR = 0x31,
  NOT = 0x32,

  // Control flow
  JMP = 0x40,
  JMP_IF = 0x41,
  JMP_IF_NOT = 0x42,
  CALL = 0x43,
  RET = 0x44,

  // Variables
  LOAD = 0x50,
  STORE = 0x51,
  LOAD_GLOBAL = 0x52,
  STORE_GLOBAL = 0x53,

  // Objects
  GET_PROP = 0x60,
  SET_PROP = 0x61,
  NEW_OBJECT = 0x62,
  NEW_ARRAY = 0x63,

  // Behavior-specific
  CHECK_PRE = 0x70,
  CHECK_POST = 0x71,
  CHECK_INV = 0x72,
  APPLY_EFFECT = 0x73,
  EMIT_EVENT = 0x74,

  // Special
  NOP = 0xFE,
  HALT = 0xFF,
}

/**
 * Bytecode instruction
 */
export interface Instruction {
  opcode: Opcode;
  operands: unknown[];
  line?: number; // Source line for debugging
  column?: number;
}

/**
 * Bytecode program
 */
export interface BytecodeProgram {
  version: string;
  name: string;
  instructions: Instruction[];
  constants: unknown[];
  functions: FunctionDefinition[];
  labels: Map<string, number>;
  sourceMap?: SourceMap;
  metadata: ProgramMetadata;
}

/**
 * Function definition in bytecode
 */
export interface FunctionDefinition {
  name: string;
  address: number;
  paramCount: number;
  localCount: number;
}

/**
 * Source map for debugging
 */
export interface SourceMap {
  file: string;
  mappings: Array<{
    instructionIndex: number;
    line: number;
    column: number;
  }>;
}

/**
 * Program metadata
 */
export interface ProgramMetadata {
  domain?: string;
  behavior?: string;
  compilerVersion: string;
  compiledAt: number;
}

/**
 * Bytecode builder for constructing programs
 */
export class BytecodeBuilder {
  private instructions: Instruction[] = [];
  private constants: unknown[] = [];
  private functions: FunctionDefinition[] = [];
  private labels: Map<string, number> = new Map();
  private currentLine = 0;
  private currentColumn = 0;

  /**
   * Set source position
   */
  at(line: number, column: number): this {
    this.currentLine = line;
    this.currentColumn = column;
    return this;
  }

  /**
   * Add a constant and return its index
   */
  constant(value: unknown): number {
    const index = this.constants.indexOf(value);
    if (index !== -1) return index;
    this.constants.push(value);
    return this.constants.length - 1;
  }

  /**
   * Add a label at current position
   */
  label(name: string): this {
    this.labels.set(name, this.instructions.length);
    return this;
  }

  /**
   * Get address of a label
   */
  labelAddress(name: string): number {
    const address = this.labels.get(name);
    if (address === undefined) {
      throw new Error(`Unknown label: ${name}`);
    }
    return address;
  }

  /**
   * Emit an instruction
   */
  emit(opcode: Opcode, ...operands: unknown[]): this {
    this.instructions.push({
      opcode,
      operands,
      line: this.currentLine,
      column: this.currentColumn,
    });
    return this;
  }

  // Stack operations
  push(value: unknown): this {
    return this.emit(Opcode.PUSH, value);
  }

  pop(): this {
    return this.emit(Opcode.POP);
  }

  dup(): this {
    return this.emit(Opcode.DUP);
  }

  swap(): this {
    return this.emit(Opcode.SWAP);
  }

  // Arithmetic
  add(): this {
    return this.emit(Opcode.ADD);
  }

  sub(): this {
    return this.emit(Opcode.SUB);
  }

  mul(): this {
    return this.emit(Opcode.MUL);
  }

  div(): this {
    return this.emit(Opcode.DIV);
  }

  mod(): this {
    return this.emit(Opcode.MOD);
  }

  neg(): this {
    return this.emit(Opcode.NEG);
  }

  // Comparison
  eq(): this {
    return this.emit(Opcode.EQ);
  }

  ne(): this {
    return this.emit(Opcode.NE);
  }

  lt(): this {
    return this.emit(Opcode.LT);
  }

  le(): this {
    return this.emit(Opcode.LE);
  }

  gt(): this {
    return this.emit(Opcode.GT);
  }

  ge(): this {
    return this.emit(Opcode.GE);
  }

  // Logic
  and(): this {
    return this.emit(Opcode.AND);
  }

  or(): this {
    return this.emit(Opcode.OR);
  }

  not(): this {
    return this.emit(Opcode.NOT);
  }

  // Control flow
  jmp(target: string | number): this {
    return this.emit(Opcode.JMP, target);
  }

  jmpIf(target: string | number): this {
    return this.emit(Opcode.JMP_IF, target);
  }

  jmpIfNot(target: string | number): this {
    return this.emit(Opcode.JMP_IF_NOT, target);
  }

  call(address: number, argCount: number): this {
    return this.emit(Opcode.CALL, address, argCount);
  }

  ret(): this {
    return this.emit(Opcode.RET);
  }

  // Variables
  load(name: string): this {
    return this.emit(Opcode.LOAD, name);
  }

  store(name: string): this {
    return this.emit(Opcode.STORE, name);
  }

  loadGlobal(name: string): this {
    return this.emit(Opcode.LOAD_GLOBAL, name);
  }

  storeGlobal(name: string): this {
    return this.emit(Opcode.STORE_GLOBAL, name);
  }

  // Objects
  getProp(name: string): this {
    return this.emit(Opcode.GET_PROP, name);
  }

  setProp(name: string): this {
    return this.emit(Opcode.SET_PROP, name);
  }

  newObject(): this {
    return this.emit(Opcode.NEW_OBJECT);
  }

  newArray(): this {
    return this.emit(Opcode.NEW_ARRAY);
  }

  // Behavior-specific
  checkPre(name: string): this {
    return this.emit(Opcode.CHECK_PRE, name);
  }

  checkPost(name: string): this {
    return this.emit(Opcode.CHECK_POST, name);
  }

  checkInv(name: string): this {
    return this.emit(Opcode.CHECK_INV, name);
  }

  applyEffect(type: string, target: string): this {
    return this.emit(Opcode.APPLY_EFFECT, type, target);
  }

  emitEvent(eventType: string): this {
    return this.emit(Opcode.EMIT_EVENT, eventType);
  }

  // Special
  nop(): this {
    return this.emit(Opcode.NOP);
  }

  halt(): this {
    return this.emit(Opcode.HALT);
  }

  /**
   * Define a function
   */
  defineFunction(name: string, paramCount: number, localCount: number): this {
    this.functions.push({
      name,
      address: this.instructions.length,
      paramCount,
      localCount,
    });
    return this;
  }

  /**
   * Build the program
   */
  build(name: string): BytecodeProgram {
    // Resolve label references
    for (const instruction of this.instructions) {
      if (
        instruction.opcode === Opcode.JMP ||
        instruction.opcode === Opcode.JMP_IF ||
        instruction.opcode === Opcode.JMP_IF_NOT
      ) {
        const target = instruction.operands[0];
        if (typeof target === 'string') {
          instruction.operands[0] = this.labelAddress(target);
        }
      }
    }

    return {
      version: '1.0.0',
      name,
      instructions: this.instructions,
      constants: this.constants,
      functions: this.functions,
      labels: this.labels,
      sourceMap: this.buildSourceMap(),
      metadata: {
        compilerVersion: '1.0.0',
        compiledAt: Date.now(),
      },
    };
  }

  private buildSourceMap(): SourceMap {
    return {
      file: 'unknown',
      mappings: this.instructions
        .map((inst, index) => ({
          instructionIndex: index,
          line: inst.line ?? 0,
          column: inst.column ?? 0,
        }))
        .filter((m) => m.line > 0),
    };
  }
}

/**
 * Create a new bytecode builder
 */
export function bytecode(): BytecodeBuilder {
  return new BytecodeBuilder();
}

/**
 * Disassemble bytecode to readable format
 */
export function disassemble(program: BytecodeProgram): string {
  const lines: string[] = [];
  lines.push(`; Program: ${program.name}`);
  lines.push(`; Version: ${program.version}`);
  lines.push('');

  // Constants
  if (program.constants.length > 0) {
    lines.push('; Constants');
    for (const [index, value] of program.constants.entries()) {
      lines.push(`  const_${index} = ${JSON.stringify(value)}`);
    }
    lines.push('');
  }

  // Functions
  if (program.functions.length > 0) {
    lines.push('; Functions');
    for (const fn of program.functions) {
      lines.push(`  ${fn.name} @ ${fn.address} (${fn.paramCount} params, ${fn.localCount} locals)`);
    }
    lines.push('');
  }

  // Instructions
  lines.push('; Instructions');
  for (const [index, inst] of program.instructions.entries()) {
    const label = Array.from(program.labels.entries()).find(([_, addr]) => addr === index);
    if (label) {
      lines.push(`${label[0]}:`);
    }
    const opName = Opcode[inst.opcode] ?? `UNKNOWN(${inst.opcode})`;
    const operands = inst.operands.map((o) => JSON.stringify(o)).join(', ');
    lines.push(`  ${index.toString().padStart(4)}: ${opName.padEnd(15)} ${operands}`);
  }

  return lines.join('\n');
}
