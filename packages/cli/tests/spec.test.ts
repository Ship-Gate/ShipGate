import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  spec,
  listTemplates,
  getTemplate,
  TEMPLATES,
  type SpecResult,
  type TemplateInfo,
} from '../src/commands/spec.js';

// Test directory for file operations
const TEST_DIR = join(tmpdir(), 'isl-spec-test-' + Date.now());

describe('Spec Command', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('listTemplates', () => {
    it('should return all templates', () => {
      const templates = listTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates).toEqual(TEMPLATES);
    });

    it('should include both free and pro templates', () => {
      const templates = listTemplates();
      const freeTemplates = templates.filter((t) => !t.isPro);
      const proTemplates = templates.filter((t) => t.isPro);

      expect(freeTemplates.length).toBeGreaterThan(0);
      expect(proTemplates.length).toBeGreaterThan(0);
    });

    it('should have required fields on all templates', () => {
      const templates = listTemplates();

      for (const template of templates) {
        expect(template.name).toBeDefined();
        expect(template.name.length).toBeGreaterThan(0);
        expect(template.description).toBeDefined();
        expect(template.category).toBeDefined();
        expect(typeof template.isPro).toBe('boolean');
        expect(Array.isArray(template.tags)).toBe(true);
      }
    });
  });

  describe('getTemplate', () => {
    it('should return template by name', () => {
      const template = getTemplate('minimal');
      expect(template).toBeDefined();
      expect(template?.name).toBe('minimal');
    });

    it('should return undefined for unknown template', () => {
      const template = getTemplate('nonexistent-template');
      expect(template).toBeUndefined();
    });

    it('should find all known templates', () => {
      const knownNames = ['minimal', 'crud', 'api', 'auth', 'payment'];

      for (const name of knownNames) {
        const template = getTemplate(name);
        expect(template).toBeDefined();
        expect(template?.name).toBe(name);
      }
    });
  });

  describe('spec() with --templates', () => {
    it('should list all templates', async () => {
      const result = await spec({ templates: true });

      expect(result.success).toBe(true);
      expect(result.templates).toBeDefined();
      expect(result.templates?.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should include template info in result', async () => {
      const result = await spec({ templates: true });

      expect(result.templates).toBeDefined();
      const minimalTemplate = result.templates?.find((t) => t.name === 'minimal');
      expect(minimalTemplate).toBeDefined();
      expect(minimalTemplate?.category).toBe('starter');
      expect(minimalTemplate?.isPro).toBe(false);
    });
  });

  describe('spec() with --template', () => {
    it('should create spec from minimal template', async () => {
      const outPath = join(TEST_DIR, 'test.isl');
      const result = await spec({
        template: 'minimal',
        out: outPath,
      });

      expect(result.success).toBe(true);
      expect(result.filePath).toBe(outPath);
      expect(result.templateUsed).toBe('minimal');
      expect(existsSync(outPath)).toBe(true);
    });

    it('should create spec from crud template', async () => {
      const outPath = join(TEST_DIR, 'crud.isl');
      const result = await spec({
        template: 'crud',
        out: outPath,
      });

      expect(result.success).toBe(true);
      expect(existsSync(outPath)).toBe(true);

      const content = readFileSync(outPath, 'utf-8');
      expect(content).toContain('domain');
      expect(content).toContain('entity Resource');
    });

    it('should apply name variable to template', async () => {
      const outPath = join(TEST_DIR, 'myapp.isl');
      const result = await spec({
        template: 'minimal',
        out: outPath,
        name: 'MyApp',
      });

      expect(result.success).toBe(true);

      const content = readFileSync(outPath, 'utf-8');
      expect(content).toContain('domain MyApp');
    });

    it('should fail for unknown template', async () => {
      const result = await spec({
        template: 'unknown-template',
        out: join(TEST_DIR, 'test.isl'),
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Unknown template');
    });

    it('should fail for pro templates without access', async () => {
      const result = await spec({
        template: 'distributed',
        out: join(TEST_DIR, 'test.isl'),
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('Pro'))).toBe(true);
      expect(result.errors.some((e) => e.includes('billing'))).toBe(true);
    });

    it('should fail when file exists without --force', async () => {
      const outPath = join(TEST_DIR, 'existing.isl');
      // Create existing file
      require('fs').writeFileSync(outPath, 'existing content');

      const result = await spec({
        template: 'minimal',
        out: outPath,
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('already exists');
    });

    it('should overwrite file with --force', async () => {
      const outPath = join(TEST_DIR, 'overwrite.isl');
      // Create existing file
      require('fs').writeFileSync(outPath, 'old content');

      const result = await spec({
        template: 'minimal',
        out: outPath,
        force: true,
      });

      expect(result.success).toBe(true);

      const content = readFileSync(outPath, 'utf-8');
      expect(content).toContain('domain');
      expect(content).not.toContain('old content');
    });

    it('should create directories if needed', async () => {
      const outPath = join(TEST_DIR, 'nested', 'dir', 'spec.isl');

      const result = await spec({
        template: 'minimal',
        out: outPath,
      });

      expect(result.success).toBe(true);
      expect(existsSync(outPath)).toBe(true);
    });
  });

  describe('spec() without options', () => {
    it('should fail with helpful message', async () => {
      const result = await spec({});

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('No action specified');
    });
  });

  describe('Template categories', () => {
    it('should have starter templates', () => {
      const starters = TEMPLATES.filter((t) => t.category === 'starter');
      expect(starters.length).toBeGreaterThan(0);
      expect(starters.every((t) => !t.isPro)).toBe(true);
    });

    it('should have domain templates', () => {
      const domains = TEMPLATES.filter((t) => t.category === 'domain');
      expect(domains.length).toBeGreaterThan(0);
    });

    it('should have pro templates', () => {
      const proTemplates = TEMPLATES.filter((t) => t.isPro);
      expect(proTemplates.length).toBeGreaterThan(0);
      expect(proTemplates.every((t) => t.category === 'advanced' || t.category === 'pro')).toBe(true);
    });
  });

  describe('JSON output', () => {
    it('should return structured data for templates list', async () => {
      const result = await spec({ templates: true });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('templates');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.templates)).toBe(true);
    });

    it('should return structured data for spec creation', async () => {
      const outPath = join(TEST_DIR, 'json-test.isl');
      const result = await spec({
        template: 'minimal',
        out: outPath,
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('filePath');
      expect(result).toHaveProperty('templateUsed');
      expect(result).toHaveProperty('errors');
    });
  });
});
