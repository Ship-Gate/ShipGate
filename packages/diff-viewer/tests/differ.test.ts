// ============================================================================
// Differ Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  computeTextDiff,
  computeSemanticDiff,
  generateDiffSummary,
} from '../src/lib/differ';

describe('Text Diff', () => {
  it('should detect no changes for identical content', () => {
    const content = 'domain Test { version: "1.0.0" }';
    const diff = computeTextDiff(content, content);

    expect(diff.additions).toBe(0);
    expect(diff.deletions).toBe(0);
    expect(diff.hunks.length).toBe(0);
  });

  it('should detect additions', () => {
    const oldContent = 'line1\nline2';
    const newContent = 'line1\nline2\nline3';
    const diff = computeTextDiff(oldContent, newContent);

    expect(diff.additions).toBe(1);
    expect(diff.deletions).toBe(0);
  });

  it('should detect deletions', () => {
    const oldContent = 'line1\nline2\nline3';
    const newContent = 'line1\nline2';
    const diff = computeTextDiff(oldContent, newContent);

    expect(diff.additions).toBe(0);
    expect(diff.deletions).toBe(1);
  });

  it('should detect modifications', () => {
    const oldContent = 'line1\nold line\nline3';
    const newContent = 'line1\nnew line\nline3';
    const diff = computeTextDiff(oldContent, newContent);

    expect(diff.additions).toBeGreaterThan(0);
    expect(diff.deletions).toBeGreaterThan(0);
  });
});

describe('Semantic Diff', () => {
  it('should detect version change', () => {
    const oldContent = `domain Test {
      version: "1.0.0"
    }`;
    const newContent = `domain Test {
      version: "2.0.0"
    }`;

    const changes = computeSemanticDiff(oldContent, newContent);
    const versionChange = changes.find((c) => c.type === 'domain_version_changed');

    expect(versionChange).toBeDefined();
    expect(versionChange?.oldValue).toBe('1.0.0');
    expect(versionChange?.newValue).toBe('2.0.0');
  });

  it('should detect entity addition', () => {
    const oldContent = `domain Test {
      version: "1.0.0"
    }`;
    const newContent = `domain Test {
      version: "1.0.0"
      
      entity User {
        id: UUID
      }
    }`;

    const changes = computeSemanticDiff(oldContent, newContent);
    const entityAdded = changes.find((c) => c.type === 'entity_added');

    expect(entityAdded).toBeDefined();
    expect(entityAdded?.path).toContain('User');
    expect(entityAdded?.breakingLevel).toBe('safe');
  });

  it('should detect entity removal as breaking', () => {
    const oldContent = `domain Test {
      version: "1.0.0"
      
      entity User {
        id: UUID
      }
    }`;
    const newContent = `domain Test {
      version: "1.0.0"
    }`;

    const changes = computeSemanticDiff(oldContent, newContent);
    const entityRemoved = changes.find((c) => c.type === 'entity_removed');

    expect(entityRemoved).toBeDefined();
    expect(entityRemoved?.breakingLevel).toBe('breaking');
  });

  it('should detect field addition', () => {
    const oldContent = `domain Test {
      version: "1.0.0"
      
      entity User {
        id: UUID
      }
    }`;
    const newContent = `domain Test {
      version: "1.0.0"
      
      entity User {
        id: UUID
        name: String
      }
    }`;

    const changes = computeSemanticDiff(oldContent, newContent);
    const fieldAdded = changes.find((c) => c.type === 'field_added');

    expect(fieldAdded).toBeDefined();
    expect(fieldAdded?.path).toContain('name');
  });

  it('should detect optional field addition as safe', () => {
    const oldContent = `domain Test {
      version: "1.0.0"
      
      entity User {
        id: UUID
      }
    }`;
    const newContent = `domain Test {
      version: "1.0.0"
      
      entity User {
        id: UUID
        nickname?: String
      }
    }`;

    const changes = computeSemanticDiff(oldContent, newContent);
    const fieldAdded = changes.find((c) => c.type === 'field_added');

    expect(fieldAdded).toBeDefined();
    expect(fieldAdded?.breakingLevel).toBe('safe');
  });

  it('should detect required field addition as breaking', () => {
    const oldContent = `domain Test {
      version: "1.0.0"
      
      entity User {
        id: UUID
      }
    }`;
    const newContent = `domain Test {
      version: "1.0.0"
      
      entity User {
        id: UUID
        email: String
      }
    }`;

    const changes = computeSemanticDiff(oldContent, newContent);
    const fieldAdded = changes.find((c) => c.type === 'field_added');

    expect(fieldAdded).toBeDefined();
    expect(fieldAdded?.breakingLevel).toBe('breaking');
  });

  it('should detect field removal as breaking', () => {
    const oldContent = `domain Test {
      version: "1.0.0"
      
      entity User {
        id: UUID
        name: String
      }
    }`;
    const newContent = `domain Test {
      version: "1.0.0"
      
      entity User {
        id: UUID
      }
    }`;

    const changes = computeSemanticDiff(oldContent, newContent);
    const fieldRemoved = changes.find((c) => c.type === 'field_removed');

    expect(fieldRemoved).toBeDefined();
    expect(fieldRemoved?.breakingLevel).toBe('breaking');
  });

  it('should detect field type change as breaking', () => {
    const oldContent = `domain Test {
      version: "1.0.0"
      
      entity User {
        id: UUID
        age: String
      }
    }`;
    const newContent = `domain Test {
      version: "1.0.0"
      
      entity User {
        id: UUID
        age: Int
      }
    }`;

    const changes = computeSemanticDiff(oldContent, newContent);
    const typeChange = changes.find((c) => c.type === 'field_type_changed');

    expect(typeChange).toBeDefined();
    expect(typeChange?.breakingLevel).toBe('breaking');
    expect(typeChange?.oldValue).toBe('String');
    expect(typeChange?.newValue).toBe('Int');
  });

  it('should detect field made optional as safe', () => {
    const oldContent = `domain Test {
      version: "1.0.0"
      
      entity User {
        id: UUID
        name: String
      }
    }`;
    const newContent = `domain Test {
      version: "1.0.0"
      
      entity User {
        id: UUID
        name?: String
      }
    }`;

    const changes = computeSemanticDiff(oldContent, newContent);
    const optionalChange = changes.find((c) => c.type === 'field_made_optional');

    expect(optionalChange).toBeDefined();
    expect(optionalChange?.breakingLevel).toBe('safe');
  });

  it('should detect field made required as breaking', () => {
    const oldContent = `domain Test {
      version: "1.0.0"
      
      entity User {
        id: UUID
        name?: String
      }
    }`;
    const newContent = `domain Test {
      version: "1.0.0"
      
      entity User {
        id: UUID
        name: String
      }
    }`;

    const changes = computeSemanticDiff(oldContent, newContent);
    const requiredChange = changes.find((c) => c.type === 'field_made_required');

    expect(requiredChange).toBeDefined();
    expect(requiredChange?.breakingLevel).toBe('breaking');
  });

  it('should detect behavior addition', () => {
    const oldContent = `domain Test {
      version: "1.0.0"
    }`;
    const newContent = `domain Test {
      version: "1.0.0"
      
      behavior CreateUser {
        input { name: String }
      }
    }`;

    const changes = computeSemanticDiff(oldContent, newContent);
    const behaviorAdded = changes.find((c) => c.type === 'behavior_added');

    expect(behaviorAdded).toBeDefined();
    expect(behaviorAdded?.breakingLevel).toBe('safe');
  });

  it('should detect behavior removal as breaking', () => {
    const oldContent = `domain Test {
      version: "1.0.0"
      
      behavior CreateUser {
        input { name: String }
      }
    }`;
    const newContent = `domain Test {
      version: "1.0.0"
    }`;

    const changes = computeSemanticDiff(oldContent, newContent);
    const behaviorRemoved = changes.find((c) => c.type === 'behavior_removed');

    expect(behaviorRemoved).toBeDefined();
    expect(behaviorRemoved?.breakingLevel).toBe('breaking');
  });

  it('should detect type addition', () => {
    const oldContent = `domain Test {
      version: "1.0.0"
    }`;
    const newContent = `domain Test {
      version: "1.0.0"
      
      type Email = String
    }`;

    const changes = computeSemanticDiff(oldContent, newContent);
    const typeAdded = changes.find((c) => c.type === 'type_added');

    expect(typeAdded).toBeDefined();
    expect(typeAdded?.breakingLevel).toBe('safe');
  });

  it('should detect type removal as breaking', () => {
    const oldContent = `domain Test {
      version: "1.0.0"
      
      type Email = String
    }`;
    const newContent = `domain Test {
      version: "1.0.0"
    }`;

    const changes = computeSemanticDiff(oldContent, newContent);
    const typeRemoved = changes.find((c) => c.type === 'type_removed');

    expect(typeRemoved).toBeDefined();
    expect(typeRemoved?.breakingLevel).toBe('breaking');
  });
});

describe('Diff Summary', () => {
  it('should generate migration hints for breaking changes', () => {
    const oldContent = `domain Test {
      version: "1.0.0"
      
      entity User {
        id: UUID
        name: String
      }
    }`;
    const newContent = `domain Test {
      version: "2.0.0"
      
      entity User {
        id: UUID
      }
    }`;

    const summary = generateDiffSummary(oldContent, newContent);

    expect(summary.breakingChanges).toBeGreaterThan(0);
    expect(summary.migrationHints.length).toBeGreaterThan(0);
  });

  it('should count all change types', () => {
    const oldContent = `domain Test {
      version: "1.0.0"
      
      entity User {
        id: UUID
      }
    }`;
    const newContent = `domain Test {
      version: "2.0.0"
      
      entity User {
        id: UUID
        email: String
      }
      
      entity Post {
        id: UUID
      }
    }`;

    const summary = generateDiffSummary(oldContent, newContent);

    expect(summary.totalChanges).toBeGreaterThan(0);
    expect(summary.additions).toBeGreaterThan(0);
  });
});
