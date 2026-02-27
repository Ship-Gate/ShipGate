'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const FRAMEWORKS = [
  { id: 'nextjs', label: 'Next.js' },
  { id: 'express', label: 'Express' },
  { id: 'fastify', label: 'Fastify' },
];

const DATABASES = [
  { id: 'postgres', label: 'PostgreSQL' },
  { id: 'sqlite', label: 'SQLite' },
  { id: 'none', label: 'None' },
];

const LANGS = [
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'rust', label: 'Rust' },
  { id: 'go', label: 'Go' },
];

const TEMPLATES = [
  'Todo app with user auth and persistence',
  'REST API for blog posts with CRUD',
  'Stripe checkout flow with webhooks',
  'Real-time chat with WebSockets',
];

type VibeResult = {
  success?: boolean;
  verdict?: string;
  finalScore?: number;
  files?: { path: string; type: string; size: number }[];
  stages?: { stage: string; success: boolean; duration: number }[];
  errors?: string[];
  duration?: number;
};

export default function VibePage() {
  const [prompt, setPrompt] = useState('');
  const [framework, setFramework] = useState('nextjs');
  const [database, setDatabase] = useState('sqlite');
  const [lang, setLang] = useState('typescript');
  const [frontend, setFrontend] = useState(true);
  const [tests, setTests] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<VibeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleRun() {
    if (!prompt.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/v1/vibe/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          framework,
          database,
          lang,
          frontend,
          tests,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Pipeline failed');
        return;
      }
      setResult(data.data as VibeResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => router.back()}
        className="text-xs text-sg-text3 hover:text-sg-text1 mb-4 transition-colors"
      >
        &larr; Back to Dashboard
      </button>

      <h1 className="text-xl font-bold text-sg-text0 mb-2">Vibe Pipeline</h1>
      <p className="text-sm text-sg-text3 mb-6">
        Describe what you want in natural language → ISL spec → validated → codegen → verified
      </p>

      <div className="bg-sg-bg1 border border-sg-border rounded-xl p-6 mb-6">
        <label className="block text-xs font-medium text-sg-text2 mb-2">What do you want to build?</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Todo app with user auth and persistence"
          rows={4}
          className="w-full px-3 py-2 rounded-lg bg-sg-bg2 border border-sg-border text-sg-text0 text-sm focus:outline-none focus:border-sg-ship/50 resize-none"
          disabled={running}
        />

        <div className="mt-4 flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setPrompt(t)}
              disabled={running}
              className="px-3 py-1.5 rounded-lg text-xs bg-sg-bg2 border border-sg-border text-sg-text2 hover:bg-sg-bg3/50 transition-colors disabled:opacity-50"
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-sg-text3 mb-1">Framework</label>
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
              disabled={running}
              className="w-full px-3 py-2 rounded-lg bg-sg-bg2 border border-sg-border text-sg-text0 text-sm focus:outline-none focus:border-sg-ship/50"
            >
              {FRAMEWORKS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-sg-text3 mb-1">Database</label>
            <select
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              disabled={running}
              className="w-full px-3 py-2 rounded-lg bg-sg-bg2 border border-sg-border text-sg-text0 text-sm focus:outline-none focus:border-sg-ship/50"
            >
              {DATABASES.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-sg-text3 mb-1">Language</label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              disabled={running}
              className="w-full px-3 py-2 rounded-lg bg-sg-bg2 border border-sg-border text-sg-text0 text-sm focus:outline-none focus:border-sg-ship/50"
            >
              {LANGS.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex gap-6">
          <label className="flex items-center gap-2 text-sm text-sg-text2 cursor-pointer">
            <input
              type="checkbox"
              checked={frontend}
              onChange={(e) => setFrontend(e.target.checked)}
              disabled={running}
              className="rounded border-sg-border"
            />
            Include frontend
          </label>
          <label className="flex items-center gap-2 text-sm text-sg-text2 cursor-pointer">
            <input
              type="checkbox"
              checked={tests}
              onChange={(e) => setTests(e.target.checked)}
              disabled={running}
              className="rounded border-sg-border"
            />
            Include tests
          </label>
        </div>

        <button
          onClick={handleRun}
          disabled={running || !prompt.trim()}
          className="mt-6 w-full py-3 rounded-lg bg-sg-ship text-sg-bg0 font-semibold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {running ? (
            <>
              <span className="animate-spin">⏳</span>
              Running pipeline... (1–3 min)
            </>
          ) : (
            <>✨ Generate</>
          )}
        </button>

        <p className="mt-3 text-xs text-sg-text3">
          Requires ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.local for AI generation.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-sg-noship/10 border border-sg-noship/30 text-sg-noship text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-sg-bg1 border border-sg-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-sg-text0">Result</h2>
          <div className="flex items-center gap-3">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                result.verdict === 'SHIP'
                  ? 'bg-sg-ship/10 border border-sg-ship/20 text-sg-ship'
                  : result.verdict === 'WARN'
                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500'
                    : 'bg-sg-noship/10 border border-sg-noship/20 text-sg-noship'
              }`}
            >
              {result.verdict ?? 'N/A'}
            </span>
            {result.finalScore != null && (
              <span className="text-sm text-sg-text2">Score: {result.finalScore.toFixed(1)}%</span>
            )}
            {result.duration != null && (
              <span className="text-sm text-sg-text3">Duration: {(result.duration / 1000).toFixed(1)}s</span>
            )}
          </div>

          {result.stages && result.stages.length > 0 && (
            <div>
              <div className="text-xs font-medium text-sg-text3 mb-2">Stages</div>
              <div className="space-y-2">
                {result.stages.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className={s.success ? 'text-sg-ship' : 'text-sg-noship'}>
                      {s.success ? '✓' : '✗'}
                    </span>
                    <span className="text-sg-text1">{s.stage}</span>
                    {s.duration != null && (
                      <span className="text-sg-text3">{(s.duration / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.files && result.files.length > 0 && (
            <div>
              <div className="text-xs font-medium text-sg-text3 mb-2">
                Generated files ({result.files.length})
              </div>
              <div className="max-h-40 overflow-y-auto rounded-lg bg-sg-bg2 p-2 font-mono text-xs text-sg-text2 space-y-1">
                {result.files.slice(0, 20).map((f, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span>{f.path}</span>
                    <span className="text-sg-text3 shrink-0">{f.type}</span>
                  </div>
                ))}
                {result.files.length > 20 && (
                  <div className="text-sg-text3 pt-1">+{result.files.length - 20} more</div>
                )}
              </div>
            </div>
          )}

          {result.errors && result.errors.length > 0 && (
            <div className="text-xs text-sg-noship">
              {result.errors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          )}

          <p className="text-xs text-sg-text3 pt-2">
            To save files to your project, run{' '}
            <code className="bg-sg-bg2 px-1 rounded">shipgate vibe &quot;...&quot;</code> from the
            CLI in your workspace.
          </p>
        </div>
      )}
    </div>
  );
}
