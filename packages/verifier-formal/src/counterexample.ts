// ============================================================================
// Counterexample Parser
// Parses Z3 model output into readable counterexamples
// ============================================================================

import { Counterexample } from './translator';

// ============================================================================
// TYPES
// ============================================================================

interface ModelValue {
  name: string;
  sort: string;
  value: string;
}

interface FunctionDef {
  name: string;
  args: Array<{ name: string; sort: string }>;
  returnSort: string;
  body: string;
}

// ============================================================================
// MAIN PARSER
// ============================================================================

/**
 * Parse Z3 model output into a Counterexample
 */
export function parseCounterexample(model: string, propertyName: string): Counterexample {
  const counterexample: Counterexample = {
    property: propertyName,
    inputs: {},
    state: {},
    trace: [],
    smtModel: model,
  };

  try {
    const parsed = parseModel(model);
    
    // Extract input values
    for (const value of parsed.values) {
      if (value.name.startsWith('input-')) {
        const inputName = value.name.replace('input-', '');
        counterexample.inputs[inputName] = parseValue(value.value, value.sort);
      }
    }

    // Extract state values
    for (const value of parsed.values) {
      if (!value.name.startsWith('input-') && !value.name.startsWith('result')) {
        counterexample.state[value.name] = parseValue(value.value, value.sort);
      }
    }

    // Generate trace from functions
    counterexample.trace = generateTrace(parsed);
    
  } catch (error) {
    counterexample.trace = [
      `Failed to parse model: ${error instanceof Error ? error.message : String(error)}`,
      'Raw model available in smtModel field',
    ];
  }

  return counterexample;
}

// ============================================================================
// MODEL PARSING
// ============================================================================

interface ParsedModel {
  values: ModelValue[];
  functions: FunctionDef[];
}

function parseModel(model: string): ParsedModel {
  const values: ModelValue[] = [];
  const functions: FunctionDef[] = [];

  // Remove outer (model ...) wrapper if present
  let content = model.trim();
  if (content.startsWith('(model')) {
    content = content.slice(6, -1).trim();
  }

  // Parse S-expressions
  const exprs = parseSExpressions(content);
  
  for (const expr of exprs) {
    if (typeof expr !== 'object' || !Array.isArray(expr)) continue;
    
    const [keyword, ...rest] = expr;
    
    if (keyword === 'define-fun') {
      const func = parseFunctionDef(rest);
      if (func) {
        if (func.args.length === 0) {
          // Constant - treat as value
          values.push({
            name: func.name,
            sort: func.returnSort,
            value: func.body,
          });
        } else {
          functions.push(func);
        }
      }
    } else if (keyword === 'define-const') {
      const [name, sort, value] = rest;
      values.push({
        name: String(name),
        sort: String(sort),
        value: formatSExpr(value),
      });
    }
  }

  return { values, functions };
}

function parseFunctionDef(rest: unknown[]): FunctionDef | null {
  if (rest.length < 3) return null;
  
  const [name, argsExpr, returnSort, body] = rest;
  
  const args: Array<{ name: string; sort: string }> = [];
  if (Array.isArray(argsExpr)) {
    for (const arg of argsExpr) {
      if (Array.isArray(arg) && arg.length >= 2) {
        args.push({
          name: String(arg[0]),
          sort: String(arg[1]),
        });
      }
    }
  }

  return {
    name: String(name),
    args,
    returnSort: String(returnSort),
    body: formatSExpr(body),
  };
}

// ============================================================================
// S-EXPRESSION PARSER
// ============================================================================

function parseSExpressions(input: string): unknown[] {
  const results: unknown[] = [];
  let pos = 0;

  while (pos < input.length) {
    // Skip whitespace
    while (pos < input.length && /\s/.test(input[pos])) pos++;
    if (pos >= input.length) break;

    const [expr, newPos] = parseSExpr(input, pos);
    if (expr !== null) {
      results.push(expr);
    }
    pos = newPos;
  }

  return results;
}

function parseSExpr(input: string, pos: number): [unknown, number] {
  // Skip whitespace
  while (pos < input.length && /\s/.test(input[pos])) pos++;
  
  if (pos >= input.length) {
    return [null, pos];
  }

  const char = input[pos];

  // List
  if (char === '(') {
    pos++; // skip '('
    const list: unknown[] = [];
    
    while (pos < input.length) {
      // Skip whitespace
      while (pos < input.length && /\s/.test(input[pos])) pos++;
      
      if (input[pos] === ')') {
        pos++; // skip ')'
        break;
      }
      
      const [elem, newPos] = parseSExpr(input, pos);
      if (elem !== null) {
        list.push(elem);
      }
      pos = newPos;
    }
    
    return [list, pos];
  }

  // String literal
  if (char === '"') {
    pos++; // skip opening quote
    let str = '';
    while (pos < input.length && input[pos] !== '"') {
      if (input[pos] === '\\' && pos + 1 < input.length) {
        str += input[pos + 1];
        pos += 2;
      } else {
        str += input[pos];
        pos++;
      }
    }
    pos++; // skip closing quote
    return [`"${str}"`, pos];
  }

  // Atom (symbol, number, etc.)
  let atom = '';
  while (pos < input.length && !/[\s()]/.test(input[pos])) {
    atom += input[pos];
    pos++;
  }
  
  return [atom, pos];
}

function formatSExpr(expr: unknown): string {
  if (expr === null || expr === undefined) {
    return 'null';
  }
  if (Array.isArray(expr)) {
    return `(${expr.map(formatSExpr).join(' ')})`;
  }
  return String(expr);
}

// ============================================================================
// VALUE PARSING
// ============================================================================

function parseValue(value: string, sort: string): unknown {
  // Handle common sorts
  switch (sort) {
    case 'Int':
      // Handle negative numbers like (- 5)
      if (value.startsWith('(- ')) {
        const num = value.slice(3, -1);
        return -parseInt(num, 10);
      }
      return parseInt(value, 10);
    
    case 'Real':
      // Handle rationals like (/ 1 2)
      if (value.startsWith('(/ ')) {
        const parts = value.slice(3, -1).split(' ');
        return parseFloat(parts[0]) / parseFloat(parts[1]);
      }
      return parseFloat(value);
    
    case 'Bool':
      return value === 'true';
    
    case 'String':
      // Remove quotes
      if (value.startsWith('"') && value.endsWith('"')) {
        return value.slice(1, -1);
      }
      return value;
    
    default:
      // Return as-is for unknown sorts
      return value;
  }
}

// ============================================================================
// TRACE GENERATION
// ============================================================================

function generateTrace(model: ParsedModel): string[] {
  const trace: string[] = [];

  // Add input values
  const inputs = model.values.filter(v => v.name.startsWith('input-'));
  if (inputs.length > 0) {
    trace.push('Inputs:');
    for (const input of inputs) {
      const name = input.name.replace('input-', '');
      const value = parseValue(input.value, input.sort);
      trace.push(`  ${name} = ${JSON.stringify(value)}`);
    }
  }

  // Add relevant state
  const stateVars = model.values.filter(v => 
    !v.name.startsWith('input-') && 
    !v.name.startsWith('result') &&
    !v.name.includes('skolem')
  );
  if (stateVars.length > 0) {
    trace.push('State:');
    for (const state of stateVars) {
      const value = parseValue(state.value, state.sort);
      trace.push(`  ${state.name} = ${JSON.stringify(value)}`);
    }
  }

  // Add function interpretations
  const relevantFuncs = model.functions.filter(f => 
    !f.name.includes('skolem') &&
    f.args.length <= 2
  );
  if (relevantFuncs.length > 0) {
    trace.push('Functions:');
    for (const func of relevantFuncs.slice(0, 5)) { // Limit to 5
      const args = func.args.map(a => a.name).join(', ');
      trace.push(`  ${func.name}(${args}) = ${func.body}`);
    }
  }

  return trace;
}

// ============================================================================
// COUNTEREXAMPLE FORMATTING
// ============================================================================

/**
 * Format a counterexample for display
 */
export function formatCounterexample(ce: Counterexample): string {
  const lines: string[] = [];

  lines.push(`Property: ${ce.property}`);
  lines.push('');

  if (Object.keys(ce.inputs).length > 0) {
    lines.push('Inputs:');
    for (const [name, value] of Object.entries(ce.inputs)) {
      lines.push(`  ${name}: ${JSON.stringify(value)}`);
    }
    lines.push('');
  }

  if (Object.keys(ce.state).length > 0) {
    lines.push('State:');
    for (const [name, value] of Object.entries(ce.state)) {
      lines.push(`  ${name}: ${JSON.stringify(value)}`);
    }
    lines.push('');
  }

  if (ce.trace.length > 0) {
    lines.push('Trace:');
    for (const step of ce.trace) {
      lines.push(`  ${step}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate a minimal counterexample by removing irrelevant values
 */
export function minimizeCounterexample(ce: Counterexample): Counterexample {
  return {
    ...ce,
    state: Object.fromEntries(
      Object.entries(ce.state).filter(([key]) => 
        !key.includes('skolem') &&
        !key.includes('aux') &&
        !key.startsWith('_')
      )
    ),
    trace: ce.trace.filter(line => 
      !line.includes('skolem') &&
      !line.includes('auxiliary')
    ),
  };
}
