/**
 * ISL Stream Syntax
 * 
 * Parse and generate ISL stream specifications
 */

import type { StreamPipelineSpec, StreamSpec, OperatorSpec, ConnectionSpec } from './types';

/**
 * Parse ISL stream specification
 */
export function parseStreamISL(isl: string): StreamPipelineSpec {
  const lines = isl.split('\n').map(l => l.trim());
  const spec: StreamPipelineSpec = {
    name: '',
    streams: [],
    connections: [],
  };

  let currentStream: StreamSpec | null = null;

  for (const line of lines) {
    if (!line || line.startsWith('//')) continue;

    // Pipeline declaration
    if (line.startsWith('pipeline ')) {
      spec.name = line.replace('pipeline ', '').replace(' {', '').trim();
      continue;
    }

    // Description
    if (line.startsWith('description ')) {
      spec.description = line.replace('description ', '').replace(/[";]/g, '').trim();
      continue;
    }

    // Stream declaration
    if (line.startsWith('stream ')) {
      if (currentStream) {
        spec.streams.push(currentStream);
      }
      const id = line.replace('stream ', '').replace(' {', '').trim();
      currentStream = { id, source: '', operators: [] };
      continue;
    }

    // Source declaration
    if (line.startsWith('source ') && currentStream) {
      currentStream.source = line.replace('source ', '').replace(';', '').trim();
      continue;
    }

    // Operator declaration
    if (line.startsWith('|> ') && currentStream) {
      const opLine = line.replace('|> ', '').replace(';', '').trim();
      const op = parseOperator(opLine);
      if (op) {
        currentStream.operators.push(op);
      }
      continue;
    }

    // Sink declaration
    if (line.startsWith('sink ') && currentStream) {
      currentStream.sink = line.replace('sink ', '').replace(';', '').trim();
      continue;
    }

    // Connection declaration
    if (line.includes('->')) {
      const [from, rest] = line.split('->').map(s => s.trim());
      const [to, transform] = rest.replace(';', '').split(':').map(s => s.trim());
      spec.connections.push({ from, to, transform });
      continue;
    }

    // End of stream
    if (line === '}' && currentStream) {
      spec.streams.push(currentStream);
      currentStream = null;
    }
  }

  return spec;
}

/**
 * Parse an operator declaration
 */
function parseOperator(line: string): OperatorSpec | null {
  // Format: operatorName(param1: value1, param2: value2)
  const match = line.match(/^(\w+)(?:\(([^)]*)\))?$/);
  if (!match) return null;

  const type = match[1];
  const params: Record<string, unknown> = {};

  if (match[2]) {
    const paramParts = match[2].split(',').map(p => p.trim());
    for (const part of paramParts) {
      const [key, value] = part.split(':').map(p => p.trim());
      if (key && value) {
        // Parse value
        if (value === 'true') params[key] = true;
        else if (value === 'false') params[key] = false;
        else if (/^\d+$/.test(value)) params[key] = parseInt(value, 10);
        else if (/^\d+\.\d+$/.test(value)) params[key] = parseFloat(value);
        else params[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  }

  return { type, params };
}

/**
 * Generate ISL from stream pipeline
 */
export function generateStreamISL(spec: StreamPipelineSpec): string {
  const lines: string[] = [];

  lines.push(`pipeline ${spec.name} {`);

  if (spec.description) {
    lines.push(`  description "${spec.description}";`);
  }

  for (const stream of spec.streams) {
    lines.push('');
    lines.push(`  stream ${stream.id} {`);
    lines.push(`    source ${stream.source};`);

    for (const op of stream.operators) {
      const params = Object.entries(op.params)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(', ');
      lines.push(`    |> ${op.type}(${params});`);
    }

    if (stream.sink) {
      lines.push(`    sink ${stream.sink};`);
    }

    lines.push('  }');
  }

  if (spec.connections.length > 0) {
    lines.push('');
    lines.push('  // Connections');
    for (const conn of spec.connections) {
      const transform = conn.transform ? `:${conn.transform}` : '';
      lines.push(`  ${conn.from} -> ${conn.to}${transform};`);
    }
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Example ISL stream pipeline
 */
export const orderProcessingPipelineISL = `
pipeline OrderProcessing {
  description "Real-time order processing pipeline";

  stream orders {
    source topic("orders.created");
    |> filter(status: "pending");
    |> map(enrichCustomerData);
    |> validate(schema: "OrderSchema");
    sink queue("orders.validated");
  }

  stream payments {
    source queue("orders.validated");
    |> map(processPayment);
    |> retry(count: 3, delay: 1000);
    sink topic("orders.paid");
  }

  stream fulfillment {
    source topic("orders.paid");
    |> map(createShipment);
    |> tap(notifyCustomer);
    sink database("shipments");
  }

  stream analytics {
    source topic("orders.*");
    |> window(type: "tumbling", size: 60000);
    |> aggregate(count, sum: "amount");
    sink http("analytics-api/ingest");
  }

  // Pipeline connections
  orders -> payments;
  payments -> fulfillment;
}
`;

/**
 * Stream DSL for ISL behavior specifications
 */
export function streamBehavior(name: string): StreamBehaviorBuilder {
  return new StreamBehaviorBuilder(name);
}

/**
 * Stream behavior builder
 */
export class StreamBehaviorBuilder {
  private _name: string;
  private _input?: string;
  private _output?: string;
  private _operators: string[] = [];
  private _properties: string[] = [];

  constructor(name: string) {
    this._name = name;
  }

  input(type: string): this {
    this._input = type;
    return this;
  }

  output(type: string): this {
    this._output = type;
    return this;
  }

  transform(operator: string): this {
    this._operators.push(operator);
    return this;
  }

  property(prop: string): this {
    this._properties.push(prop);
    return this;
  }

  /**
   * Ordering property
   */
  preservesOrder(): this {
    return this.property('preserves_order');
  }

  /**
   * Exactly once property
   */
  exactlyOnce(): this {
    return this.property('exactly_once');
  }

  /**
   * At least once property
   */
  atLeastOnce(): this {
    return this.property('at_least_once');
  }

  /**
   * Idempotent property
   */
  idempotent(): this {
    return this.property('idempotent');
  }

  toISL(): string {
    const lines: string[] = [];

    lines.push(`behavior ${this._name} {`);
    
    if (this._input) {
      lines.push(`  input: Stream<${this._input}>;`);
    }
    
    if (this._output) {
      lines.push(`  output: Stream<${this._output}>;`);
    }

    if (this._operators.length > 0) {
      lines.push('');
      lines.push('  transform {');
      for (const op of this._operators) {
        lines.push(`    |> ${op};`);
      }
      lines.push('  }');
    }

    if (this._properties.length > 0) {
      lines.push('');
      lines.push('  properties {');
      for (const prop of this._properties) {
        lines.push(`    ${prop};`);
      }
      lines.push('  }');
    }

    lines.push('}');

    return lines.join('\n');
  }
}
