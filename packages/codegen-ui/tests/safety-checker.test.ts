/**
 * Safety Checker Tests
 */

import { describe, it, expect } from 'vitest';
import { checkBlueprintSafety, toGateFindings } from '../src/safety-checker.js';
import type * as AST from '@isl-lang/isl-core/ast/types';

// Helper to create test blueprints
function createTestBlueprint(overrides: Partial<AST.UIBlueprintDeclaration> = {}): AST.UIBlueprintDeclaration {
  const emptySpan = { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } };
  
  return {
    kind: 'UIBlueprintDeclaration',
    name: { kind: 'Identifier', name: 'TestBlueprint', span: emptySpan },
    sections: [],
    span: emptySpan,
    ...overrides,
  };
}

function createSection(name: string, blocks: AST.UIContentBlock[]): AST.UISection {
  const emptySpan = { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } };
  
  return {
    kind: 'UISection',
    name: { kind: 'Identifier', name, span: emptySpan },
    type: 'content',
    blocks,
    span: emptySpan,
  };
}

function createBlock(
  type: AST.UIContentBlock['type'],
  props: Array<{ name: string; value: string | number | boolean }>
): AST.UIContentBlock {
  const emptySpan = { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } };
  
  return {
    kind: 'UIContentBlock',
    type,
    props: props.map(p => ({
      kind: 'UIBlockProperty' as const,
      name: { kind: 'Identifier' as const, name: p.name, span: emptySpan },
      value: typeof p.value === 'string' 
        ? { kind: 'StringLiteral' as const, value: p.value, span: emptySpan }
        : typeof p.value === 'number'
          ? { kind: 'NumberLiteral' as const, value: p.value, span: emptySpan }
          : { kind: 'BooleanLiteral' as const, value: p.value, span: emptySpan },
      span: emptySpan,
    })),
    span: emptySpan,
  };
}

describe('Safety Checker', () => {
  describe('Accessibility Checks', () => {
    it('should pass when images have alt text', () => {
      const blueprint = createTestBlueprint({
        sections: [
          createSection('hero', [
            createBlock('image', [
              { name: 'src', value: '/hero.jpg' },
              { name: 'alt', value: 'Hero image showing the product' },
            ]),
          ]),
        ],
      });

      const result = checkBlueprintSafety(blueprint);
      const imageCheck = result.checks.find(c => c.name.includes('image_alt'));
      
      expect(imageCheck?.passed).toBe(true);
    });

    it('should fail when images are missing alt text', () => {
      const blueprint = createTestBlueprint({
        sections: [
          createSection('hero', [
            createBlock('image', [
              { name: 'src', value: '/hero.jpg' },
            ]),
          ]),
        ],
      });

      const result = checkBlueprintSafety(blueprint);
      const imageCheck = result.checks.find(c => c.name.includes('image_alt'));
      
      expect(imageCheck?.passed).toBe(false);
    });

    it('should pass when buttons have labels', () => {
      const blueprint = createTestBlueprint({
        sections: [
          createSection('cta', [
            createBlock('button', [
              { name: 'label', value: 'Sign Up Now' },
              { name: 'href', value: '/signup' },
            ]),
          ]),
        ],
      });

      const result = checkBlueprintSafety(blueprint);
      const buttonCheck = result.checks.find(c => c.name.includes('button_name'));
      
      expect(buttonCheck?.passed).toBe(true);
    });
  });

  describe('Security Checks', () => {
    it('should pass when no secrets are present', () => {
      const blueprint = createTestBlueprint({
        sections: [
          createSection('hero', [
            createBlock('text', [
              { name: 'content', value: 'Welcome to our platform!' },
            ]),
          ]),
        ],
      });

      const result = checkBlueprintSafety(blueprint);
      const secretCheck = result.checks.find(c => c.name === 'no_inline_secrets');
      
      expect(secretCheck?.passed).toBe(true);
    });

    it('should fail when potential secrets are detected', () => {
      const blueprint = createTestBlueprint({
        sections: [
          createSection('hero', [
            createBlock('text', [
              { name: 'content', value: 'API Key: sk_live_abc123xyz' },
            ]),
          ]),
        ],
      });

      const result = checkBlueprintSafety(blueprint);
      const secretCheck = result.checks.find(c => c.name === 'no_inline_secrets');
      
      expect(secretCheck?.passed).toBe(false);
    });

    it('should pass when URLs are safe', () => {
      const blueprint = createTestBlueprint({
        sections: [
          createSection('footer', [
            createBlock('link', [
              { name: 'href', value: '/privacy' },
              { name: 'content', value: 'Privacy Policy' },
            ]),
          ]),
        ],
      });

      const result = checkBlueprintSafety(blueprint);
      const urlCheck = result.checks.find(c => c.name === 'safe_urls');
      
      expect(urlCheck?.passed).toBe(true);
    });

    it('should fail when javascript: URLs are used', () => {
      const blueprint = createTestBlueprint({
        sections: [
          createSection('footer', [
            createBlock('link', [
              { name: 'href', value: 'javascript:alert(1)' },
              { name: 'content', value: 'Click me' },
            ]),
          ]),
        ],
      });

      const result = checkBlueprintSafety(blueprint);
      const urlCheck = result.checks.find(c => c.name === 'safe_urls');
      
      expect(urlCheck?.passed).toBe(false);
    });
  });

  describe('SEO Checks', () => {
    it('should pass when page has exactly one h1', () => {
      const blueprint = createTestBlueprint({
        sections: [
          createSection('hero', [
            createBlock('heading', [
              { name: 'level', value: 1 },
              { name: 'content', value: 'Main Title' },
            ]),
          ]),
          createSection('features', [
            createBlock('heading', [
              { name: 'level', value: 2 },
              { name: 'content', value: 'Features' },
            ]),
          ]),
        ],
      });

      const result = checkBlueprintSafety(blueprint);
      const h1Check = result.checks.find(c => c.name === 'has_h1');
      const singleH1Check = result.checks.find(c => c.name === 'single_h1');
      
      expect(h1Check?.passed).toBe(true);
      expect(singleH1Check?.passed).toBe(true);
    });

    it('should warn when page has multiple h1 headings', () => {
      const blueprint = createTestBlueprint({
        sections: [
          createSection('hero', [
            createBlock('heading', [
              { name: 'level', value: 1 },
              { name: 'content', value: 'First Title' },
            ]),
          ]),
          createSection('features', [
            createBlock('heading', [
              { name: 'level', value: 1 },
              { name: 'content', value: 'Second Title' },
            ]),
          ]),
        ],
      });

      const result = checkBlueprintSafety(blueprint);
      const singleH1Check = result.checks.find(c => c.name === 'single_h1');
      
      expect(singleH1Check?.passed).toBe(false);
    });
  });

  describe('Gate Integration', () => {
    it('should convert failed checks to gate findings', () => {
      const blueprint = createTestBlueprint({
        sections: [
          createSection('hero', [
            createBlock('image', [
              { name: 'src', value: '/hero.jpg' },
              // Missing alt text
            ]),
            createBlock('link', [
              { name: 'href', value: 'javascript:void(0)' },
              { name: 'content', value: 'Bad link' },
            ]),
          ]),
        ],
      });

      const result = checkBlueprintSafety(blueprint);
      const findings = toGateFindings(result);
      
      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.type.includes('a11y'))).toBe(true);
      expect(findings.some(f => f.type.includes('security'))).toBe(true);
    });
  });
});
