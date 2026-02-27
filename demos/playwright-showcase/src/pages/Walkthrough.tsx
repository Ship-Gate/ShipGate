import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DemoCursor from '../components/DemoCursor';
import TrustScore from '../components/TrustScore';
import CodeBlock from '../components/CodeBlock';
import PipelineView, { type PipelineStep } from '../components/PipelineView';
import { useDemoContext } from '../context/DemoContext';
import { 
  speak, 
  stopSpeaking, 
  getApiKey,
  getEnvVoiceId,
  VOICE_IDS,
} from '../utils/audio';

type ActionType = 
  | { type: 'navigate'; target: string }
  | { type: 'click'; selector: string }
  | { type: 'type'; selector: string; text: string }
  | { type: 'wait'; ms: number }
  | { type: 'highlight'; selector: string }
  | { type: 'showCode'; code: string; language?: string; title?: string }
  | { type: 'showTrustScore'; score: number }
  | { type: 'showPipeline'; steps: PipelineStep[] }
  | { type: 'showGateResult'; verdict: 'SHIP' | 'NO_SHIP'; score?: number; violations?: Array<{ ruleId: string; message: string }> }
  | { type: 'narrate'; text: string }
  | { type: 'clear' }
  | { type: 'spotlight'; on: boolean }
  | { type: 'zoom'; target: 'code' | 'score' | 'none' }
  | { type: 'showEnding' };

interface DemoStep {
  id: string;
  actions: ActionType[];
}

const DEMO_STEPS: DemoStep[] = [
  {
    id: 'intro',
    actions: [
      { type: 'narrate', text: 'AI generates code. But who stops dangerous code from reaching production?' },
      { type: 'wait', ms: 2500 },
    ],
  },
  {
    id: 'show-pipeline',
    actions: [
      {
        type: 'showPipeline',
        steps: [
          { id: 'build', label: 'Build', status: 'pass', detail: '2.1s' },
          { id: 'test', label: 'Test', status: 'pass', detail: '4.3s' },
          { id: 'gate', label: 'Shipgate Gate', status: 'running', detail: '...' },
          { id: 'deploy', label: 'Deploy', status: 'pending' },
        ],
      },
      { type: 'narrate', text: 'A PR lands. Build passes. Test passes. Then the Shipgate gate runs...' },
      { type: 'wait', ms: 3000 },
    ],
  },
  {
    id: 'show-dangerous-code',
    actions: [
      {
        type: 'showPipeline',
        steps: [
          { id: 'build', label: 'Build', status: 'pass', detail: '2.1s' },
          { id: 'test', label: 'Test', status: 'pass', detail: '4.3s' },
          { id: 'gate', label: 'Shipgate Gate', status: 'fail', detail: 'NO_SHIP' },
          { id: 'deploy', label: 'Deploy', status: 'pending' },
        ],
      },
      {
        type: 'showGateResult',
        verdict: 'NO_SHIP',
        score: 23,
        violations: [
          { ruleId: 'missing-precondition', message: 'transfer: balance check missing before debit' },
          { ruleId: 'intent-violation', message: 'amount must be validated > 0' },
          { ruleId: 'ghost-behavior', message: 'no ISL spec for transfer; code not covered' },
        ],
      },
      { type: 'wait', ms: 1500 },
      { type: 'spotlight', on: true },
      {
        type: 'showCode',
        title: '❌ AI-generated code in PR (blocked)',
        language: 'typescript',
        code: `// AI: "Add a function to transfer money"
function transfer(sender: Account, receiver: Account, amount: number) {
  sender.balance -= amount;   // ⚠️ No balance check
  receiver.balance += amount; // ⚠️ No validation: amount > 0
  return { success: true };
}`,
      },
      { type: 'narrate', text: 'Shipgate caught it. Missing preconditions. No balance check. The gate blocks the merge.' },
      { type: 'wait', ms: 4000 },
      { type: 'spotlight', on: false },
    ],
  },
  {
    id: 'fixed-and-passes',
    actions: [
      { type: 'clear' },
      { type: 'narrate', text: 'After the fix: proper preconditions, balance check, ISL spec...' },
      { type: 'wait', ms: 2000 },
      {
        type: 'showPipeline',
        steps: [
          { id: 'build', label: 'Build', status: 'pass', detail: '2.0s' },
          { id: 'test', label: 'Test', status: 'pass', detail: '4.1s' },
          { id: 'gate', label: 'Shipgate Gate', status: 'pass', detail: 'SHIP' },
          { id: 'deploy', label: 'Deploy', status: 'pass', detail: '1.2s' },
        ],
      },
      {
        type: 'showGateResult',
        verdict: 'SHIP',
        score: 96,
      },
      {
        type: 'showCode',
        title: '✓ Verified code (merged)',
        language: 'typescript',
        code: `behavior transfer(from: Account, to: Account, amount: number) {
  precondition: from.balance >= amount && amount > 0
  postcondition: from.balance' === from.balance - amount
}

function transfer(sender: Account, receiver: Account, amount: number) {
  if (sender.balance < amount || amount <= 0) return err('Invalid');
  sender.balance -= amount;
  receiver.balance += amount;
  return { success: true };
}`,
      },
      { type: 'wait', ms: 3500 },
    ],
  },
  {
    id: 'conclusion',
    actions: [
      { type: 'clear' },
      { type: 'spotlight', on: true },
      { type: 'showTrustScore', score: 96 },
      { type: 'zoom', target: 'score' },
      { type: 'narrate', text: 'Shipgate stops AI from shipping fake features. SHIP or NO_SHIP—every time.' },
      { type: 'wait', ms: 3500 },
      { type: 'spotlight', on: false },
      { type: 'zoom', target: 'none' },
      { type: 'showEnding' },
      { type: 'wait', ms: 5000 },
    ],
  },
];

interface WalkthroughProps {
  autoPlay?: boolean;
  embedded?: boolean;
}

export default function Walkthrough({ autoPlay = false, embedded = false }: WalkthroughProps) {
  const { setIsDemoPlaying } = useDemoContext();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [actionIndex, setActionIndex] = useState(0);
  const [speed, _setSpeed] = useState(1);
  const [voiceEnabled] = useState(true);
  // Use env voice if set, otherwise Matthew
  const envVoice = getEnvVoiceId();
  const [selectedVoice] = useState(envVoice ?? VOICE_IDS.matthew);

  // Stop speaking when paused
  useEffect(() => {
    if (!isPlaying) {
      stopSpeaking();
    }
  }, [isPlaying]);

  // Sync playing state with context
  useEffect(() => {
    setIsDemoPlaying(isPlaying);
  }, [isPlaying, setIsDemoPlaying]);

  // Auto-play when mounted with autoPlay prop
  useEffect(() => {
    if (autoPlay) {
      setIsPlaying(true);
    }
  }, [autoPlay]);

  // Demo state
  const [, setInputText] = useState('');
  const [, setIsTyping] = useState(false);
  const [currentCode, setCurrentCode] = useState<{ code: string; title?: string; language?: string } | null>(null);
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const [narration, setNarration] = useState('');
  const [cursorTarget, setCursorTarget] = useState<string | null>(null);
  const [isClicking, setIsClicking] = useState(false);
  const [spotlightOn, setSpotlightOn] = useState(false);
  const [zoomTarget, setZoomTarget] = useState<'code' | 'score' | 'none'>('none');
  const [showEnding, setShowEnding] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[] | null>(null);
  const [gateResult, setGateResult] = useState<{
    verdict: 'SHIP' | 'NO_SHIP';
    score?: number;
    violations?: Array<{ ruleId: string; message: string }>;
  } | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pipelineRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);

  const clearTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Auto-scroll to show new content
  const scrollToElement = useCallback((ref: React.RefObject<HTMLDivElement>) => {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, []);

  // Scroll when code or score changes
  useEffect(() => {
    if (currentCode && codeRef.current) {
      scrollToElement(codeRef);
    }
  }, [currentCode, scrollToElement]);

  useEffect(() => {
    if (trustScore !== null && scoreRef.current) {
      scrollToElement(scoreRef);
    }
  }, [trustScore, scrollToElement]);

  useEffect(() => {
    if (pipelineSteps && pipelineRef.current) {
      scrollToElement(pipelineRef);
    }
  }, [pipelineSteps, scrollToElement]);

  const executeAction = useCallback((action: ActionType, onComplete: () => void) => {
    const delay = (ms: number) => {
      timeoutRef.current = setTimeout(onComplete, ms / speed);
    };

    switch (action.type) {
      case 'narrate':
        setNarration(action.text);
        // Speak the narration if voice is enabled and API key is available
        if (voiceEnabled && getApiKey()) {
          speak(action.text, selectedVoice);
        }
        delay(100);
        break;

      case 'wait':
        delay(action.ms);
        break;

      case 'highlight':
        setCursorTarget(action.selector);
        delay(400);
        break;

      case 'click':
        setCursorTarget(action.selector);
        timeoutRef.current = setTimeout(() => {
          setIsClicking(true);
          setTimeout(() => {
            setIsClicking(false);
            onComplete();
          }, 300 / speed);
        }, 500 / speed);
        break;

      case 'type':
        setIsTyping(true);
        setInputText('');
        let charIndex = 0;
        const typeInterval = setInterval(() => {
          if (charIndex < action.text.length) {
            setInputText(action.text.slice(0, charIndex + 1));
            charIndex++;
          } else {
            clearInterval(typeInterval);
            setIsTyping(false);
            onComplete();
          }
        }, 45 / speed); // Slower typing for better readability
        break;

      case 'showCode':
        setCurrentCode({ code: action.code, title: action.title, language: action.language });
        delay(100);
        break;

      case 'showTrustScore':
        setTrustScore(action.score);
        delay(100);
        break;

      case 'showPipeline':
        setPipelineSteps(action.steps);
        delay(100);
        break;

      case 'showGateResult':
        setGateResult({
          verdict: action.verdict,
          score: action.score,
          violations: action.violations,
        });
        delay(100);
        break;

      case 'clear':
        setCurrentCode(null);
        setTrustScore(null);
        setPipelineSteps(null);
        setGateResult(null);
        setInputText('');
        setShowEnding(false);
        delay(300);
        break;

      case 'spotlight':
        setSpotlightOn(action.on);
        delay(300);
        break;

      case 'zoom':
        setZoomTarget(action.target);
        delay(100);
        break;

      case 'showEnding':
        setShowEnding(true);
        setTrustScore(null);
        delay(100);
        break;

      default:
        delay(100);
    }
  }, [speed, voiceEnabled, selectedVoice]);

  const runStep = useCallback(() => {
    if (!isPlaying) return;

    const step = DEMO_STEPS[currentStepIndex];
    if (!step) {
      setIsPlaying(false);
      return;
    }

    if (actionIndex >= step.actions.length) {
      // Move to next step
      if (currentStepIndex < DEMO_STEPS.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
        setActionIndex(0);
      } else {
        setIsPlaying(false);
      }
      return;
    }

    const action = step.actions[actionIndex];
    executeAction(action, () => {
      setActionIndex(actionIndex + 1);
    });
  }, [isPlaying, currentStepIndex, actionIndex, executeAction]);

  useEffect(() => {
    if (isPlaying) {
      runStep();
    }
    return clearTimeouts;
  }, [isPlaying, currentStepIndex, actionIndex, runStep, clearTimeouts]);

  return (
    <div className="min-h-[calc(100vh-6rem)] flex flex-col">
      {/* Demo Cursor */}
      <DemoCursor
        targetSelector={cursorTarget || undefined}
        isClicking={isClicking}
        isVisible={isPlaying && !!cursorTarget}
      />

      {/* Spotlight Overlay */}
      <AnimatePresence>
        {spotlightOn && (
          <motion.div
            className="fixed inset-0 bg-black/60 z-[9990] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      {/* Main Demo Area */}
      <div className="flex-1 p-8 overflow-auto scroll-smooth" ref={contentRef}>
        <div className="max-w-5xl mx-auto">
          {/* Demo Title - hidden when embedded in hero */}
          {!embedded && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <h1 className="text-4xl font-bold mb-2 text-white">
                <span className="bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent">AI Code.</span> Verified.
              </h1>
              <p className="text-white/80">Contract-First AI Development</p>
            </motion.div>
          )}

          {/* Narration Bar */}
          <AnimatePresence mode="wait">
            {narration && (
              <motion.div
                key={narration}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white/10 backdrop-blur border border-white/20 rounded-xl p-4 mb-6 text-center shadow-sm"
              >
                <p className="text-lg text-white">{narration}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pipeline / CI View */}
          <AnimatePresence mode="wait">
            {pipelineSteps && (
              <motion.div
                ref={pipelineRef}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-6"
              >
                <PipelineView
                  steps={pipelineSteps}
                  showGateDetail={!!gateResult}
                  gateVerdict={gateResult?.verdict}
                  gateScore={gateResult?.score}
                  violations={gateResult?.violations}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Code Display */}
          <AnimatePresence mode="wait">
            {currentCode && (
              <motion.div
                ref={codeRef}
                key={currentCode.title}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ 
                  opacity: 1, 
                  scale: zoomTarget === 'code' ? 1.02 : 1, 
                  y: 0 
                }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ duration: 0.4 }}
                className={`mb-6 ${spotlightOn ? 'relative z-[9995]' : ''}`}
              >
                <motion.div
                  animate={{
                    boxShadow: spotlightOn 
                      ? '0 0 40px rgba(14, 165, 233, 0.3), 0 0 80px rgba(139, 92, 246, 0.15)'
                      : '0 4px 24px rgba(0,0,0,0.1)'
                  }}
                  transition={{ duration: 0.5 }}
                  className="rounded-xl overflow-hidden"
                >
                  <CodeBlock
                    code={currentCode.code}
                    language={currentCode.language || 'typescript'}
                    title={currentCode.title}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Trust Score */}
          <AnimatePresence>
            {trustScore !== null && (
              <motion.div
                ref={scoreRef}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ 
                  opacity: 1, 
                  scale: zoomTarget === 'score' ? 1.15 : 1,
                }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`flex justify-center py-8 ${spotlightOn ? 'relative z-[9995]' : ''}`}
              >
                <motion.div 
                  className="glass-card p-8"
                  animate={{
                    boxShadow: zoomTarget === 'score' 
                      ? '0 0 60px rgba(14, 165, 233, 0.4), 0 0 120px rgba(139, 92, 246, 0.2)'
                      : '0 4px 24px rgba(0,0,0,0.1)'
                  }}
                  transition={{ duration: 0.5 }}
                >
                  <TrustScore score={trustScore} size="lg" />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ending Screen */}
          <AnimatePresence>
            {showEnding && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="flex flex-col items-center justify-center py-16"
              >
                <motion.div
                  initial={{ y: 20 }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="text-center"
                >
                  <motion.h2 
                    className="text-5xl md:text-6xl font-bold mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <span className="bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                      Ready to ship
                    </span>
                    <br />
                    <span className="text-white">with confidence?</span>
                  </motion.h2>
                  
                  <motion.p
                    className="text-xl text-white/80 mb-8 max-w-lg mx-auto"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    Stop hoping your AI code works. Start knowing it does.
                  </motion.p>

                  <motion.div
                    className="mt-12 flex items-center justify-center gap-8 text-sm text-white/70"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.9 }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      96% Trust Score
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
                      0 Security Issues
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                      100% Verified
                    </span>
                  </motion.div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>

    </div>
  );
}

