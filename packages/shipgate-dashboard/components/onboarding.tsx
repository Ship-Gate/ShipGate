'use client';

import { useState, useEffect } from 'react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  action?: { label: string; href?: string; command?: string };
  checkKey: string;
}

const STEPS: OnboardingStep[] = [
  {
    id: 'install',
    title: 'Install the CLI',
    description: 'Install ShipGate globally to start scanning your projects.',
    action: { label: 'Copy command', command: 'npm install -g shipgate' },
    checkKey: 'onboarding.install',
  },
  {
    id: 'scan',
    title: 'Run your first scan',
    description: 'Navigate to your project and run a scan to generate specs and verify your code.',
    action: { label: 'Copy command', command: 'shipgate go' },
    checkKey: 'onboarding.scan',
  },
  {
    id: 'api-key',
    title: 'Create an API key',
    description: 'Generate a Personal Access Token to connect your CLI and VS Code extension.',
    action: { label: 'Create API key', href: '/dashboard/api-keys' },
    checkKey: 'onboarding.apiKey',
  },
  {
    id: 'vscode',
    title: 'Install VS Code extension',
    description: 'Get real-time verification, findings, and code lenses in your editor.',
    action: { label: 'Install extension', href: 'https://marketplace.visualstudio.com/items?itemName=shipgate.shipgate-isl' },
    checkKey: 'onboarding.vscode',
  },
  {
    id: 'team',
    title: 'Invite your team',
    description: 'Add team members so everyone can see verification results and collaborate.',
    action: { label: 'Go to Team', href: '/dashboard/team' },
    checkKey: 'onboarding.team',
  },
];

export function OnboardingBanner() {
  const [dismissed, setDismissed] = useState(true);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('shipgate.onboarding.dismissed');
    if (stored !== 'true') setDismissed(false);

    const done = new Set<string>();
    for (const step of STEPS) {
      if (localStorage.getItem(step.checkKey) === 'true') {
        done.add(step.id);
      }
    }
    setCompleted(done);
  }, []);

  function markComplete(stepId: string, checkKey: string) {
    localStorage.setItem(checkKey, 'true');
    setCompleted((prev) => new Set([...prev, stepId]));
  }

  function dismiss() {
    localStorage.setItem('shipgate.onboarding.dismissed', 'true');
    setDismissed(true);
  }

  async function copyCommand(cmd: string, stepId: string, checkKey: string) {
    await navigator.clipboard.writeText(cmd);
    setCopiedCommand(stepId);
    markComplete(stepId, checkKey);
    setTimeout(() => setCopiedCommand(null), 2000);
  }

  if (dismissed) return null;

  const completedCount = completed.size;
  const totalSteps = STEPS.length;
  const progress = Math.round((completedCount / totalSteps) * 100);

  if (completedCount >= totalSteps) {
    dismiss();
    return null;
  }

  return (
    <div className="rounded-xl border border-sg-accent/20 bg-sg-accent-bg p-5 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-sg-text0">Welcome to ShipGate</h3>
          <p className="text-xs text-sg-text2 mt-0.5">
            Complete these steps to get the most out of ShipGate
          </p>
        </div>
        <button
          onClick={dismiss}
          className="text-xs text-sg-text3 hover:text-sg-text1 transition-colors"
        >
          Dismiss
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-sg-bg3 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-sg-accent rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-[10px] text-sg-text3 mb-3">
        {completedCount} of {totalSteps} complete
      </p>

      {/* Steps */}
      <div className="space-y-2">
        {STEPS.map((step) => {
          const isDone = completed.has(step.id);
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                isDone
                  ? 'bg-sg-ship-bg border-sg-ship/10 opacity-60'
                  : 'bg-sg-bg1 border-sg-border'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  isDone ? 'border-sg-ship bg-sg-ship' : 'border-sg-text3'
                }`}
              >
                {isDone && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5L4 7L8 3" stroke="#0a0a0f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${isDone ? 'text-sg-text2 line-through' : 'text-sg-text0'}`}>
                  {step.title}
                </p>
                <p className="text-[10px] text-sg-text3 truncate">{step.description}</p>
              </div>
              {step.action && !isDone && (
                <>
                  {step.action.command ? (
                    <button
                      onClick={() => copyCommand(step.action!.command!, step.id, step.checkKey)}
                      className="text-[10px] px-2 py-1 rounded bg-sg-bg2 border border-sg-border text-sg-accent hover:bg-sg-bg3 transition-colors whitespace-nowrap"
                    >
                      {copiedCommand === step.id ? 'Copied!' : step.action.label}
                    </button>
                  ) : step.action.href?.startsWith('http') ? (
                    <a
                      href={step.action.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => markComplete(step.id, step.checkKey)}
                      className="text-[10px] px-2 py-1 rounded bg-sg-bg2 border border-sg-border text-sg-accent hover:bg-sg-bg3 transition-colors whitespace-nowrap"
                    >
                      {step.action.label}
                    </a>
                  ) : (
                    <a
                      href={step.action.href}
                      onClick={() => markComplete(step.id, step.checkKey)}
                      className="text-[10px] px-2 py-1 rounded bg-sg-bg2 border border-sg-border text-sg-accent hover:bg-sg-bg3 transition-colors whitespace-nowrap"
                    >
                      {step.action.label}
                    </a>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
