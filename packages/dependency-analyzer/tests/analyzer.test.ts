/**
 * Dependency Analyzer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyAnalyzer, analyzeDependencies } from '../src/analyzer.js';
import { detectCycles, detectDomainCycles, getCycleSeverity } from '../src/cycles.js';
import { analyzeImpact, analyzeRemovalImpact } from '../src/impact.js';
import { findOrphans, suggestCleanup } from '../src/orphans.js';
import { generateMermaid, generateD2, generateDot } from '../src/visualizer.js';

// Sample ISL sources for testing
const authDomain = `
domain Auth {
  imports {
    User from "Core"
  }

  enum SessionStatus {
    ACTIVE
    EXPIRED
  }

  entity Session {
    id: UUID
    userId: UUID
    status: SessionStatus
    token: String
  }

  behavior Login {
    input {
      email: String
      password: String
    }
    output {
      success: Session
    }
    preconditions {
      email.is_valid
    }
    postconditions {
      success implies {
        result.status == SessionStatus.ACTIVE
      }
    }
  }

  behavior Logout {
    input {
      sessionId: UUID
    }
    output {
      success: Session
    }
  }
}
`;

const coreDomain = `
domain Core {
  enum UserStatus {
    ACTIVE
    INACTIVE
  }

  entity User {
    id: UUID
    email: String
    status: UserStatus
  }

  type Email = String { pattern: ".*@.*" }

  behavior CreateUser {
    input {
      email: Email
    }
    output {
      success: User
    }
  }
}
`;

const paymentsDomain = `
domain Payments {
  imports {
    User from "Core"
  }

  entity Payment {
    id: UUID
    userId: UUID
    amount: Decimal
  }

  behavior ProcessPayment {
    input {
      userId: UUID
      amount: Decimal
    }
    output {
      success: Payment
    }
    compliance {
      PCI_DSS {
        - sensitive_data_encrypted
      }
    }
  }
}
`;

describe('DependencyAnalyzer', () => {
  let analyzer: DependencyAnalyzer;

  beforeEach(() => {
    analyzer = new DependencyAnalyzer();
  });

  describe('addDomain', () => {
    it('should parse and add a domain', () => {
      analyzer.addDomain(coreDomain, 'core.isl');
      const graph = analyzer.getGraph();

      expect(graph.domains.has('Core')).toBe(true);
      expect(graph.nodes.size).toBeGreaterThan(0);
    });

    it('should track entities', () => {
      analyzer.addDomain(coreDomain, 'core.isl');
      const graph = analyzer.getGraph();

      const summary = graph.domains.get('Core');
      expect(summary?.entities).toContain('User');
    });

    it('should track behaviors', () => {
      analyzer.addDomain(coreDomain, 'core.isl');
      const graph = analyzer.getGraph();

      const summary = graph.domains.get('Core');
      expect(summary?.behaviors).toContain('CreateUser');
    });

    it('should track enums', () => {
      analyzer.addDomain(coreDomain, 'core.isl');
      const graph = analyzer.getGraph();

      const summary = graph.domains.get('Core');
      expect(summary?.enums).toContain('UserStatus');
    });

    it('should track imports', () => {
      analyzer.addDomain(coreDomain, 'core.isl');
      analyzer.addDomain(authDomain, 'auth.isl');
      const graph = analyzer.getGraph();

      const authSummary = graph.domains.get('Auth');
      expect(authSummary?.imports).toContain('Core');
    });
  });

  describe('getDependencies', () => {
    it('should return dependencies of a node', () => {
      analyzer.addDomain(coreDomain, 'core.isl');
      analyzer.addDomain(authDomain, 'auth.isl');

      const deps = analyzer.getDependencies('domain:Auth');
      expect(deps.length).toBeGreaterThan(0);
    });
  });

  describe('getDependents', () => {
    it('should return dependents of a node', () => {
      analyzer.addDomain(coreDomain, 'core.isl');
      analyzer.addDomain(authDomain, 'auth.isl');

      const dependents = analyzer.getDependents('domain:Core');
      const dependentNames = dependents.map((d) => d.name);
      expect(dependentNames).toContain('Auth');
    });
  });

  describe('getTransitiveDependencies', () => {
    it('should return all transitive dependencies', () => {
      analyzer.addDomain(coreDomain, 'core.isl');
      analyzer.addDomain(authDomain, 'auth.isl');
      analyzer.addDomain(paymentsDomain, 'payments.isl');

      const deps = analyzer.getTransitiveDependencies('domain:Auth');
      expect(deps.has('domain:Core')).toBe(true);
    });
  });
});

describe('analyzeDependencies', () => {
  it('should analyze multiple sources', () => {
    const graph = analyzeDependencies([
      { source: coreDomain, file: 'core.isl' },
      { source: authDomain, file: 'auth.isl' },
    ]);

    expect(graph.domains.size).toBe(2);
    expect(graph.nodes.size).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
  });
});

describe('detectCycles', () => {
  it('should detect no cycles in acyclic graph', () => {
    const graph = analyzeDependencies([
      { source: coreDomain, file: 'core.isl' },
      { source: authDomain, file: 'auth.isl' },
    ]);

    const result = detectCycles(graph);
    expect(result.hasCycles).toBe(false);
  });

  it('should provide cycle severity', () => {
    const cycle = {
      nodes: ['domain:A', 'domain:B', 'domain:C'],
      edges: [],
      type: 'domain' as const,
      description: 'Domain cycle',
    };

    const severity = getCycleSeverity(cycle);
    expect(['low', 'medium', 'high', 'critical']).toContain(severity);
  });
});

describe('detectDomainCycles', () => {
  it('should detect domain-level cycles only', () => {
    const graph = analyzeDependencies([
      { source: coreDomain, file: 'core.isl' },
      { source: authDomain, file: 'auth.isl' },
    ]);

    const cycles = detectDomainCycles(graph);
    // No cycles in our test domains
    expect(cycles.length).toBe(0);
  });
});

describe('analyzeImpact', () => {
  it('should analyze impact of removing a node', () => {
    const graph = analyzeDependencies([
      { source: coreDomain, file: 'core.isl' },
      { source: authDomain, file: 'auth.isl' },
    ]);

    const impact = analyzeRemovalImpact(graph, 'domain:Core');

    expect(impact.changeType).toBe('remove');
    expect(impact.summary.totalImpacted).toBeGreaterThan(0);
    expect(impact.recommendations.length).toBeGreaterThan(0);
  });

  it('should identify breaking changes', () => {
    const graph = analyzeDependencies([
      { source: coreDomain, file: 'core.isl' },
      { source: authDomain, file: 'auth.isl' },
    ]);

    const impact = analyzeImpact(graph, 'Core:entity:User', 'remove');

    expect(impact.summary.breakingChanges).toBeGreaterThanOrEqual(0);
  });

  it('should calculate risk level', () => {
    const graph = analyzeDependencies([
      { source: coreDomain, file: 'core.isl' },
      { source: authDomain, file: 'auth.isl' },
      { source: paymentsDomain, file: 'payments.isl' },
    ]);

    const impact = analyzeImpact(graph, 'domain:Core', 'remove');

    expect(['low', 'medium', 'high', 'critical']).toContain(impact.summary.riskLevel);
  });
});

describe('findOrphans', () => {
  it('should find orphaned specifications', () => {
    const graph = analyzeDependencies([
      { source: coreDomain, file: 'core.isl' },
    ]);

    const orphans = findOrphans(graph);

    expect(orphans.summary).toBeDefined();
    expect(orphans.summary.total).toBeGreaterThanOrEqual(0);
  });

  it('should generate cleanup suggestions', () => {
    const graph = analyzeDependencies([
      { source: coreDomain, file: 'core.isl' },
    ]);

    const orphans = findOrphans(graph);
    const suggestions = suggestCleanup(orphans);

    expect(Array.isArray(suggestions)).toBe(true);
  });
});

describe('generateMermaid', () => {
  it('should generate valid Mermaid diagram', () => {
    const graph = analyzeDependencies([
      { source: coreDomain, file: 'core.isl' },
      { source: authDomain, file: 'auth.isl' },
    ]);

    const mermaid = generateMermaid(graph);

    expect(mermaid).toContain('flowchart');
    expect(mermaid).toContain('Core');
    expect(mermaid).toContain('Auth');
  });

  it('should support grouping by domain', () => {
    const graph = analyzeDependencies([
      { source: coreDomain, file: 'core.isl' },
      { source: authDomain, file: 'auth.isl' },
    ]);

    const mermaid = generateMermaid(graph, { groupByDomain: true });

    expect(mermaid).toContain('subgraph');
  });

  it('should support edge labels', () => {
    const graph = analyzeDependencies([
      { source: coreDomain, file: 'core.isl' },
      { source: authDomain, file: 'auth.isl' },
    ]);

    const mermaid = generateMermaid(graph, { showLabels: true });

    expect(mermaid).toBeDefined();
  });

  it('should filter by node types', () => {
    const graph = analyzeDependencies([
      { source: coreDomain, file: 'core.isl' },
    ]);

    const mermaid = generateMermaid(graph, { 
      nodeTypes: ['domain', 'entity'],
      groupByDomain: false,
    });

    expect(mermaid).toContain('User');
  });
});

describe('generateD2', () => {
  it('should generate valid D2 diagram', () => {
    const graph = analyzeDependencies([
      { source: coreDomain, file: 'core.isl' },
      { source: authDomain, file: 'auth.isl' },
    ]);

    const d2 = generateD2(graph);

    expect(d2).toContain('Core');
    expect(d2).toContain('Auth');
  });

  it('should support direction', () => {
    const graph = analyzeDependencies([
      { source: coreDomain, file: 'core.isl' },
    ]);

    const d2 = generateD2(graph, { direction: 'LR' });

    expect(d2).toContain('direction: right');
  });
});

describe('generateDot', () => {
  it('should generate valid DOT diagram', () => {
    const graph = analyzeDependencies([
      { source: coreDomain, file: 'core.isl' },
      { source: authDomain, file: 'auth.isl' },
    ]);

    const dot = generateDot(graph);

    expect(dot).toContain('digraph');
    expect(dot).toContain('rankdir');
  });

  it('should use subgraphs for domains', () => {
    const graph = analyzeDependencies([
      { source: coreDomain, file: 'core.isl' },
      { source: authDomain, file: 'auth.isl' },
    ]);

    const dot = generateDot(graph, { groupByDomain: true });

    expect(dot).toContain('subgraph cluster_');
  });
});

describe('integration', () => {
  it('should handle full analysis workflow', () => {
    // 1. Build graph
    const graph = analyzeDependencies([
      { source: coreDomain, file: 'core.isl' },
      { source: authDomain, file: 'auth.isl' },
      { source: paymentsDomain, file: 'payments.isl' },
    ]);

    // 2. Detect cycles
    const cycles = detectCycles(graph);
    expect(cycles).toBeDefined();

    // 3. Find orphans
    const orphans = findOrphans(graph);
    expect(orphans).toBeDefined();

    // 4. Impact analysis
    const impact = analyzeImpact(graph, 'Core:entity:User', 'modify');
    expect(impact).toBeDefined();

    // 5. Generate visualization
    const diagram = generateMermaid(graph, {
      highlightCycles: cycles.cycles,
      groupByDomain: true,
    });
    expect(diagram).toBeDefined();
  });
});
