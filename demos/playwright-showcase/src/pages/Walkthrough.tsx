import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, RotateCcw, FastForward, Volume2, VolumeX, Settings, X } from 'lucide-react';
import DemoCursor from '../components/DemoCursor';
import TrustScore from '../components/TrustScore';
import CodeBlock from '../components/CodeBlock';
import { useDemoContext } from '../context/DemoContext';
import { 
  speak, 
  stopSpeaking, 
  getApiKey,
  saveApiKey,
  preloadNarrations,
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
      { type: 'narrate', text: 'What if AI-generated code was actually secure?' },
      { type: 'wait', ms: 2500 },
    ],
  },
  {
    id: 'show-intent',
    actions: [
      { type: 'narrate', text: "Let's build authentication. First, describe what you want..." },
      { type: 'wait', ms: 1500 },
      { type: 'highlight', selector: '[data-demo="input"]' },
      { type: 'click', selector: '[data-demo="input"]' },
      { type: 'type', selector: '[data-demo="input"]', text: 'Build user authentication with email/password login and rate limiting' },
      { type: 'wait', ms: 1000 },
    ],
  },
  {
    id: 'generate-isl',
    actions: [
      { type: 'narrate', text: 'ISL Studio generates a formal specification...' },
      { type: 'click', selector: '[data-demo="generate-btn"]' },
      { type: 'wait', ms: 1000 },
      { type: 'spotlight', on: true },
      { type: 'showCode', title: 'Generated ISL Specification', language: 'typescript', code: `domain Authentication
use stdlib-auth

state {
  users: Map<string, User>
  sessions: Map<string, Session>
}

behavior register(email: string, password: string) -> Result<User, AuthError> {
  precondition: email.isValidEmail() && password.length >= 8
  postcondition: users'.has(email) && result.isOk()
  errors: [InvalidEmail, WeakPassword, EmailTaken]
}

behavior login(email: string, password: string) -> Result<Session, AuthError> {
  precondition: users.has(email)
  postcondition: sessions'.has(result.value.id)
  errors: [InvalidCredentials, AccountLocked]
  
  rateLimit: 5 per minute per email
}

invariant forall s in sessions: s.expiresAt > now()` },
      { type: 'wait', ms: 3000 },
      { type: 'spotlight', on: false },
    ],
  },
  {
    id: 'generate-code',
    actions: [
      { type: 'narrate', text: 'Now AI generates TypeScript that satisfies the contract...' },
      { type: 'wait', ms: 1200 },
      { type: 'spotlight', on: true },
      { type: 'showCode', title: 'Generated TypeScript', language: 'typescript', code: `export class AuthService {
  private users = new Map<string, User>();
  private sessions = new Map<string, Session>();
  private rateLimiter = new RateLimiter({ max: 5, windowMs: 60000 });

  async register(email: string, password: string): Promise<Result<User, AuthError>> {
    // Precondition checks (auto-generated from ISL)
    if (!isValidEmail(email)) {
      return err({ type: 'InvalidEmail', message: 'Email format is invalid' });
    }
    if (password.length < 8) {
      return err({ type: 'WeakPassword', message: 'Password must be 8+ chars' });
    }
    if (this.users.has(email)) {
      return err({ type: 'EmailTaken', message: 'Email already registered' });
    }

    const user: User = {
      id: generateId(),
      email,
      passwordHash: await hashPassword(password),
      createdAt: new Date(),
    };
    
    this.users.set(email, user);
    return ok(user);
  }

  async login(email: string, password: string): Promise<Result<Session, AuthError>> {
    // Rate limiting (auto-generated from ISL)
    if (!this.rateLimiter.check(email)) {
      return err({ type: 'RateLimited', message: 'Too many attempts' });
    }
    // ... implementation continues
  }
}` },
      { type: 'wait', ms: 3500 },
      { type: 'spotlight', on: false },
    ],
  },
  {
    id: 'verify',
    actions: [
      { type: 'narrate', text: 'Every behavior is verified. Trust score shows your confidence level.' },
      { type: 'wait', ms: 1000 },
      { type: 'spotlight', on: true },
      { type: 'showTrustScore', score: 96 },
      { type: 'zoom', target: 'score' },
      { type: 'wait', ms: 3000 },
      { type: 'spotlight', on: false },
      { type: 'zoom', target: 'none' },
    ],
  },
  {
    id: 'comparison-intro',
    actions: [
      { type: 'clear' },
      { type: 'narrate', text: "Now let's compare: what does regular AI produce with the same request?" },
      { type: 'wait', ms: 1500 },
      { type: 'highlight', selector: '[data-demo="input"]' },
      { type: 'click', selector: '[data-demo="input"]' },
      { type: 'type', selector: '[data-demo="input"]', text: 'Build user authentication with email/password login and rate limiting' },
      { type: 'wait', ms: 1000 },
    ],
  },
  {
    id: 'show-regular-ai',
    actions: [
      { type: 'narrate', text: 'Regular AI misses critical security issues...' },
      { type: 'spotlight', on: true },
      { type: 'showCode', title: '❌ Regular AI Output', language: 'typescript', code: `// Generated by regular AI - SECURITY ISSUES!
export class AuthService {
  private users = {};  // ❌ No type safety

  register(email, password) {
    // ❌ No email validation
    // ❌ No password strength check
    this.users[email] = { password };  // ❌ PLAIN TEXT PASSWORD!
    return { success: true };
  }

  login(email, password) {
    // ❌ No rate limiting - brute force vulnerable
    // ❌ Timing attack vulnerable
    if (this.users[email]?.password === password) {
      return { token: email };  // ❌ Predictable token!
    }
    return { error: 'Invalid' };
  }
}` },
      { type: 'wait', ms: 3500 },
      { type: 'spotlight', on: false },
    ],
  },
  {
    id: 'show-issues',
    actions: [
      { type: 'narrate', text: '7 security vulnerabilities in 15 lines of code!' },
      { type: 'wait', ms: 1500 },
      { type: 'spotlight', on: true },
      { type: 'showTrustScore', score: 23 },
      { type: 'zoom', target: 'score' },
      { type: 'wait', ms: 2500 },
      { type: 'spotlight', on: false },
      { type: 'zoom', target: 'none' },
    ],
  },
  {
    id: 'conclusion',
    actions: [
      { type: 'clear' },
      { type: 'spotlight', on: true },
      { type: 'showTrustScore', score: 96 },
      { type: 'zoom', target: 'score' },
      { type: 'narrate', text: 'With AI Code Verified, you ship secure code every time.' },
      { type: 'wait', ms: 3000 },
      { type: 'spotlight', on: false },
      { type: 'zoom', target: 'none' },
      { type: 'showEnding' },
      { type: 'wait', ms: 5000 },
    ],
  },
];

// Extract all narration texts from demo steps for preloading
const ALL_NARRATIONS = DEMO_STEPS.flatMap(step => 
  step.actions
    .filter((action): action is { type: 'narrate'; text: string } => action.type === 'narrate')
    .map(action => action.text)
);

export default function Walkthrough() {
  const { setIsDemoPlaying } = useDemoContext();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [actionIndex, setActionIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(VOICE_IDS.matthew);

  // Check for existing API key on mount, or set default
  useEffect(() => {
    let key = getApiKey();
    // Set default API key if none exists
    if (!key) {
      const defaultKey = 'sk_38c8b71e372a4229ea20e88eddac0640befcda8d67bf6256';
      saveApiKey(defaultKey);
      key = defaultKey;
    }
    setHasApiKey(!!key);
    if (key) {
      setApiKeyInput(key.slice(0, 8) + '...');
    }
  }, []);

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

  // Demo state
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentCode, setCurrentCode] = useState<{ code: string; title?: string; language?: string } | null>(null);
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const [narration, setNarration] = useState('');
  const [cursorTarget, setCursorTarget] = useState<string | null>(null);
  const [isClicking, setIsClicking] = useState(false);
  const [highlightTarget, setHighlightTarget] = useState<string | null>(null);
  const [spotlightOn, setSpotlightOn] = useState(false);
  const [zoomTarget, setZoomTarget] = useState<'code' | 'score' | 'none'>('none');
  const [showEnding, setShowEnding] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);

  const progress = ((currentStepIndex) / DEMO_STEPS.length) * 100;

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

  const executeAction = useCallback((action: ActionType, onComplete: () => void) => {
    const delay = (ms: number) => {
      timeoutRef.current = setTimeout(onComplete, ms / speed);
    };

    switch (action.type) {
      case 'narrate':
        setNarration(action.text);
        // Speak the narration if voice is enabled
        if (voiceEnabled && hasApiKey) {
          speak(action.text, selectedVoice);
        }
        delay(100);
        break;

      case 'wait':
        delay(action.ms);
        break;

      case 'highlight':
        setHighlightTarget(action.selector);
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

      case 'clear':
        setCurrentCode(null);
        setTrustScore(null);
        setInputText('');
        setHighlightTarget(null);
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
  }, [speed, voiceEnabled, hasApiKey, selectedVoice]);

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

  const togglePlay = async () => {
    if (!isPlaying && currentStepIndex >= DEMO_STEPS.length - 1 && actionIndex >= DEMO_STEPS[currentStepIndex].actions.length) {
      // Restart if at end
      restart();
      setIsPlaying(true);
    } else {
      // If starting fresh, optionally preload narrations
      if (!isPlaying && currentStepIndex === 0 && actionIndex === 0 && hasApiKey && voiceEnabled) {
        setIsPreloading(true);
        await preloadNarrations(ALL_NARRATIONS.slice(0, 5), selectedVoice); // Preload first few
        setIsPreloading(false);
      }
      setIsPlaying(!isPlaying);
    }
  };

  const restart = () => {
    clearTimeouts();
    stopSpeaking();
    setIsPlaying(false);
    setCurrentStepIndex(0);
    setActionIndex(0);
    setInputText('');
    setCurrentCode(null);
    setTrustScore(null);
    setNarration('');
    setCursorTarget(null);
    setHighlightTarget(null);
    setSpotlightOn(false);
    setZoomTarget('none');
    setShowEnding(false);
  };

  const skipStep = () => {
    clearTimeouts();
    if (currentStepIndex < DEMO_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      setActionIndex(0);
    }
  };

  const cycleSpeed = () => {
    setSpeed(speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1);
  };

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

      {/* Highlight Overlay */}
      <AnimatePresence>
        {highlightTarget && (
          <HighlightOverlay selector={highlightTarget} />
        )}
      </AnimatePresence>

      {/* Main Demo Area */}
      <div className="flex-1 p-8 overflow-auto scroll-smooth" ref={contentRef}>
        <div className="max-w-5xl mx-auto">
          {/* Demo Title */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-bold mb-2 text-gray-800">
              <span className="bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent">AI Code.</span> Verified.
            </h1>
            <p className="text-gray-500">Contract-First AI Development</p>
          </motion.div>

          {/* Narration Bar */}
          <AnimatePresence mode="wait">
            {narration && (
              <motion.div
                key={narration}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white/90 backdrop-blur border border-gray-200 rounded-xl p-4 mb-6 text-center shadow-sm"
              >
                <p className="text-lg text-gray-700">{narration}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Area */}
          <div className="mb-6">
            <div className="glass-card p-4">
              <label className="block text-sm text-gray-600 mb-2">Describe what you want to build</label>
              <div
                data-demo="input"
                className="w-full bg-white border border-gray-200 rounded-lg p-4 min-h-[60px] text-gray-800"
              >
                {inputText || <span className="text-gray-400">Your intent goes here...</span>}
                {isTyping && (
                  <motion.span
                    className="inline-block w-0.5 h-5 bg-cyan-500 ml-0.5"
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  />
                )}
              </div>
              <button
                data-demo="generate-btn"
                className="btn-primary mt-3"
              >
                Generate
              </button>
            </div>
          </div>

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
                    <span className="text-gray-800">with confidence?</span>
                  </motion.h2>
                  
                  <motion.p
                    className="text-xl text-gray-500 mb-8 max-w-lg mx-auto"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    Stop hoping your AI code works. Start knowing it does.
                  </motion.p>

                  <motion.div
                    className="flex gap-4 justify-center"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                  >
                    <button className="btn-primary text-lg px-8 py-4">
                      Get Started Free
                    </button>
                    <button 
                      onClick={() => {
                        restart();
                        setTimeout(() => setIsPlaying(true), 100);
                      }}
                      className="btn-secondary text-lg px-8 py-4"
                    >
                      Watch Again
                    </button>
                  </motion.div>

                  <motion.div
                    className="mt-12 flex items-center justify-center gap-8 text-sm text-gray-400"
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

      {/* Control Bar */}
      <div className="bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="max-w-5xl mx-auto">
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Step {currentStepIndex + 1} / {DEMO_STEPS.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={restart}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-800"
                title="Restart"
                data-testid="restart-walkthrough"
              >
                <RotateCcw size={20} />
              </button>

              <button
                onClick={togglePlay}
                className="p-3 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 rounded-lg transition-colors text-white shadow-md"
                data-testid="play-pause"
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>

              <button
                onClick={skipStep}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-800"
                title="Skip Step"
                data-testid="next-step"
              >
                <SkipForward size={20} />
              </button>
            </div>

            <div className="flex items-center gap-4">
              {/* Speed Control */}
              <button
                onClick={cycleSpeed}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors text-gray-700"
                title="Change Speed"
              >
                <FastForward size={16} />
                <span>{speed}x</span>
              </button>

              {/* Voice Toggle */}
              <button
                onClick={() => {
                  if (voiceEnabled) {
                    stopSpeaking();
                  }
                  setVoiceEnabled(!voiceEnabled);
                }}
                className={`p-2 rounded-lg transition-colors ${
                  voiceEnabled && hasApiKey ? 'bg-cyan-100 text-cyan-600' : 'bg-gray-100 text-gray-500'
                }`}
                title={hasApiKey ? "Toggle Voice" : "Voice (No API Key)"}
              >
                {voiceEnabled && hasApiKey ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>

              {/* Settings */}
              <button
                onClick={() => setShowSettings(true)}
                className={`p-2 rounded-lg transition-colors ${
                  hasApiKey ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                }`}
                title="Voice Settings"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">Voice Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                {/* API Key Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ElevenLabs API Key
                  </label>
                  <input
                    type="password"
                    value={apiKeyInput.includes('...') ? '' : apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={hasApiKey ? '••••••••' : 'Enter your API key'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-gray-800"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Get your API key from{' '}
                    <a 
                      href="https://elevenlabs.io" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-cyan-600 hover:underline"
                    >
                      elevenlabs.io
                    </a>
                  </p>
                </div>

                {/* Voice Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Voice
                  </label>
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-gray-800 bg-white"
                  >
                    <option value={VOICE_IDS.matthew}>Matthew (Narrator)</option>
                    <option value={VOICE_IDS.rachel}>Rachel (Conversational)</option>
                    <option value={VOICE_IDS.drew}>Drew (Professional)</option>
                    <option value={VOICE_IDS.sarah}>Sarah (Soft)</option>
                    <option value={VOICE_IDS.adam}>Adam (Deep)</option>
                    <option value={VOICE_IDS.emily}>Emily (Calm)</option>
                    <option value={VOICE_IDS.josh}>Josh (Young)</option>
                    <option value={VOICE_IDS.charlotte}>Charlotte (Expressive)</option>
                    <option value={VOICE_IDS.daniel}>Daniel (British)</option>
                    <option value={VOICE_IDS.lily}>Lily (Warm British)</option>
                    <option value={VOICE_IDS.bill}>Bill (Documentary)</option>
                    <option value={VOICE_IDS.brian}>Brian (Deep American)</option>
                  </select>
                </div>

                {/* Save Button */}
                <button
                  onClick={() => {
                    if (apiKeyInput && !apiKeyInput.includes('...')) {
                      saveApiKey(apiKeyInput);
                      setHasApiKey(true);
                      setApiKeyInput(apiKeyInput.slice(0, 8) + '...');
                    }
                    setShowSettings(false);
                  }}
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-lg hover:from-cyan-600 hover:to-purple-600 transition-all"
                >
                  Save Settings
                </button>

                {hasApiKey && (
                  <p className="text-center text-sm text-green-600">
                    ✓ API key configured
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preloading Indicator */}
      <AnimatePresence>
        {isPreloading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg text-sm text-gray-600 z-[10001]"
          >
            <span className="animate-pulse">Loading voice...</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HighlightOverlay({ selector }: { selector: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const updateRect = () => {
      const el = document.querySelector(selector);
      if (el) {
        setRect(el.getBoundingClientRect());
      }
    };

    updateRect();
    const interval = setInterval(updateRect, 50);
    return () => clearInterval(interval);
  }, [selector]);

  if (!rect) return null;

  return (
    <>
      {/* Spotlight dimming effect */}
      <motion.div
        className="fixed inset-0 pointer-events-none z-[9997]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          background: `radial-gradient(ellipse 400px 300px at ${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px, transparent 0%, rgba(0,0,0,0.4) 100%)`,
        }}
      />
      {/* Highlight border */}
      <motion.div
        className="fixed pointer-events-none z-[9998]"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        style={{
          left: rect.left - 8,
          top: rect.top - 8,
          width: rect.width + 16,
          height: rect.height + 16,
        }}
      >
        <div className="absolute inset-0 border-2 border-cyan-400 rounded-xl shadow-[0_0_30px_rgba(14,165,233,0.5)]" />
        <motion.div
          className="absolute inset-0 bg-cyan-400/5 rounded-xl"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        {/* Corner accents */}
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-400 rounded-tl-lg" />
        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-cyan-400 rounded-tr-lg" />
        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-cyan-400 rounded-bl-lg" />
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-400 rounded-br-lg" />
      </motion.div>
    </>
  );
}
