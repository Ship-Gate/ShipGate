/**
 * Survivor Analysis
 * 
 * Analyzes surviving mutants to suggest better tests.
 */

import {
  Mutant,
  MutationType,
  SurvivorAnalysis,
  SurvivorCause,
} from './types';

/**
 * Analyze surviving mutants
 */
export class SurvivorAnalyzer {
  /**
   * Analyze all survivors and suggest improvements
   */
  analyze(survivors: Mutant[]): SurvivorAnalysis[] {
    const analyses: SurvivorAnalysis[] = [];

    for (const mutant of survivors) {
      const analysis = this.analyzeMutant(mutant);
      analyses.push(analysis);
    }

    // Sort by priority
    analyses.sort((a, b) => a.priority - b.priority);

    // Find related survivors
    this.findRelatedSurvivors(analyses);

    return analyses;
  }

  /**
   * Analyze a single surviving mutant
   */
  private analyzeMutant(mutant: Mutant): SurvivorAnalysis {
    const cause = this.determineCause(mutant);
    const suggestedTest = this.suggestTest(mutant, cause);
    const testTemplate = this.generateTestTemplate(mutant, cause);
    const priority = this.calculatePriority(mutant, cause);

    return {
      mutant,
      likelyCause: cause,
      suggestedTest,
      testTemplate,
      priority,
      relatedSurvivors: [],
    };
  }

  /**
   * Determine likely cause of survival
   */
  private determineCause(mutant: Mutant): SurvivorCause {
    switch (mutant.type) {
      case 'boundary':
        return 'boundary_not_tested';
      
      case 'error':
        return 'error_path_not_tested';
      
      case 'null':
        return 'missing_test';
      
      case 'comparison':
      case 'logical':
        // Check if it's a complex condition
        if (mutant.original.includes('and') || mutant.original.includes('or')) {
          return 'complex_condition';
        }
        return 'weak_assertion';
      
      case 'temporal':
        return 'missing_test';
      
      default:
        return 'missing_test';
    }
  }

  /**
   * Suggest a test to kill the mutant
   */
  private suggestTest(mutant: Mutant, cause: SurvivorCause): string {
    const suggestions: Record<SurvivorCause, (m: Mutant) => string> = {
      missing_test: (m) => 
        `Add a test that verifies the behavior when ${m.description.toLowerCase()}`,
      
      weak_assertion: (m) => 
        `Strengthen assertions to check that ${m.original} produces different results than ${m.mutated}`,
      
      boundary_not_tested: (m) => 
        `Add boundary value tests for ${extractField(m.original)} at exact boundary values`,
      
      error_path_not_tested: (m) => 
        `Add a test that triggers the error condition and verifies error handling`,
      
      equivalent_mutant: () => 
        `This mutant may be equivalent (behavior unchanged). Consider marking as equivalent.`,
      
      complex_condition: (m) => 
        `Add tests for each branch of the condition: test when ${m.original} and when ${m.mutated}`,
    };

    return suggestions[cause](mutant);
  }

  /**
   * Generate a test template
   */
  private generateTestTemplate(mutant: Mutant, cause: SurvivorCause): string {
    const templates: Record<SurvivorCause, (m: Mutant) => string> = {
      missing_test: (m) => this.templateMissingTest(m),
      weak_assertion: (m) => this.templateWeakAssertion(m),
      boundary_not_tested: (m) => this.templateBoundaryTest(m),
      error_path_not_tested: (m) => this.templateErrorTest(m),
      equivalent_mutant: () => '// Mark as equivalent mutant',
      complex_condition: (m) => this.templateComplexCondition(m),
    };

    return templates[cause](mutant);
  }

  /**
   * Template for missing test
   */
  private templateMissingTest(mutant: Mutant): string {
    return `
describe('${extractBehavior(mutant)}', () => {
  it('should ${mutant.description.toLowerCase()}', async () => {
    // Arrange
    const input = {
      // TODO: Set up input that exercises this code path
    };

    // Act
    const result = await ${extractBehavior(mutant)}(input);

    // Assert
    expect(result).toSatisfy((r) => {
      // TODO: Add assertion that would fail if ${mutant.mutated}
      return true;
    });
  });
});`.trim();
  }

  /**
   * Template for weak assertion
   */
  private templateWeakAssertion(mutant: Mutant): string {
    return `
describe('${extractBehavior(mutant)}', () => {
  it('should verify ${extractField(mutant.original)}', async () => {
    // Arrange
    const input = { /* specific input */ };

    // Act
    const result = await ${extractBehavior(mutant)}(input);

    // Assert - be specific about expected value
    // Original: ${mutant.original}
    // Mutated:  ${mutant.mutated}
    expect(result.${extractField(mutant.original)}).toBe(/* expected value */);
    
    // Also verify it's NOT the mutated value
    expect(result.${extractField(mutant.original)}).not.toBe(/* mutated value */);
  });
});`.trim();
  }

  /**
   * Template for boundary test
   */
  private templateBoundaryTest(mutant: Mutant): string {
    const field = extractField(mutant.original);
    const boundary = extractNumber(mutant.original) || 0;

    return `
describe('${extractBehavior(mutant)} boundary tests', () => {
  it('should reject ${field} at boundary - 1', async () => {
    const input = { ${field}: ${boundary - 1} };
    await expect(${extractBehavior(mutant)}(input)).rejects.toThrow();
  });

  it('should accept ${field} at exact boundary', async () => {
    const input = { ${field}: ${boundary} };
    const result = await ${extractBehavior(mutant)}(input);
    expect(result.ok).toBe(true);
  });

  it('should accept ${field} at boundary + 1', async () => {
    const input = { ${field}: ${boundary + 1} };
    const result = await ${extractBehavior(mutant)}(input);
    expect(result.ok).toBe(true);
  });
});`.trim();
  }

  /**
   * Template for error path test
   */
  private templateErrorTest(mutant: Mutant): string {
    const errorCode = extractErrorCode(mutant.original);

    return `
describe('${extractBehavior(mutant)} error handling', () => {
  it('should return ${errorCode} when condition is met', async () => {
    // Arrange - set up condition that triggers error
    const input = {
      // TODO: Input that triggers ${errorCode}
    };

    // Act
    const result = await ${extractBehavior(mutant)}(input);

    // Assert
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('${errorCode}');
  });

  it('should have correct retriable flag for ${errorCode}', async () => {
    // Test the retriable behavior
    const input = { /* trigger error */ };
    const result = await ${extractBehavior(mutant)}(input);
    
    expect(result.error.retriable).toBe(/* expected value */);
  });
});`.trim();
  }

  /**
   * Template for complex condition test
   */
  private templateComplexCondition(mutant: Mutant): string {
    return `
describe('${extractBehavior(mutant)} condition coverage', () => {
  // Original: ${mutant.original}
  // Mutated:  ${mutant.mutated}
  
  it('should handle case where first condition is true', async () => {
    const input = { /* first condition true, second false */ };
    const result = await ${extractBehavior(mutant)}(input);
    expect(result).toMatchObject({ /* expected */ });
  });

  it('should handle case where second condition is true', async () => {
    const input = { /* first condition false, second true */ };
    const result = await ${extractBehavior(mutant)}(input);
    expect(result).toMatchObject({ /* expected */ });
  });

  it('should handle case where both conditions are true', async () => {
    const input = { /* both true */ };
    const result = await ${extractBehavior(mutant)}(input);
    expect(result).toMatchObject({ /* expected */ });
  });

  it('should handle case where both conditions are false', async () => {
    const input = { /* both false */ };
    const result = await ${extractBehavior(mutant)}(input);
    expect(result).toMatchObject({ /* expected */ });
  });
});`.trim();
  }

  /**
   * Calculate priority (lower = more important)
   */
  private calculatePriority(mutant: Mutant, cause: SurvivorCause): number {
    // Priority based on mutation type
    const typePriority: Record<MutationType, number> = {
      precondition: 1,
      postcondition: 2,
      invariant: 2,
      error: 3,
      boundary: 4,
      comparison: 5,
      logical: 5,
      null: 6,
      temporal: 7,
      constraint: 8,
      lifecycle: 8,
      arithmetic: 9,
    };

    // Adjust based on cause
    const causeAdjustment: Record<SurvivorCause, number> = {
      missing_test: 0,
      error_path_not_tested: 1,
      boundary_not_tested: 2,
      weak_assertion: 3,
      complex_condition: 4,
      equivalent_mutant: 10,
    };

    return (typePriority[mutant.type] || 5) + (causeAdjustment[cause] || 0);
  }

  /**
   * Find related survivors (same file/area)
   */
  private findRelatedSurvivors(analyses: SurvivorAnalysis[]): void {
    for (const analysis of analyses) {
      const related = analyses
        .filter((a) => 
          a.mutant.id !== analysis.mutant.id &&
          a.mutant.location.file === analysis.mutant.location.file &&
          Math.abs(a.mutant.location.startLine - analysis.mutant.location.startLine) <= 10
        )
        .map((a) => a.mutant.id);
      
      analysis.relatedSurvivors = related;
    }
  }
}

/**
 * Analyze survivors (convenience function)
 */
export function analyzeSurvivors(survivors: Mutant[]): SurvivorAnalysis[] {
  const analyzer = new SurvivorAnalyzer();
  return analyzer.analyze(survivors);
}

/**
 * Format survivor analysis as text
 */
export function formatSurvivorAnalysis(analyses: SurvivorAnalysis[]): string {
  const lines: string[] = [];

  lines.push('SURVIVING MUTANT ANALYSIS');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');

  for (const analysis of analyses.slice(0, 10)) {
    lines.push(`Priority ${analysis.priority}: ${analysis.mutant.description}`);
    lines.push(`  Location: ${analysis.mutant.location.file}:${analysis.mutant.location.startLine}`);
    lines.push(`  Cause: ${analysis.likelyCause.replace(/_/g, ' ')}`);
    lines.push(`  Suggestion: ${analysis.suggestedTest}`);
    if (analysis.relatedSurvivors.length > 0) {
      lines.push(`  Related: ${analysis.relatedSurvivors.length} similar survivors nearby`);
    }
    lines.push('');
  }

  if (analyses.length > 10) {
    lines.push(`... and ${analyses.length - 10} more survivors`);
  }

  return lines.join('\n');
}

// Helper functions
function extractBehavior(mutant: Mutant): string {
  const path = mutant.location.nodePath || [];
  const behaviorIndex = path.indexOf('behaviors');
  if (behaviorIndex >= 0 && path[behaviorIndex + 1]) {
    return path[behaviorIndex + 1];
  }
  return 'behavior';
}

function extractField(str: string): string {
  const match = str.match(/(\w+)\s*[=<>!]/);
  return match ? match[1] : 'field';
}

function extractNumber(str: string): number | null {
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function extractErrorCode(str: string): string {
  const match = str.match(/([A-Z_]+)/);
  return match ? match[1] : 'ERROR';
}
