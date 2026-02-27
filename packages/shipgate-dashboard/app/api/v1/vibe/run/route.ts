import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { resolve } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { authenticate, requireAdminOrMember } from '@/lib/api-auth';

const CLI_PATH = resolve(process.cwd(), '../cli/dist/cli.cjs');

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const roleErr = requireAdminOrMember(auth);
  if (roleErr) return roleErr;

  const body = (await req.json()) as {
    prompt: string;
    framework?: string;
    database?: string;
    lang?: string;
    frontend?: boolean;
    tests?: boolean;
  };

  const prompt = body.prompt?.trim();
  if (!prompt || prompt.length < 3) {
    return NextResponse.json(
      { error: 'Prompt must be at least 3 characters' },
      { status: 400 }
    );
  }

  let outputDir: string;
  try {
    outputDir = await mkdtemp(join(tmpdir(), 'shipgate-vibe-'));
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to create output directory' },
      { status: 500 }
    );
  }

  const args = [
    'vibe',
    prompt,
    '--format',
    'json',
    '--output',
    outputDir,
    '--framework',
    body.framework ?? 'nextjs',
    '--database',
    body.database ?? 'sqlite',
    '--lang',
    body.lang ?? 'typescript',
  ];
  if (body.frontend !== false) args.push('--frontend');
  if (body.tests !== false) args.push('--tests');

  return new Promise<NextResponse>((resolveResponse) => {
    let resolved = false;
    const safeResolve = (r: NextResponse) => {
      if (!resolved) {
        resolved = true;
        resolveResponse(r);
      }
    };
    const proc = spawn('node', [CLI_PATH, ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? process.env.ISL_ANTHROPIC_KEY ?? '',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? process.env.ISL_OPENAI_KEY ?? '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', async (code) => {
      try {
        await rm(outputDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }

      if (code !== 0) {
        safeResolve(
          NextResponse.json(
            {
              error: stderr.trim() || 'Vibe pipeline failed',
              stdout: stdout.slice(-2000),
            },
            { status: 500 }
          )
        );
        return;
      }

      let parsed: Record<string, unknown>;
      try {
        const idx = stdout.lastIndexOf('\n{\n');
        const jsonStr = idx >= 0 ? stdout.slice(idx).trim() : stdout.trim();
        const candidate = jsonStr.slice(jsonStr.lastIndexOf('{'));
        parsed = candidate ? (JSON.parse(candidate) as Record<string, unknown>) : {};
        if (!('success' in parsed) && !('verdict' in parsed)) {
          const lines = stdout.split('\n').filter(Boolean);
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i]!;
            if (line.includes('"success"') || line.includes('"verdict"')) {
              const m = stdout.slice(stdout.indexOf(line)).match(/\{[\s\S]*\}/);
              if (m) {
                parsed = JSON.parse(m[0]) as Record<string, unknown>;
                break;
              }
            }
          }
        }
      } catch {
        parsed = { success: false, error: 'Could not parse output' };
      }

      safeResolve(NextResponse.json({ data: parsed }));
    });

    proc.on('error', (err) => {
      safeResolve(
        NextResponse.json(
          { error: err.message || 'Failed to start CLI' },
          { status: 500 }
        )
      );
    });

    setTimeout(() => {
      if (proc.kill('SIGTERM')) {
        safeResolve(
          NextResponse.json(
            { error: 'Pipeline timed out after 5 minutes' },
            { status: 504 }
          )
        );
      }
    }, 5 * 60 * 1000);
  });
}
