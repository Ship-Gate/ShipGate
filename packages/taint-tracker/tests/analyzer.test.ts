import { describe, it, expect } from 'vitest';

describe('TaintAnalyzer', () => {
  async function analyze(code: string) {
    const { TaintAnalyzer } = await import('../src/index.js');
    const analyzer = new TaintAnalyzer();
    return analyzer.analyzeFile('test.ts', code);
  }

  it('detects req.body flowing to db.query (SQL injection)', async () => {
    const findings = await analyze(`
      import { Request, Response } from 'express';
      function handler(req: Request, res: Response) {
        const userId = req.body.id;
        db.query("SELECT * FROM users WHERE id=" + userId);
      }
    `);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some(f => f.sink.category === 'sql-query')).toBe(true);
  });

  it('recognizes sanitizer (validated input is safe)', async () => {
    const findings = await analyze(`
      import { z } from 'zod';
      function handler(req: any, res: any) {
        const input = z.string().parse(req.body.name);
        db.query("SELECT * FROM users WHERE name=$1", [input]);
      }
    `);
    const sqlFindings = findings.filter(f => f.sink.category === 'sql-query');
    expect(sqlFindings.length).toBe(0);
  });

  it('detects template literal SQL injection', async () => {
    const findings = await analyze(`
      function handler(req: any) {
        const id = req.query.id;
        db.query(\`SELECT * FROM users WHERE id = \${id}\`);
      }
    `);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('allows parameterized queries', async () => {
    const findings = await analyze(`
      function handler(req: any) {
        db.query("SELECT * FROM users WHERE id = $1", [req.query.id]);
      }
    `);
    const sqlFindings = findings.filter(f => f.sink.category === 'sql-query');
    expect(sqlFindings.length).toBe(0);
  });

  it('detects taint through function calls', async () => {
    const findings = await analyze(`
      function getInput(req: any) { return req.body.name; }
      function handler(req: any) {
        const name = getInput(req);
        eval(name);
      }
    `);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some(f => f.sink.category === 'eval')).toBe(true);
  });

  it('detects command injection via exec', async () => {
    const findings = await analyze(`
      import { exec } from 'child_process';
      function handler(req: any) {
        exec("ls " + req.query.dir);
      }
    `);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some(f => f.sink.category === 'shell-exec')).toBe(true);
  });
});
