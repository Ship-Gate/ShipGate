/**
 * State Machine Visualizer
 *
 * Generate visual representations of state machines.
 */

import { StateMachineConfig } from './machine.js';

export interface VisualizationOptions {
  /** Output format */
  format?: 'mermaid' | 'dot' | 'plantuml' | 'd3';
  /** Include transition labels */
  includeLabels?: boolean;
  /** Include state descriptions */
  includeDescriptions?: boolean;
  /** Direction of the graph */
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  /** Highlight current state */
  currentState?: string;
}

export class StateVisualizer {
  private options: Required<VisualizationOptions>;

  constructor(options: VisualizationOptions = {}) {
    this.options = {
      format: options.format ?? 'mermaid',
      includeLabels: options.includeLabels ?? true,
      includeDescriptions: options.includeDescriptions ?? false,
      direction: options.direction ?? 'LR',
      currentState: options.currentState ?? '',
    };
  }

  /**
   * Generate visualization from state machine config
   */
  visualize(config: StateMachineConfig): string {
    switch (this.options.format) {
      case 'mermaid':
        return this.toMermaid(config);
      case 'dot':
        return this.toDot(config);
      case 'plantuml':
        return this.toPlantUML(config);
      case 'd3':
        return this.toD3Json(config);
      default:
        return this.toMermaid(config);
    }
  }

  /**
   * Generate Mermaid diagram
   */
  private toMermaid(config: StateMachineConfig): string {
    const lines: string[] = [];

    lines.push(`stateDiagram-v2`);
    lines.push(`  direction ${this.options.direction}`);
    lines.push('');

    // Initial state indicator
    lines.push(`  [*] --> ${config.initial}`);

    // State definitions with notes
    for (const state of config.states) {
      if (this.options.includeDescriptions && state.meta?.description) {
        lines.push(`  ${state.name} : ${state.meta.description}`);
      }

      if (state.final) {
        lines.push(`  ${state.name} --> [*]`);
      }

      // Highlight current state
      if (this.options.currentState === state.name) {
        lines.push(`  state ${state.name} {`);
        lines.push(`    note right of ${state.name} : Current State`);
        lines.push(`  }`);
      }
    }

    lines.push('');

    // Transitions
    for (const transition of config.transitions) {
      const from = transition.from === '*' ? 'any' : transition.from;
      const label = this.options.includeLabels ? ` : ${transition.event}` : '';
      lines.push(`  ${from} --> ${transition.to}${label}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate Graphviz DOT format
   */
  private toDot(config: StateMachineConfig): string {
    const lines: string[] = [];

    lines.push(`digraph ${config.id} {`);
    lines.push(`  rankdir=${this.options.direction};`);
    lines.push(`  node [shape=rectangle, style=rounded];`);
    lines.push('');

    // Start node
    lines.push(`  __start__ [shape=point, width=0.1];`);
    lines.push(`  __start__ -> ${config.initial};`);
    lines.push('');

    // State nodes
    for (const state of config.states) {
      const attrs: string[] = [];

      if (state.final) {
        attrs.push('peripheries=2');
      }

      if (state.initial) {
        attrs.push('style="rounded,bold"');
      }

      if (this.options.currentState === state.name) {
        attrs.push('fillcolor=yellow');
        attrs.push('style="rounded,filled"');
      }

      if (this.options.includeDescriptions && state.meta?.description) {
        attrs.push(`label="${state.name}\\n${state.meta.description}"`);
      }

      const attrStr = attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';
      lines.push(`  ${state.name}${attrStr};`);
    }

    lines.push('');

    // Transitions
    for (const transition of config.transitions) {
      const from = transition.from === '*' ? 'any' : transition.from;
      const label = this.options.includeLabels
        ? `label="${transition.event}"`
        : '';
      lines.push(`  ${from} -> ${transition.to} [${label}];`);
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate PlantUML diagram
   */
  private toPlantUML(config: StateMachineConfig): string {
    const lines: string[] = [];

    lines.push('@startuml');
    lines.push(`title ${config.id}`);
    lines.push('');

    // Initial state
    lines.push(`[*] --> ${config.initial}`);
    lines.push('');

    // State definitions
    for (const state of config.states) {
      if (this.options.includeDescriptions && state.meta?.description) {
        lines.push(`state "${state.name}" as ${state.name} : ${state.meta.description}`);
      }

      if (state.final) {
        lines.push(`${state.name} --> [*]`);
      }

      if (this.options.currentState === state.name) {
        lines.push(`state ${state.name} #yellow`);
      }
    }

    lines.push('');

    // Transitions
    for (const transition of config.transitions) {
      const from = transition.from === '*' ? '[*]' : transition.from;
      const label = this.options.includeLabels ? ` : ${transition.event}` : '';
      lines.push(`${from} --> ${transition.to}${label}`);
    }

    lines.push('');
    lines.push('@enduml');

    return lines.join('\n');
  }

  /**
   * Generate D3.js-compatible JSON
   */
  private toD3Json(config: StateMachineConfig): string {
    const nodes = config.states.map((state) => ({
      id: state.name,
      initial: state.initial ?? false,
      final: state.final ?? false,
      current: state.name === this.options.currentState,
      description: state.meta?.description,
    }));

    const links = config.transitions.map((transition) => ({
      source: transition.from,
      target: transition.to,
      event: transition.event,
      guards: transition.guards,
    }));

    return JSON.stringify(
      {
        id: config.id,
        initial: config.initial,
        nodes,
        links,
      },
      null,
      2
    );
  }

  /**
   * Generate SVG (using Mermaid.js would require browser)
   */
  toSvgPlaceholder(config: StateMachineConfig): string {
    const mermaid = this.toMermaid(config);
    return `
<!-- Generated from state machine config -->
<!-- Use Mermaid.js or similar tool to render -->
<div class="mermaid">
${mermaid}
</div>
<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
<script>mermaid.initialize({startOnLoad: true});</script>
`;
  }

  /**
   * Generate ASCII art diagram
   */
  toAscii(config: StateMachineConfig): string {
    const lines: string[] = [];

    lines.push(`State Machine: ${config.id}`);
    lines.push('='.repeat(40));
    lines.push(`Initial: ${config.initial}`);
    lines.push('');
    lines.push('States:');

    for (const state of config.states) {
      let marker = '  ';
      if (state.initial) marker = '> ';
      if (state.final) marker = '* ';
      if (this.options.currentState === state.name) marker = '@ ';
      lines.push(`${marker}[${state.name}]`);
    }

    lines.push('');
    lines.push('Transitions:');

    for (const transition of config.transitions) {
      lines.push(`  ${transition.from} --${transition.event}--> ${transition.to}`);
    }

    lines.push('');
    lines.push('Legend: > = initial, * = final, @ = current');

    return lines.join('\n');
  }
}

/**
 * Generate visualization from state machine config
 */
export function visualizeStateMachine(
  config: StateMachineConfig,
  options?: VisualizationOptions
): string {
  const visualizer = new StateVisualizer(options);
  return visualizer.visualize(config);
}
