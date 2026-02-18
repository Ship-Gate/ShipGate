import * as fs from 'fs';
import * as path from 'path';
import type { PropertyProver, PropertyProof, ProjectContext, SecretEvidence, Finding } from './types.js';

const SECRET_PATTERNS = [
  { name: 'stripe_live_key', pattern: /sk_live_[a-zA-Z0-9]{24,}/, severity: 'error' as const },
  { name: 'stripe_publishable_key', pattern: /pk_live_[a-zA-Z0-9]{24,}/, severity: 'warning' as const },
  { name: 'github_token', pattern: /ghp_[a-zA-Z0-9]{36,}/, severity: 'error' as const },
  { name: 'aws_access_key', pattern: /AKIA[0-9A-Z]{16}/, severity: 'error' as const },
  { name: 'private_key', pattern: /-----BEGIN.*PRIVATE KEY-----/, severity: 'error' as const },
  { name: 'generic_api_key', pattern: /api[_-]?key['"]\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/, severity: 'warning' as const },
  { name: 'connection_string', pattern: /(?:mongodb|postgres|mysql):\/\/[^'"]+:[^'"]+@/, severity: 'error' as const },
];

const SENSITIVE_VAR_NAMES = [
  'password', 'secret', 'apiKey', 'api_key', 'token', 'accessToken', 
  'refreshToken', 'privateKey', 'connectionString', 'databaseUrl'
];

export class SecretExposureProver implements PropertyProver {
  id = 'tier1-secret-exposure';
  name = 'Secret Exposure Prevention';
  tier = 1 as const;

  async prove(project: ProjectContext): Promise<PropertyProof> {
    const start = Date.now();
    const evidence: SecretEvidence[] = [];
    const findings: Finding[] = [];

    for (const file of project.sourceFiles) {
      try {
        const content = await fs.promises.readFile(file, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
          const lineNum = idx + 1;

          // Pattern matching for known secret formats
          for (const { name, pattern, severity } of SECRET_PATTERNS) {
            const match = line.match(pattern);
            if (match) {
              evidence.push({
                file,
                line: lineNum,
                pattern: name,
                context: line.trim().substring(0, 100),
              });

              findings.push({
                file,
                line: lineNum,
                severity,
                message: `Hardcoded ${name} detected`,
                suggestion: `Move to environment variable and reference via process.env`,
              });
            }
          }

          // Sensitive variable assignment check
          for (const varName of SENSITIVE_VAR_NAMES) {
            const varPattern = new RegExp(`\\b${varName}\\b\\s*[:=]\\s*['"\`]([^'"\`]+)['"\`]`, 'i');
            const match = line.match(varPattern);
            if (match && match[1] && match[1].length > 8) {
              evidence.push({
                file,
                line: lineNum,
                pattern: 'sensitive_var_assignment',
                variableName: varName,
                context: line.trim().substring(0, 100),
              });

              findings.push({
                file,
                line: lineNum,
                severity: 'error',
                message: `Sensitive variable "${varName}" assigned string literal`,
                suggestion: `Use process.env.${varName.toUpperCase()}`,
              });
            }
          }

          // Entropy analysis for random-looking strings
          const stringLiterals = line.match(/['"`]([a-zA-Z0-9+/=_-]{20,})['"`]/g);
          if (stringLiterals) {
            for (const literal of stringLiterals) {
              const value = literal.slice(1, -1);
              const entropy = this.calculateEntropy(value);
              
              if (entropy > 4.5 && value.length >= 20) {
                evidence.push({
                  file,
                  line: lineNum,
                  pattern: 'high_entropy_string',
                  entropy,
                  context: line.trim().substring(0, 100),
                });

                findings.push({
                  file,
                  line: lineNum,
                  severity: 'warning',
                  message: `High-entropy string detected (${entropy.toFixed(2)} bits/char, length ${value.length})`,
                  suggestion: 'Verify this is not a hardcoded secret',
                });
              }
            }
          }
        });
      } catch (err) {
        // Skip files that can't be read
      }
    }

    // Check .env in .gitignore
    const gitignoreChecks = await this.checkGitignore(project);
    findings.push(...gitignoreChecks.findings);

    // Check for client-side secret exposure
    const clientSideChecks = await this.checkClientSideExposure(project, evidence);
    findings.push(...clientSideChecks);

    // Check process.env references have .env.example entries
    const envExampleChecks = await this.checkEnvExample(project);
    findings.push(...envExampleChecks);

    const duration_ms = Date.now() - start;
    const criticalFindings = findings.filter(f => f.severity === 'error');

    return {
      property: 'secret-exposure',
      status: criticalFindings.length === 0 ? (findings.length === 0 ? 'PROVEN' : 'PARTIAL') : 'FAILED',
      summary: criticalFindings.length === 0 
        ? `No hardcoded secrets detected. Scanned ${project.sourceFiles.length} files.`
        : `${criticalFindings.length} critical secret exposure(s) found`,
      evidence,
      findings,
      method: 'pattern-matching',
      confidence: 'high',
      duration_ms,
    };
  }

  private calculateEntropy(str: string): number {
    const freq = new Map<string, number>();
    for (const char of str) {
      freq.set(char, (freq.get(char) || 0) + 1);
    }

    let entropy = 0;
    const len = str.length;
    for (const count of freq.values()) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  private async checkGitignore(project: ProjectContext): Promise<{ findings: Finding[] }> {
    const findings: Finding[] = [];

    if (project.gitignorePath) {
      try {
        const content = await fs.promises.readFile(project.gitignorePath, 'utf-8');
        if (!content.includes('.env') && !content.includes('*.env')) {
          findings.push({
            file: project.gitignorePath,
            line: 0,
            severity: 'error',
            message: '.env files not gitignored',
            suggestion: 'Add .env to .gitignore',
          });
        }
      } catch {
        findings.push({
          file: project.rootPath,
          line: 0,
          severity: 'warning',
          message: 'No .gitignore found',
          suggestion: 'Create .gitignore and add .env',
        });
      }
    }

    return { findings };
  }

  private async checkClientSideExposure(
    project: ProjectContext,
    evidence: SecretEvidence[]
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    for (const ev of evidence) {
      const relPath = path.relative(project.rootPath, ev.file);
      
      // Next.js: files under app/ without 'use server'
      if (relPath.includes('app/') && !relPath.includes('api/')) {
        try {
          const content = await fs.promises.readFile(ev.file, 'utf-8');
          if (!content.includes("'use server'") && !content.includes('"use server"')) {
            findings.push({
              file: ev.file,
              line: ev.line,
              severity: 'error',
              message: 'Secret in client-accessible code (Next.js app directory)',
              suggestion: 'Move to API route or server action',
            });
          }
        } catch {
          // Skip
        }
      }

      // Any component/page files
      if (relPath.match(/\.(tsx|jsx)$/)) {
        findings.push({
          file: ev.file,
          line: ev.line,
          severity: 'warning',
          message: 'Potential secret in frontend code',
          suggestion: 'Verify this code runs server-side only',
        });
      }
    }

    return findings;
  }

  private async checkEnvExample(project: ProjectContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const envExamplePath = path.join(project.rootPath, '.env.example');

    let envExampleVars: Set<string> | null = null;
    try {
      const content = await fs.promises.readFile(envExamplePath, 'utf-8');
      envExampleVars = new Set(
        content.split('\n')
          .filter(line => line.includes('='))
          .map(line => line.split('=')[0]!.trim())
      );
    } catch {
      // No .env.example
    }

    for (const file of project.sourceFiles) {
      try {
        const content = await fs.promises.readFile(file, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
          const envMatch = line.match(/process\.env\.([A-Z_][A-Z0-9_]*)/g);
          if (envMatch && envExampleVars) {
            for (const match of envMatch) {
              const varName = match.replace('process.env.', '');
              if (!envExampleVars.has(varName)) {
                findings.push({
                  file,
                  line: idx + 1,
                  severity: 'warning',
                  message: `${varName} used but not in .env.example`,
                  suggestion: `Add ${varName}= to .env.example`,
                });
              }
            }
          }
        });
      } catch {
        // Skip
      }
    }

    return findings;
  }
}
