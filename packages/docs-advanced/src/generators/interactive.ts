// ============================================================================
// Interactive Documentation Generator - Generate interactive components
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type {
  GeneratorOptions,
  GeneratedFile,
  TryItConfig,
  SandboxConfig,
} from '../types';
import { typeToString, expressionToString } from '../utils/ast-helpers';

/**
 * Generate interactive documentation components
 */
export function generateInteractiveComponents(
  domain: AST.Domain,
  options: GeneratorOptions
): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  if (!options.interactive) {
    return files;
  }

  // Generate playground page
  files.push({
    path: 'playground/index.mdx',
    content: generatePlaygroundPage(domain, options),
    type: 'page',
  });

  // Generate behavior playgrounds
  for (const behavior of domain.behaviors) {
    files.push({
      path: `playground/${behavior.name.name.toLowerCase()}.mdx`,
      content: generateBehaviorPlayground(behavior, domain, options),
      type: 'page',
    });
  }

  // Generate component files (for frameworks that need them)
  if (options.format === 'nextra' || options.format === 'docusaurus') {
    files.push(...generateComponentFiles(domain, options));
  }

  return files;
}

/**
 * Generate TryIt configuration for a behavior
 */
export function generateTryItConfig(behavior: AST.Behavior): TryItConfig {
  const defaultInput: Record<string, unknown> = {};
  
  for (const field of behavior.input.fields) {
    defaultInput[field.name.name] = generateDefaultValue(field.type);
  }

  return {
    defaultInput,
    mockResponse: true,
    expectedOutput: generateExpectedOutput(behavior),
  };
}

// ============================================================================
// PAGE GENERATION
// ============================================================================

function generatePlaygroundPage(domain: AST.Domain, options: GeneratorOptions): string {
  return `---
title: Interactive Playground
description: Try the API live
---

import { Playground } from '@/components/Playground';

# Interactive Playground

Experiment with the ${domain.name.name} API in a safe environment.

## Available Behaviors

<div className="grid grid-cols-2 gap-4 my-6">
${domain.behaviors.map(b => `
  <a href="./playground/${b.name.name.toLowerCase()}" className="card hover:shadow-lg transition-shadow">
    <h3>${b.name.name}</h3>
    <p>${b.description?.value ?? 'Try this behavior'}</p>
  </a>
`).join('')}
</div>

## Quick Start

1. Select a behavior from the list above
2. Edit the input JSON
3. Click "Execute" to see the result
4. Verify the postconditions

<Playground domain="${domain.name.name}" />
`;
}

function generateBehaviorPlayground(
  behavior: AST.Behavior,
  domain: AST.Domain,
  options: GeneratorOptions
): string {
  const tryItConfig = generateTryItConfig(behavior);

  return `---
title: "${behavior.name.name} Playground"
description: "Try ${behavior.name.name} interactively"
---

import { TryIt } from '@/components/TryIt';
import { CodeSandbox } from '@/components/CodeSandbox';
import { FlowDiagram } from '@/components/FlowDiagram';

# ${behavior.name.name} Playground

${behavior.description?.value ?? ''}

## Flow Diagram

<FlowDiagram behavior="${behavior.name.name}" />

## Try It Live

<TryIt
  behavior="${behavior.name.name}"
  endpoint="/api/behaviors/${behavior.name.name.toLowerCase()}"
  defaultInput={${JSON.stringify(tryItConfig.defaultInput, null, 2)}}
  schema={${JSON.stringify(generateInputSchema(behavior), null, 2)}}
/>

## Input Schema

${generateSchemaTable(behavior.input.fields)}

## Preconditions

${behavior.preconditions.length > 0 
  ? behavior.preconditions.map(p => `- \`${expressionToString(p)}\``).join('\n')
  : '_No preconditions_'}

## Expected Postconditions

${behavior.postconditions.map(block => `
### On ${typeof block.condition === 'string' ? block.condition : block.condition.name}

${block.predicates.map(p => `- \`${expressionToString(p)}\``).join('\n')}
`).join('')}

## Full Code Example

<CodeSandbox
  template="typescript"
  files={{
    'index.ts': \`${generatePlaygroundCode(behavior)}\`,
    'types.ts': \`${generatePlaygroundTypes(behavior)}\`,
  }}
  entryFile="index.ts"
/>

## Error Scenarios

${behavior.output.errors.length > 0 ? `
Try these inputs to see different error responses:

${behavior.output.errors.map(e => `
### ${e.name.name}
${e.when?.value ?? ''}

\`\`\`json
${JSON.stringify(generateErrorInput(behavior, e), null, 2)}
\`\`\`
`).join('')}
` : '_No documented error scenarios_'}
`;
}

function generateComponentFiles(
  domain: AST.Domain,
  options: GeneratorOptions
): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // TryIt component wrapper
  files.push({
    path: 'components/TryIt.tsx',
    content: generateTryItWrapper(options),
    type: 'component',
  });

  // CodeSandbox component wrapper
  files.push({
    path: 'components/CodeSandbox.tsx',
    content: generateCodeSandboxWrapper(options),
    type: 'component',
  });

  // FlowDiagram component wrapper
  files.push({
    path: 'components/FlowDiagram.tsx',
    content: generateFlowDiagramWrapper(domain, options),
    type: 'component',
  });

  // Playground component
  files.push({
    path: 'components/Playground.tsx',
    content: generatePlaygroundComponent(domain, options),
    type: 'component',
  });

  return files;
}

// ============================================================================
// COMPONENT WRAPPERS
// ============================================================================

function generateTryItWrapper(options: GeneratorOptions): string {
  return `'use client';

import { useState } from 'react';

interface TryItProps {
  behavior: string;
  endpoint?: string;
  defaultInput: Record<string, unknown>;
  schema?: Record<string, unknown>;
}

export function TryIt({ behavior, endpoint, defaultInput, schema }: TryItProps) {
  const [input, setInput] = useState(JSON.stringify(defaultInput, null, 2));
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    setOutput(null);

    try {
      const parsed = JSON.parse(input);
      
      if (endpoint) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed),
        });
        const data = await response.json();
        setOutput(JSON.stringify(data, null, 2));
      } else {
        // Mock response for demo
        await new Promise(resolve => setTimeout(resolve, 500));
        setOutput(JSON.stringify({
          success: true,
          data: { ...parsed, id: crypto.randomUUID() },
        }, null, 2));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 my-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-semibold">Try {behavior}</h4>
        <button
          onClick={handleExecute}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Executing...' : 'Execute'}
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Input</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full h-64 font-mono text-sm p-2 border rounded"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Output</label>
          <pre className="w-full h-64 font-mono text-sm p-2 border rounded bg-gray-50 overflow-auto">
            {error ? (
              <span className="text-red-600">{error}</span>
            ) : output ?? 'Click Execute to see output'}
          </pre>
        </div>
      </div>
    </div>
  );
}
`;
}

function generateCodeSandboxWrapper(options: GeneratorOptions): string {
  return `'use client';

interface CodeSandboxProps {
  template: 'typescript' | 'javascript' | 'node';
  files: Record<string, string>;
  entryFile: string;
  dependencies?: Record<string, string>;
}

export function CodeSandbox({ template, files, entryFile, dependencies }: CodeSandboxProps) {
  // In a real implementation, this would embed CodeSandbox or StackBlitz
  const primaryFile = files[entryFile] ?? '';
  
  return (
    <div className="border rounded-lg my-4 overflow-hidden">
      <div className="bg-gray-100 px-4 py-2 border-b flex justify-between items-center">
        <span className="text-sm font-medium">Code Sandbox</span>
        <button className="text-sm text-blue-600 hover:underline">
          Open in StackBlitz →
        </button>
      </div>
      
      <div className="flex">
        {/* File tree */}
        <div className="w-48 border-r p-2 bg-gray-50">
          {Object.keys(files).map(filename => (
            <div 
              key={filename}
              className={\`px-2 py-1 text-sm rounded \${filename === entryFile ? 'bg-blue-100' : 'hover:bg-gray-100'}\`}
            >
              {filename}
            </div>
          ))}
        </div>
        
        {/* Code view */}
        <div className="flex-1">
          <pre className="p-4 overflow-auto max-h-96">
            <code>{primaryFile}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
`;
}

function generateFlowDiagramWrapper(domain: AST.Domain, options: GeneratorOptions): string {
  return `'use client';

import { useEffect, useRef } from 'react';

interface FlowDiagramProps {
  behavior: string;
}

const diagrams: Record<string, string> = {
${domain.behaviors.map(b => `  '${b.name.name}': \`${generateMermaidFlow(b)}\`,`).join('\n')}
};

export function FlowDiagram({ behavior }: FlowDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // In production, use mermaid.render() here
    const diagram = diagrams[behavior];
    if (containerRef.current && diagram) {
      containerRef.current.innerHTML = \`<pre class="mermaid">\${diagram}</pre>\`;
    }
  }, [behavior]);

  return (
    <div 
      ref={containerRef}
      className="my-4 p-4 border rounded-lg bg-white overflow-auto"
    />
  );
}
`;
}

function generatePlaygroundComponent(domain: AST.Domain, options: GeneratorOptions): string {
  return `'use client';

import { useState } from 'react';
import { TryIt } from './TryIt';

interface PlaygroundProps {
  domain: string;
}

const behaviors = ${JSON.stringify(domain.behaviors.map(b => ({
  name: b.name.name,
  description: b.description?.value ?? '',
})), null, 2)};

export function Playground({ domain }: PlaygroundProps) {
  const [selected, setSelected] = useState(behaviors[0]?.name ?? '');

  return (
    <div className="border rounded-lg p-4 my-4">
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Select Behavior</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full p-2 border rounded"
        >
          {behaviors.map(b => (
            <option key={b.name} value={b.name}>
              {b.name} - {b.description}
            </option>
          ))}
        </select>
      </div>
      
      {selected && (
        <TryIt
          behavior={selected}
          defaultInput={{}}
        />
      )}
    </div>
  );
}
`;
}

// ============================================================================
// HELPERS
// ============================================================================

function generateDefaultValue(type: AST.TypeDefinition): unknown {
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String': return '';
        case 'Int': return 0;
        case 'Decimal': return 0.0;
        case 'Boolean': return false;
        case 'UUID': return '00000000-0000-0000-0000-000000000000';
        case 'Timestamp': return new Date().toISOString();
        default: return null;
      }
    case 'ListType': return [];
    case 'MapType': return {};
    case 'OptionalType': return null;
    default: return null;
  }
}

function generateExpectedOutput(behavior: AST.Behavior): Record<string, unknown> {
  return {
    success: true,
    data: behavior.output.success ? {} : null,
  };
}

function generateInputSchema(behavior: AST.Behavior): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    type: 'object',
    properties: {},
    required: [] as string[],
  };

  for (const field of behavior.input.fields) {
    (schema.properties as Record<string, unknown>)[field.name.name] = {
      type: getJsonSchemaType(field.type),
    };
    if (!field.optional) {
      (schema.required as string[]).push(field.name.name);
    }
  }

  return schema;
}

function getJsonSchemaType(type: AST.TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String': case 'UUID': case 'Timestamp': return 'string';
        case 'Int': return 'integer';
        case 'Decimal': return 'number';
        case 'Boolean': return 'boolean';
        default: return 'string';
      }
    case 'ListType': return 'array';
    case 'MapType': return 'object';
    default: return 'string';
  }
}

function generateSchemaTable(fields: AST.Field[]): string {
  return `| Field | Type | Required | Description |
|-------|------|----------|-------------|
${fields.map(f => `| ${f.name.name} | \`${typeToString(f.type)}\` | ${f.optional ? 'No' : 'Yes'} | - |`).join('\n')}`;
}

function generatePlaygroundCode(behavior: AST.Behavior): string {
  return `// Try ${behavior.name.name}
const input = {
${behavior.input.fields.map(f => `  ${f.name.name}: /* your value */,`).join('\n')}
};

const result = await ${behavior.name.name.toLowerCase()}(input);
console.log(result);`;
}

function generatePlaygroundTypes(behavior: AST.Behavior): string {
  return `export interface ${behavior.name.name}Input {
${behavior.input.fields.map(f => `  ${f.name.name}${f.optional ? '?' : ''}: ${getPrimitiveTS(f.type)};`).join('\n')}
}`;
}

function getPrimitiveTS(type: AST.TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String': case 'UUID': case 'Timestamp': return 'string';
        case 'Int': case 'Decimal': return 'number';
        case 'Boolean': return 'boolean';
        default: return 'unknown';
      }
    default: return 'unknown';
  }
}

function generateErrorInput(behavior: AST.Behavior, error: AST.ErrorSpec): Record<string, unknown> {
  // Generate input that would trigger this error
  const input: Record<string, unknown> = {};
  for (const field of behavior.input.fields) {
    input[field.name.name] = generateDefaultValue(field.type);
  }
  return input;
}

function generateMermaidFlow(behavior: AST.Behavior): string {
  return `flowchart TD
    Start([Start]) --> Input[Receive Input]
    Input --> Check{Validate}
    Check -->|Pass| Execute[Execute]
    Check -->|Fail| Error[Return Error]
    Execute --> Result[Return Result]
    Result --> End([End])
    Error --> End`;
}
