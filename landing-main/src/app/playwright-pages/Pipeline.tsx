import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RotateCcw } from 'lucide-react';
import StepIndicator, { Step } from '../components/StepIndicator';
import CodeBlock from '../components/CodeBlock';
import TrustScore from '../components/TrustScore';

const STEPS: Step[] = [
  { id: 'input', label: 'Input Intent' },
  { id: 'parse', label: 'Parse to ISL' },
  { id: 'generate', label: 'Generate Code' },
  { id: 'verify', label: 'Verify & Score' },
];

const EXAMPLE_PROMPTS = [
  'Create a counter that increments and decrements, but never goes negative',
  'Build user authentication with email/password login',
  'Implement a payment processor with card validation',
];

interface Verification {
  name: string;
  status: string;
  count: number;
}

export default function Pipeline() {
  const [input, setInput] = useState('');
  const [currentStep, setCurrentStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [islSpec, setIslSpec] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [trustScore, setTrustScore] = useState(0);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runPipeline = async () => {
    if (!input.trim() || isRunning) return;
    
    setIsRunning(true);
    setCompletedSteps([]);
    setIslSpec('');
    setGeneratedCode('');
    setTrustScore(0);
    setVerifications([]);

    // Step 1: Input (immediate)
    setCurrentStep(0);
    await delay(300);
    setCompletedSteps([0]);

    // Step 2: Parse to ISL
    setCurrentStep(1);
    const parseRes = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    }).then(r => r.json());
    
    setIslSpec(parseRes.isl);
    await delay(200);
    setCompletedSteps([0, 1]);

    // Step 3: Generate Code
    setCurrentStep(2);
    const genRes = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isl: parseRes.isl }),
    }).then(r => r.json());
    
    setGeneratedCode(genRes.code);
    await delay(200);
    setCompletedSteps([0, 1, 2]);

    // Step 4: Verify
    setCurrentStep(3);
    const verifyRes = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isl: parseRes.isl, code: genRes.code }),
    }).then(r => r.json());
    
    setVerifications(verifyRes.verifications);
    setTrustScore(verifyRes.trustScore);
    setCompletedSteps([0, 1, 2, 3]);
    setCurrentStep(-1);
    setIsRunning(false);
  };

  const reset = () => {
    setInput('');
    setCurrentStep(-1);
    setCompletedSteps([]);
    setIslSpec('');
    setGeneratedCode('');
    setTrustScore(0);
    setVerifications([]);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-white" data-testid="pipeline-title">
          Pipeline Demo
        </h1>
        <p className="text-white/80">
          Watch intent transform into verified code step-by-step
        </p>
      </div>

      {/* Step Indicator */}
      <div className="mb-8 overflow-x-auto pb-2">
        <StepIndicator
          steps={STEPS}
          currentStep={currentStep}
          completedSteps={completedSteps}
        />
      </div>

      {/* Input Section */}
      <div className="glass-card p-6 mb-6">
        <label className="block text-sm font-medium text-white/90 mb-2">
          Describe what you want to build
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g., Create a counter that increments and decrements, but never goes negative"
          className="w-full bg-white/10 border border-white/20 rounded-lg p-4 text-white placeholder-white/50 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none resize-none"
          rows={3}
          data-testid="intent-input"
          disabled={isRunning}
        />
        
        {/* Example prompts */}
        <div className="flex flex-wrap gap-2 mt-3">
          {EXAMPLE_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => setInput(prompt)}
              className="text-xs px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-full text-white/90 hover:text-white transition-colors border border-white/20"
              data-testid={`example-prompt-${i}`}
              disabled={isRunning}
            >
              {prompt.slice(0, 40)}...
            </button>
          ))}
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={runPipeline}
            disabled={!input.trim() || isRunning}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="run-pipeline"
          >
            <Play size={18} />
            {isRunning ? 'Running...' : 'Run Pipeline'}
          </button>
          <button
            onClick={reset}
            className="btn-secondary flex items-center gap-2"
            data-testid="reset-pipeline"
          >
            <RotateCcw size={18} />
            Reset
          </button>
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* ISL Spec */}
        <AnimatePresence mode="wait">
          {islSpec && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              data-testid="isl-output"
            >
              <CodeBlock
                code={islSpec}
                language="typescript"
                title="Generated ISL Specification"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generated Code */}
        <AnimatePresence mode="wait">
          {generatedCode && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              data-testid="code-output"
            >
              <CodeBlock
                code={generatedCode}
                language="typescript"
                title="Generated TypeScript"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Trust Score & Verifications */}
      <AnimatePresence>
        {trustScore > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 glass-card p-6"
            data-testid="verification-results"
          >
            <div className="flex items-start gap-8">
              <TrustScore score={trustScore} size="lg" />
              
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-4 text-white">Verification Results</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {verifications.map((v) => (
                    <div
                      key={v.name}
                      className="flex items-center justify-between bg-white/10 rounded-lg px-4 py-3 border border-white/20"
                      data-testid={`verification-${v.name.toLowerCase().replace(/\s/g, '-')}`}
                    >
                      <span className="text-sm text-white/90">{v.name}</span>
                      <span className="text-sm font-medium text-green-600">
                        {v.count} verified
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
