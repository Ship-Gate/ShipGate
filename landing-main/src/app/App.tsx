import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2, ChevronDown, Terminal as TerminalIcon,
  Shield, GitBranch, Ghost, Skull, KeyRound,
} from "lucide-react";

/* ── Theme + hooks ── */
import { T } from "./theme";
import { useBreakpoint } from "./hooks/useBreakpoint";

/* ── Shared components ── */
import { TerminalDemo, type TermLine } from "./components/TerminalDemo";
import { ProofBundle } from "./components/ProofBundle";

/* ── Tunnel scroll system ── */
import { ScrollTunnel, TunnelSection } from "./components/tunnel/ScrollTunnel";

/* ── Effect components ── */
import DangerousMission from "./components/hero/DangerousMission";
import RiveButton from "./components/ui/RiveButton";
import FrostedNav from "./components/FrostedNav";
import SignInModal from "./components/SignInModal";
import { createCheckoutSession, STRIPE_PRICE_IDS } from "./components/StripeProvider";

/* ── Existing components ── */
import LogoCarousel from "./components/LogoCarousel";
import ProblemBox from "./components/ProblemBox";
import "./components/ContentCard.css";
import shipgateLogo from "../shipgate-logo.png";
import demoVideo from "../demo-video.webm";


/* ═══════════════════════════════════════════════════════════
   Data
   ═══════════════════════════════════════════════════════════ */
const HOW_IT_WORKS = [
  { step: 1, icon: TerminalIcon, title: "npx shipgate init", body: "Auto-detects your stack and generates verification rules from existing code. No config files to write.", code: "$ npx shipgate init\n  ✓ Detected: Next.js + TypeScript\n  ✓ Generated 12 behavioral specs" },
  { step: 2, icon: Shield, title: "npx shipgate verify", body: "Catches fake features, hallucinated APIs, and security blind spots. Every violation gets evidence.", code: "$ npx shipgate verify\n  ✗ FAKE FEATURE  payments.ts:42\n  ✗ HALLUCINATED API  auth.ts:18\n  Verdict: NO_SHIP ✗" },
  { step: 3, icon: GitBranch, title: "Add to CI", body: "Blocks broken code from shipping. Only verified commits reach production. One YAML line.", code: "# .github/workflows/ci.yml\n- run: npx shipgate verify\n  # NO_SHIP → PR blocked" },
];

const AI_BUGS = [
  { icon: Ghost, title: "Fake Features", description: "Code compiles, passes linting, does absolutely nothing. Exported functions with empty bodies that look real.", color: "text-red-400", borderColor: "border-red-500/30" },
  { icon: Skull, title: "Hallucinated APIs", description: "Calls functions that don't exist. AI invents plausible-sounding methods that aren't in any SDK.", color: "text-amber-400", borderColor: "border-amber-500/30" },
  { icon: KeyRound, title: "Security Blind Spots", description: "Plaintext passwords, missing auth checks, unsafe defaults. The bugs auditors find six months later.", color: "text-purple-400", borderColor: "border-purple-500/30" },
];

const PRICING_PLANS = [
  { icon: TerminalIcon, name: "Open Source", price: "0", period: "/forever", tagline: "For individual devs & OSS", features: ["CLI + all static checks", "Proof bundles (unsigned)", "GitHub Action", "VS Code extension", "Community support"], cta: "Install Now", ctaAction: "install", highlighted: false },
  { icon: Shield, name: "Pro", price: "49", period: "/repo/mo", tagline: "For teams that need compliance", features: ["Everything in Open Source", "Signed proof bundles (HMAC-SHA256)", "SOC 2, HIPAA, EU AI Act mapping", "AI provenance tracking", "Web dashboard", "Priority support"], cta: "Start Free Trial", ctaAction: "trial", highlighted: true },
  { icon: GitBranch, name: "Enterprise", price: "—", period: "Custom", tagline: "For orgs with custom needs", features: ["Everything in Pro", "Custom compliance frameworks", "SSO + RBAC", "Audit-ready export packages", "On-prem verification", "Dedicated support + SLA"], cta: "Contact Sales", ctaAction: "contact", highlighted: false },
];

/* Nav section scroll targets: scrollPx = |sectionZ| / SPEED_FACTOR (3) */
const NAV_SECTIONS: Record<string, number> = {
  "Problem": 10000 / 3,
  "How It Works": 40000 / 3,
  "Pricing": 48000 / 3,
  "FAQ": 54000 / 3,
};

const FAQ_ITEMS = [
  { q: "What languages does ShipGate support?", a: "TypeScript, JavaScript, and Python today. Go, Rust, and Java are actively in development — join the waitlist for early access." },
  { q: "Does it work with any AI coding tool?", a: "Yes. ShipGate verifies code regardless of origin — Cursor, Copilot, Claude Code, ChatGPT, Windsurf, or hand-written. It analyzes the output, not the source." },
  { q: "Signed vs. unsigned proof bundles?", a: "Both contain identical claims and evidence. Signed bundles add HMAC-SHA256 signatures for tamper detection — required for SOC 2, HIPAA, and most compliance frameworks." },
  { q: "Can I self-host ShipGate?", a: "Enterprise plans include on-premises deployment. The CLI always runs locally — your code never leaves your machine." },
  { q: "How is this different from linting?", a: "Linters check syntax. Type checkers check types. ShipGate checks behavior — does this function actually do what it claims? Does this API exist? Is this auth check real or fake?" },
  { q: "How long does a scan take?", a: "Most projects complete in under 30 seconds. Large monorepos with 100k+ lines typically finish in 2–3 minutes. Results are cached so subsequent runs are faster." },
  { q: "Does it slow down CI/CD?", a: "ShipGate runs in parallel with your existing pipeline. Average CI overhead is under 45 seconds. You can also run it as a pre-commit hook locally." },
  { q: "What happens when a scan fails?", a: "You get a detailed report showing exactly which checks failed, which files are affected, and suggested fixes. Nothing ships — the PR is blocked until issues are resolved." },
  { q: "Is my code sent to external servers?", a: "Never. ShipGate runs 100% locally. The CLI analyzes your code on your machine and generates proof bundles locally. No telemetry, no cloud processing." },
  { q: "Can I customize verification rules?", a: "Absolutely. ShipGate auto-generates rules from your codebase, but you can add, modify, or disable any rule. Custom rules are defined in a simple YAML config." },
];

function getCodeLineColor(line: string): string {
  if (line.startsWith("$") || line.startsWith("#")) return "text-white/90";
  if (line.includes("✓")) return "text-emerald-400";
  if (line.includes("✗")) return "text-red-400";
  if (line.startsWith("  #")) return "text-white/40";
  if (line.startsWith("- run:")) return "text-cyan-400";
  return "text-white/60";
}

/* ═══════════════════════════════════════════════════════════
   Compliance Badge
   ═══════════════════════════════════════════════════════════ */
function ComplianceBadge({ name, pct, isMobile }: { name: string; pct: number; isMobile?: boolean }) {
  return (
    <div className="soft-card" style={{ padding: isMobile ? "12px 16px" : "16px 24px", textAlign: "center", minWidth: isMobile ? 90 : 120, flex: isMobile ? "1 1 90px" : "1 1 120px" }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: T.ship, fontFamily: "'JetBrains Mono', monospace", position: "relative", zIndex: 1 }}>{pct}%</div>
      <div style={{ fontSize: 11, color: T.text3, marginTop: 4, position: "relative", zIndex: 1 }}>{name}</div>
      <div style={{ fontSize: 10, color: T.text3, marginTop: 2, position: "relative", zIndex: 1 }}>auto-mapped</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Mobile Nav
   ═══════════════════════════════════════════════════════════ */
function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200, background: "rgba(6,6,10,0.95)",
      backdropFilter: "blur(20px)", display: "flex", flexDirection: "column", padding: "80px 24px 24px",
    }}>
      <button onClick={onClose} style={{ position: "absolute", top: 18, right: 20, background: "none", border: "none", color: T.text1, fontSize: 28, cursor: "pointer", lineHeight: 1 }}>×</button>
      {["Problem", "How It Works", "Pricing", "FAQ"].map((item, i) => (
        <button key={i} onClick={() => { window.scrollTo({ top: NAV_SECTIONS[item] || 0, behavior: "smooth" }); onClose(); }} style={{ padding: "16px 0", fontSize: 18, fontWeight: 500, color: T.text1, background: "none", border: "none", borderBottom: `1px solid ${T.border}`, textAlign: "left", cursor: "pointer" }}>{item}</button>
      ))}
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <a href="https://github.com/Ship-Gate/ShipGate" style={{ padding: "14px 0", borderRadius: 9, fontSize: 15, fontWeight: 500, color: T.text1, textDecoration: "none", border: `1px solid ${T.border}`, textAlign: "center" }}>GitHub</a>
        <a href="/signin" style={{ padding: "14px 0", borderRadius: 9, fontSize: 15, fontWeight: 500, color: T.text1, textDecoration: "none", border: `1px solid ${T.border}`, textAlign: "center" }}>Sign In</a>
        <a href="/signup" style={{ padding: "14px 0", borderRadius: 9, fontSize: 15, fontWeight: 600, color: "#000", textDecoration: "none", background: `linear-gradient(135deg, ${T.ship}, #00cc7a)`, textAlign: "center" }}>Get Started</a>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   How It Works Section
   ═══════════════════════════════════════════════════════════ */
function HowItWorksSection() {
  return (
    <motion.section
      id="how-it-works"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5 }}
      className="relative mt-32 max-w-6xl mx-auto px-4 scroll-mt-28"
    >
      <h2 className="section-heading mx-auto mb-4 text-center">How it works</h2>
      <p className="text-white/80 text-center mb-16 max-w-2xl mx-auto">Three commands. Zero broken deploys.</p>

      <div className="grid md:grid-cols-3 gap-8">
        {HOW_IT_WORKS.map(({ step, icon: Icon, title, body, code }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.12 * i }}
            className="soft-card p-6 flex flex-col"
          >
            <div className="relative z-10 flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-sm text-white shrink-0" style={{ fontWeight: 700 }}>{step}</div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center soft-card__icon-pill">
                <Icon className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
            </div>
            <h3 className="relative z-10 text-white mb-2" style={{ fontSize: 18, fontWeight: 600 }}>{title}</h3>
            <p className="relative z-10 text-sm text-white/75 mb-4 flex-1">{body}</p>
            <div className="relative z-10 rounded-lg bg-black/50 border border-white/10 p-3 font-mono text-xs" style={{ lineHeight: 1.7 }}>
              {code.split("\n").map((line, li) => (
                <div key={li} className={getCodeLineColor(line)}>{line}</div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="hidden md:block absolute top-1/2 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-cyan-500/20 -translate-y-1/2 pointer-events-none" />
    </motion.section>
  );
}

/* ═══════════════════════════════════════════════════════════
   Pricing Section
   ═══════════════════════════════════════════════════════════ */
function PricingSection() {
  return (
    <motion.section
      id="pricing"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5 }}
      className="mt-32 max-w-5xl mx-auto scroll-mt-28 px-4"
    >
      <h2 className="section-heading mx-auto mb-4 text-center">Pricing</h2>
      <p className="text-white/80 text-center mb-16 max-w-2xl mx-auto">Free to start. Scale when you need to.</p>

      <div className="grid md:grid-cols-3 gap-6">
        {PRICING_PLANS.map(({ icon: Icon, name, price, period, tagline, features, cta, ctaAction, highlighted }, i) => (
          <motion.div
            key={name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 * i }}
            className={`soft-card p-6 text-center flex flex-col ${highlighted ? "md:scale-105 ring-1 ring-cyan-500/30" : ""}`}
          >
            <div className="relative z-10 w-10 h-10 rounded-full mx-auto mb-4 flex items-center justify-center soft-card__icon-pill">
              <Icon className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <h3 className="relative z-10 text-white" style={{ fontSize: 18, fontWeight: 600 }}>{name}</h3>
            <p className="relative z-10 text-sm mt-1 text-white/80">{tagline}</p>
            <div className="relative z-10 mt-4 flex items-baseline justify-center gap-1">
              {price === "—" ? (
                <span className="text-white" style={{ fontSize: 28, fontWeight: 700 }}>{period}</span>
              ) : (
                <>
                  <span className="text-white" style={{ fontSize: 36, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.03em" }}>${price}</span>
                  <span className="text-white/80">{period}</span>
                </>
              )}
            </div>
            <ul className="relative z-10 mt-6 space-y-2 text-left flex-1">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-white/90">
                  <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            {/* Rive-style CTA on highlighted plan, standard btn otherwise */}
            {highlighted ? (
              <RiveButton
                href={ctaAction === "contact" ? "mailto:team@shipgate.dev" : "#how-it-works"}
                variant="primary"
                className="relative z-10 mt-6 w-full justify-center"
              >
                {cta}
              </RiveButton>
            ) : (
              <a
                href={ctaAction === "contact" ? "mailto:team@shipgate.dev?subject=ShipGate%20Enterprise" : "#"}
                className="relative z-10 mt-6 block w-full py-3 text-center soft-card__btn"
              >
                {cta}
              </a>
            )}
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

/* ═══════════════════════════════════════════════════════════
   FAQ Section
   ═══════════════════════════════════════════════════════════ */
function FAQSection({ isMobile }: { isMobile: boolean }) {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const half = Math.ceil(FAQ_ITEMS.length / 2);
  const leftCol = FAQ_ITEMS.slice(0, half);
  const rightCol = FAQ_ITEMS.slice(half);

  const renderItem = (item: { q: string; a: string }, idx: number) => (
    <div key={item.q} className="soft-card" style={{ marginBottom: 12 }}>
      <button
        type="button"
        onClick={() => setFaqOpen(faqOpen === idx ? null : idx)}
        className="relative z-10 w-full flex items-center justify-between text-left hover:opacity-90 transition-opacity"
        style={{ background: "none", border: "none", cursor: "pointer", padding: isMobile ? "14px 14px" : "16px 20px", gap: 12 }}
      >
        <span className="text-white" style={{ fontWeight: 500, fontSize: isMobile ? 13 : 14 }}>{item.q}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${faqOpen === idx ? "rotate-180" : ""}`}
          style={{ color: faqOpen === idx ? T.ship : "rgba(255,255,255,0.5)" }}
        />
      </button>
      <AnimatePresence>
        {faqOpen === idx && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 overflow-hidden"
            style={{ padding: isMobile ? "0 14px 14px" : "0 20px 16px" }}
          >
            <div style={{ height: 1, background: `linear-gradient(90deg, ${T.ship}40, ${T.accent}40)`, marginBottom: 12 }} />
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 1.7 }}>{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div style={{ width: "100%", textAlign: "center" }}>
      <h2 className="section-heading mx-auto mb-2">Frequently Asked Questions</h2>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 32 }}>Everything you need to know about ShipGate.</p>
      {isMobile ? (
        <div style={{ textAlign: "left" }}>
          {FAQ_ITEMS.map((item, i) => renderItem(item, i))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, textAlign: "left" }}>
          <div>{leftCol.map((item, i) => renderItem(item, i))}</div>
          <div>{rightCol.map((item, i) => renderItem(item, i + half))}</div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Landing Page
   ═══════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { mobile, tablet } = useBreakpoint();
  const tunnelScrollRef = useRef(0);

  const handleStripeCheckout = async (planName: string) => {
    try {
      const priceMap: Record<string, string> = {
        'Starter': STRIPE_PRICE_IDS.starter,
        'Pro': STRIPE_PRICE_IDS.pro,
        'Enterprise': STRIPE_PRICE_IDS.enterprise,
      };
      
      const priceId = priceMap[planName];
      const { url } = await createCheckoutSession(priceId);
      window.location.href = url;
    } catch (error) {
      console.error('Stripe checkout error:', error);
    }
  };

  const handleNavClick = (path: string) => {
    if (path.startsWith('http')) {
      window.open(path, '_blank');
    } else {
      window.location.href = path;
    }
  };

  const termLines = [
    { prefix: "$ ", prefixColor: T.text3, text: "npx shipgate verify .", color: T.text0 },
    { text: "" },
    { text: "  ⚡ ShipGate v1.0.0", color: T.text3 },
    { text: "  Scanning acme-api...", color: T.text2 },
    { text: "" },
    { text: "  ✓ Import Integrity       PROVEN   100%", color: T.ship },
    { text: "  ✓ Auth Coverage          PROVEN   100%", color: T.ship },
    { text: "  ✓ Input Validation       PROVEN   100%", color: T.ship },
    { text: "  ✓ SQL Injection          PROVEN    98%", color: T.ship },
    { text: "  ✓ Secret Exposure        PROVEN   100%", color: T.ship },
    { text: "  ◐ Type Safety            PARTIAL   94%", color: T.warn },
    { text: "  ◐ Error Handling         PARTIAL   87%", color: T.warn },
    { text: "" },
    { text: "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", color: T.text3 },
    { text: "  🎯 VERIFICATION COMPLETE", color: T.ship },
    { text: "  📊 12 checks passed • 2 warnings", color: T.text2 },
    { text: "  🚀 Ready for deployment", color: T.ship },
  ];

  return (
    <div style={{ color: T.text1, fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif" }}>

      {/* ═══ FIXED SHADER BACKGROUND (z-0) ═══ */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden" }} aria-hidden="true">
        <div style={{ position: "absolute", inset: 0, transform: `scale(${mobile ? 1.0 : 0.88})`, transformOrigin: "50% 50%" }}>
          <DangerousMission scrollRef={tunnelScrollRef} />
        </div>
      </div>

      {/* ═══ LOGO (z-100) ═══ */}
      <div style={{
        position: "fixed", top: mobile ? -6 : -10, left: mobile ? 12 : 24, zIndex: 100,
      }}>
        <img src={shipgateLogo} alt="ShipGate" style={{ width: mobile ? 80 : 120, height: mobile ? 80 : 120, objectFit: "contain", mixBlendMode: "screen" }} />
      </div>

      {/* ═══ FROSTED NAV (z-100) ═══ */}
      <FrostedNav />

      {/* ═══════════════════════════════════════════════════
          3D TUNNEL SCROLL — all content flies through Z-space
          ═══════════════════════════════════════════════════ */}
      <ScrollTunnel tunnelScrollRef={tunnelScrollRef} totalDepth={144000}>

        {/* ── HERO ── */}
        <TunnelSection z={-1200} x={mobile ? 0 : -300} width={mobile ? "100vw" : "950px"}>
          <div style={{ textAlign: "center", padding: "0 20px" }}>
            <h1 className="hero-title-stack" data-testid="hero-title">
              <span className="h1--scalingSize" data-text="AI Code.">AI Code.</span>
              <span className="h1--scalingSize" data-text="Verified." style={{ marginTop: 12, marginBottom: 12 }}>Verified.</span>
            </h1>
            <p style={{
              fontSize: mobile ? 16 : 18, color: "rgba(255,255,255,0.6)", lineHeight: 1.6,
              maxWidth: 560, margin: "24px auto 36px", letterSpacing: "-0.01em",
            }}>
              ShipGate produces signed proof bundles for AI-generated code — so your team ships with confidence and your auditors ship with documentation.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <RiveButton href="/signup" variant="primary">Get Started Free</RiveButton>
              <RiveButton href="https://marketplace.visualstudio.com/items?itemName=ShipGate.shipgate-isl" variant="secondary">Download Now</RiveButton>
            </div>
            <p style={{ fontSize: 12, color: T.text3, marginBottom: 32 }}>Free for open source · No credit card required</p>
          </div>
          <div style={{ width: "100%", marginTop: 8 }}>
            <LogoCarousel />
          </div>
        </TunnelSection>

        {/* ── PROBLEM: The 3 AI Bugs ── */}
        {mobile ? (
          <>
            {/* Header: The 3 AI Bugs */}
            <TunnelSection z={-3600} x={0} width="100vw">
              <div style={{ textAlign: "center", padding: "0 20px" }}>
                <h2 className="section-heading mb-4">The 3 AI <span style={{ color: "#ef4444" }}>Bugs</span></h2>
                <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: 40, maxWidth: 600, margin: "0 auto 40px", fontSize: 16, lineHeight: 1.6 }}>
                  AI-generated code passes compilation, linting, and PR review. But these bugs still ship to production.
                </p>
              </div>
            </TunnelSection>

            {/* AI Bug 1 */}
            <TunnelSection z={-9600} x={0} width="100vw">
              <div style={{ padding: "0 20px" }}>
                <ProblemBox className="text-left">
                  <div className={`w-10 h-10 rounded-xl border-red-500/20 border flex items-center justify-center mb-4`}>
                    <Skull className="w-5 h-5 text-red-500" />
                  </div>
                  <h3 className="text-red-500 mb-2" style={{ fontSize: 18, fontWeight: 600 }}>Silent Failures</h3>
                  <p className="text-white/75 text-sm" style={{ lineHeight: 1.7 }}>AI generates code that compiles but fails silently in production due to edge cases it can't anticipate.</p>
                </ProblemBox>
              </div>
            </TunnelSection>

            {/* AI Bug 2 */}
            <TunnelSection z={-15600} x={0} width="100vw">
              <div style={{ padding: "0 20px" }}>
                <ProblemBox className="text-left">
                  <div className={`w-10 h-10 rounded-xl border-orange-500/20 border flex items-center justify-center mb-4`}>
                    <Ghost className="w-5 h-5 text-orange-500" />
                  </div>
                  <h3 className="text-orange-500 mb-2" style={{ fontSize: 18, fontWeight: 600 }}>Logic Gaps</h3>
                  <p className="text-white/75 text-sm" style={{ lineHeight: 1.7 }}>AI misses subtle business logic requirements and domain-specific constraints that humans catch.</p>
                </ProblemBox>
              </div>
            </TunnelSection>

            {/* AI Bug 3 */}
            <TunnelSection z={-21600} x={0} width="100vw">
              <div style={{ padding: "0 20px" }}>
                <ProblemBox className="text-left">
                  <div className={`w-10 h-10 rounded-xl border-yellow-500/20 border flex items-center justify-center mb-4`}>
                    <KeyRound className="w-5 h-5 text-yellow-500" />
                  </div>
                  <h3 className="text-yellow-500 mb-2" style={{ fontSize: 18, fontWeight: 600 }}>Security Blind Spots</h3>
                  <p className="text-white/75 text-sm" style={{ lineHeight: 1.7 }}>AI introduces vulnerabilities through incomplete threat modeling and missing security patterns.</p>
                </ProblemBox>
              </div>
            </TunnelSection>
          </>
        ) : (
          <TunnelSection z={-3600} x={-180} width="1100px">
            <div style={{ textAlign: "center", padding: "0 20px" }}>
              <h2 className="section-heading mb-4">The 3 AI <span style={{ color: "#ef4444" }}>Bugs</span></h2>
              <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: 40, maxWidth: 600, margin: "0 auto 40px", fontSize: 16, lineHeight: 1.6 }}>
                AI-generated code passes compilation, linting, and PR review. But these bugs still ship to production.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, width: "100%", maxWidth: 900 }}>
                {AI_BUGS.map(({ icon: Icon, title, description, color, borderColor }) => (
                  <ProblemBox key={title} className="text-left">
                    <div className={`w-10 h-10 rounded-xl ${borderColor} border flex items-center justify-center mb-4`}>
                      <Icon className={`w-5 h-5 ${color}`} />
                    </div>
                    <h3 className={`${color} mb-2`} style={{ fontSize: 18, fontWeight: 600 }}>{title}</h3>
                    <p className="text-white/75 text-sm" style={{ lineHeight: 1.7 }}>{description}</p>
                  </ProblemBox>
                ))}
              </div>
            </div>
          </TunnelSection>
        )}

        {/* ── PROOF BUNDLES ── */}
        {mobile ? (
          <>
            {/* Card 1: Not trust. Proof. + features */}
            <TunnelSection z={-26400} x={0} width="100vw">
              <div style={{ padding: "0 24px" }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ display: "inline-block", fontSize: 11, fontWeight: 600, color: T.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>The Core Product</div>
                  <h2 className="section-heading" style={{ marginBottom: 16 }}>
                    Not trust.<br /><span style={{ color: T.ship }}>Proof.</span>
                  </h2>
                  <p style={{ fontSize: 15, color: T.text2, lineHeight: 1.7, marginBottom: 24 }}>
                    Every scan produces a cryptographically signed proof bundle documenting exactly what was checked, what passed, what failed, and what wasn't verified.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {[
                      "Machine-verifiable claims with file-level evidence",
                      "Residual risk explicitly disclosed — no hidden gaps",
                      "HMAC-SHA256 signed for tamper detection",
                      "Maps directly to SOC 2, HIPAA, and EU AI Act controls",
                    ].map((item, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, fontSize: 14, color: T.text1, lineHeight: 1.5 }}>
                        <span style={{ color: T.ship, flexShrink: 0 }}>✓</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TunnelSection>

            {/* Card 2: ProofBundle visual */}
            <TunnelSection z={-28800} x={0} width="100vw">
              <div style={{ padding: "0 24px" }}>
                <ProofBundle />
              </div>
            </TunnelSection>
          </>
        ) : (
          <TunnelSection z={-26400} x={200} width="1200px">
            <div style={{ display: "grid", gridTemplateColumns: tablet ? "1fr" : "1fr 1fr", gap: tablet ? 32 : 48, alignItems: "center", padding: "0 24px", width: "100%" }}>
              <div style={{ textAlign: "left" }}>
                <div style={{ display: "inline-block", fontSize: 11, fontWeight: 600, color: T.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>The Core Product</div>
                <h2 className="section-heading" style={{ marginBottom: 16 }}>
                  Not trust.<br /><span style={{ color: T.ship }}>Proof.</span>
                </h2>
                <p style={{ fontSize: 15, color: T.text2, lineHeight: 1.7, marginBottom: 24 }}>
                  Every scan produces a cryptographically signed proof bundle documenting exactly what was checked, what passed, what failed, and what wasn't verified.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    "Machine-verifiable claims with file-level evidence",
                    "Residual risk explicitly disclosed — no hidden gaps",
                    "HMAC-SHA256 signed for tamper detection",
                    "Maps directly to SOC 2, HIPAA, and EU AI Act controls",
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, fontSize: 14, color: T.text1, lineHeight: 1.5 }}>
                      <span style={{ color: T.ship, flexShrink: 0 }}>✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <ProofBundle />
            </div>
          </TunnelSection>
        )}

        {/* ── COMPLIANCE ── */}
        <TunnelSection z={-36000} x={mobile ? 0 : -160} width={mobile ? "100vw" : "1200px"}>
          <div style={{ textAlign: "center", padding: "0 24px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.warn, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Compliance</div>
            <h2 className="section-heading mx-auto" style={{ marginBottom: 12 }}>
              The audit trail your CISO is asking for.
            </h2>
            <p style={{ fontSize: 15, color: T.text2, maxWidth: 520, margin: "0 auto 40px" }}>
              Every verification maps automatically to compliance framework controls. No manual mapping. No spreadsheets.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: mobile ? 10 : 16, flexWrap: "wrap" }}>
              <ComplianceBadge name="SOC 2 Type II" pct={83} isMobile={mobile} />
              <ComplianceBadge name="HIPAA" pct={71} isMobile={mobile} />
              <ComplianceBadge name="EU AI Act" pct={67} isMobile={mobile} />
              <ComplianceBadge name="PCI-DSS" pct={58} isMobile={mobile} />
              <ComplianceBadge name="FedRAMP" pct={52} isMobile={mobile} />
            </div>
          </div>
        </TunnelSection>

        {/* ── TERMINAL DEMO ── */}
        <TunnelSection z={-45600} x={mobile ? 0 : 180} width={mobile ? "100vw" : "850px"}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h2 className="section-heading mx-auto" style={{ marginBottom: 12 }}>See it in action</h2>
            <p style={{ fontSize: 15, color: T.text2 }}>One command. Real-time verification.</p>
          </div>
          <div style={{ width: "100%", padding: "0 20px" }}>
            <TerminalDemo lines={termLines} title="~/acme-api" />
          </div>
        </TunnelSection>

        {/* ── HOW IT WORKS ── */}
        {mobile ? (
          <>
            <TunnelSection z={-52800} x={0} width="100vw">
              <div style={{ textAlign: "center", padding: "0 20px", width: "100%" }}>
                <h2 className="section-heading mx-auto mb-4">How it works</h2>
                <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: 40 }}>Three commands. Zero broken deploys.</p>
              </div>
            </TunnelSection>

            {/* Step 1 */}
            <TunnelSection z={-55200} x={0} width="100vw">
              <div style={{ padding: "0 20px" }}>
                <div className="soft-card p-6" style={{ textAlign: "left", display: "flex", flexDirection: "column" }}>
                  <div className="relative z-10 flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-sm text-white shrink-0" style={{ fontWeight: 700 }}>1</div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center soft-card__icon-pill">
                      <TerminalIcon className="w-5 h-5 text-white" strokeWidth={2} />
                    </div>
                  </div>
                  <h3 className="relative z-10 text-white mb-2" style={{ fontSize: 18, fontWeight: 600 }}>shipgate scan</h3>
                  <p className="relative z-10 text-sm text-white/75 mb-4 flex-1">Run shipgate scan on your codebase. It analyzes every file and generates a comprehensive verification report.</p>
                  <div className="relative z-10 rounded-lg bg-black/50 border border-white/10 p-3 font-mono text-xs" style={{ lineHeight: 1.7 }}>
                    <div>$ shipgate scan ./src</div>
                    <div>$ shipgate scan --all</div>
                  </div>
                </div>
              </div>
            </TunnelSection>

            {/* Step 2 */}
            <TunnelSection z={-57600} x={0} width="100vw">
              <div style={{ padding: "0 20px" }}>
                <div className="soft-card p-6" style={{ textAlign: "left", display: "flex", flexDirection: "column" }}>
                  <div className="relative z-10 flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-sm text-white shrink-0" style={{ fontWeight: 700 }}>2</div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center soft-card__icon-pill">
                      <GitBranch className="w-5 h-5 text-white" strokeWidth={2} />
                    </div>
                  </div>
                  <h3 className="relative z-10 text-white mb-2" style={{ fontSize: 18, fontWeight: 600 }}>shipgate verify</h3>
                  <p className="relative z-10 text-sm text-white/75 mb-4 flex-1">Verify the scan results with cryptographic signatures. Each verification is tamper-proof and auditable.</p>
                  <div className="relative z-10 rounded-lg bg-black/50 border border-white/10 p-3 font-mono text-xs" style={{ lineHeight: 1.7 }}>
                    <div>$ shipgate verify proof.json</div>
                    <div>$ shipgate verify --chain</div>
                  </div>
                </div>
              </div>
            </TunnelSection>

            {/* Step 3 */}
            <TunnelSection z={-60000} x={0} width="100vw">
              <div style={{ padding: "0 20px" }}>
                <div className="soft-card p-6" style={{ textAlign: "left", display: "flex", flexDirection: "column" }}>
                  <div className="relative z-10 flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-sm text-white shrink-0" style={{ fontWeight: 700 }}>3</div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center soft-card__icon-pill">
                      <Shield className="w-5 h-5 text-white" strokeWidth={2} />
                    </div>
                  </div>
                  <h3 className="relative z-10 text-white mb-2" style={{ fontSize: 18, fontWeight: 600 }}>shipgate deploy</h3>
                  <p className="relative z-10 text-sm text-white/75 mb-4 flex-1">Deploy with confidence knowing your code is verified. ShipGate integrates with your CI/CD pipeline for automated verification.</p>
                  <div className="relative z-10 rounded-lg bg-black/50 border border-white/10 p-3 font-mono text-xs" style={{ lineHeight: 1.7 }}>
                    <div>$ shipgate deploy --verify</div>
                    <div>$ shipgate deploy --auto</div>
                  </div>
                </div>
              </div>
            </TunnelSection>
          </>
        ) : (
          <TunnelSection z={-52800} x={-200} width="1200px">
            <div style={{ textAlign: "center", padding: "0 20px", width: "100%" }}>
              <h2 className="section-heading mx-auto mb-4">How it works</h2>
              <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: 40 }}>Three commands. Zero broken deploys.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
                {HOW_IT_WORKS.map(({ step, icon: Icon, title, body, code }) => (
                  <div key={title} className="soft-card p-6" style={{ textAlign: "left", display: "flex", flexDirection: "column" }}>
                    <div className="relative z-10 flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-sm text-white shrink-0" style={{ fontWeight: 700 }}>{step}</div>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center soft-card__icon-pill">
                        <Icon className="w-5 h-5 text-white" strokeWidth={2} />
                      </div>
                    </div>
                    <h3 className="relative z-10 text-white mb-2" style={{ fontSize: 18, fontWeight: 600 }}>{title}</h3>
                    <p className="relative z-10 text-sm text-white/75 mb-4 flex-1">{body}</p>
                    <div className="relative z-10 rounded-lg bg-black/50 border border-white/10 p-3 font-mono text-xs" style={{ lineHeight: 1.7 }}>
                      {code.split("\n").map((line, li) => (
                        <div key={li} className={getCodeLineColor(line)}>{line}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TunnelSection>
        )}

        {/* ── DASHBOARD SHOWCASE ── */}
        {mobile ? (
          <>
            <TunnelSection z={-67200} x={0} width="100vw">
              <div style={{ textAlign: "center", padding: "0 20px", width: "100%" }}>
                <h2 className="section-heading mx-auto mb-4">ShipGate Dashboard</h2>
                <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: 40 }}>Real-time insights and verification at your fingertips</p>
              </div>
            </TunnelSection>

            {/* Dashboard Screenshot 1 */}
            <TunnelSection z={-69600} x={0} width="100vw">
              <div style={{ padding: "0 20px" }}>
                <div className="soft-card p-4" style={{ textAlign: "center" }}>
                  <div style={{
                    width: "100%",
                    height: "200px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    marginBottom: "16px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(0,0,0,0.2)"
                  }}>
                    <img 
                      src="/dashboard-1.png" 
                      alt="Dashboard Overview"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                  <h3 style={{ color: "#ffffff", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                    Project Overview
                  </h3>
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, margin: 0 }}>
                    Monitor all your projects and their verification status in real-time
                  </p>
                </div>
              </div>
            </TunnelSection>

            {/* Dashboard Screenshot 2 */}
            <TunnelSection z={-72000} x={0} width="100vw">
              <div style={{ padding: "0 20px" }}>
                <div className="soft-card p-4" style={{ textAlign: "center" }}>
                  <div style={{
                    width: "100%",
                    height: "200px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    marginBottom: "16px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(0,0,0,0.2)"
                  }}>
                    <img 
                      src="/dashboard-2.png" 
                      alt="Verification Details"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                  <h3 style={{ color: "#ffffff", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                    Verification Reports
                  </h3>
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, margin: 0 }}>
                    Detailed breakdown of security checks and compliance metrics
                  </p>
                </div>
              </div>
            </TunnelSection>

            {/* Dashboard Screenshot 3 */}
            <TunnelSection z={-74400} x={0} width="100vw">
              <div style={{ padding: "0 20px" }}>
                <div className="soft-card p-4" style={{ textAlign: "center" }}>
                  <div style={{
                    width: "100%",
                    height: "200px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    marginBottom: "16px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(0,0,0,0.2)"
                  }}>
                    <img 
                      src="/dashboard-3.png" 
                      alt="Analytics"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                  <h3 style={{ color: "#ffffff", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                    Analytics & Insights
                  </h3>
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, margin: 0 }}>
                    Track trends, performance metrics, and security improvements over time
                  </p>
                </div>
              </div>
            </TunnelSection>
          </>
        ) : (
          <TunnelSection z={-67200} x={-100} width="1100px">
            <div style={{ textAlign: "center", padding: "0 20px", width: "100%" }}>
              <h2 className="section-heading mx-auto mb-4">ShipGate Dashboard</h2>
              <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: 40 }}>Real-time insights and verification at your fingertips</p>
              
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(3, 1fr)", 
                gap: 24,
                marginBottom: 32
              }}>
                {/* Dashboard Screenshot 1 */}
                <div className="soft-card p-4" style={{ textAlign: "center" }}>
                  <div style={{
                    width: "100%",
                    height: "200px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    marginBottom: "16px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(0,0,0,0.2)"
                  }}>
                    <img 
                      src="/dashboard-1.png" 
                      alt="Dashboard Overview"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                  <h3 style={{ color: "#ffffff", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                    Project Overview
                  </h3>
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, margin: 0 }}>
                    Monitor all your projects and their verification status in real-time
                  </p>
                </div>

                {/* Dashboard Screenshot 2 */}
                <div className="soft-card p-4" style={{ textAlign: "center" }}>
                  <div style={{
                    width: "100%",
                    height: "200px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    marginBottom: "16px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(0,0,0,0.2)"
                  }}>
                    <img 
                      src="/dashboard-2.png" 
                      alt="Verification Details"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                  <h3 style={{ color: "#ffffff", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                    Verification Reports
                  </h3>
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, margin: 0 }}>
                    Detailed breakdown of security checks and compliance metrics
                  </p>
                </div>

                {/* Dashboard Screenshot 3 */}
                <div className="soft-card p-4" style={{ textAlign: "center" }}>
                  <div style={{
                    width: "100%",
                    height: "200px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    marginBottom: "16px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(0,0,0,0.2)"
                  }}>
                    <img 
                      src="/dashboard-3.png" 
                      alt="Analytics"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                  <h3 style={{ color: "#ffffff", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                    Analytics & Insights
                  </h3>
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, margin: 0 }}>
                    Track trends, performance metrics, and security improvements over time
                  </p>
                </div>
              </div>

              <div style={{ textAlign: "center", marginTop: 24 }}>
                <RiveButton href="/signin" variant="primary">
                  Try Dashboard Now
                </RiveButton>
              </div>
            </div>
          </TunnelSection>
        )}

        {/* ── PRICING ── */}
        {mobile ? (
          <>
            <TunnelSection z={-81600} x={0} width="100vw">
              <div style={{ textAlign: "center", padding: "0 16px", width: "100%" }}>
                <h2 className="section-heading mx-auto mb-4">Pricing</h2>
                <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: 40 }}>Free to start. Scale when you need to.</p>
              </div>
            </TunnelSection>

            {/* Plan 1 */}
            <TunnelSection z={-84000} x={0} width="100vw">
              <div style={{ padding: "0 16px" }}>
                <div className="soft-card p-6 text-center flex flex-col">
                  <div className="relative z-10 w-10 h-10 rounded-full mx-auto mb-4 flex items-center justify-center soft-card__icon-pill">
                    <CheckCircle2 className="w-5 h-5 text-white" strokeWidth={2} />
                  </div>
                  <h3 className="relative z-10 text-white" style={{ fontSize: 18, fontWeight: 600 }}>Free</h3>
                  <p className="relative z-10 text-sm mt-1 text-white/80">Perfect for individuals and small projects</p>
                  <div className="relative z-10 mt-4 flex items-baseline justify-center gap-1">
                    <span className="text-white" style={{ fontSize: 28, fontWeight: 700 }}>Free</span>
                  </div>
                  <ul className="relative z-10 mt-6 space-y-2 text-left flex-1">
                    <li className="flex items-start gap-2 text-sm text-white/90">
                      <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                      Up to 5 projects
                    </li>
                    <li className="flex items-start gap-2 text-sm text-white/90">
                      <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                      Basic verification
                    </li>
                    <li className="flex items-start gap-2 text-sm text-white/90">
                      <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                      Community support
                    </li>
                  </ul>
                  <a href="/signup" className="relative z-10 mt-6 block w-full py-3 text-center soft-card__btn">Get Started</a>
                </div>
              </div>
            </TunnelSection>

            {/* Plan 2 */}
            <TunnelSection z={-86400} x={0} width="100vw">
              <div style={{ padding: "0 16px" }}>
                <div className="soft-card p-6 text-center flex flex-col ring-1 ring-cyan-500/30">
                  <div className="relative z-10 w-10 h-10 rounded-full mx-auto mb-4 flex items-center justify-center soft-card__icon-pill">
                    <CheckCircle2 className="w-5 h-5 text-white" strokeWidth={2} />
                  </div>
                  <h3 className="relative z-10 text-white" style={{ fontSize: 18, fontWeight: 600 }}>Pro</h3>
                  <p className="relative z-10 text-sm mt-1 text-white/80">For growing teams and organizations</p>
                  <div className="relative z-10 mt-4 flex items-baseline justify-center gap-1">
                    <span className="text-white" style={{ fontSize: 36, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.03em" }}>$29</span>
                    <span className="text-white/80">/mo</span>
                  </div>
                  <ul className="relative z-10 mt-6 space-y-2 text-left flex-1">
                    <li className="flex items-start gap-2 text-sm text-white/90">
                      <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                      Unlimited projects
                    </li>
                    <li className="flex items-start gap-2 text-sm text-white/90">
                      <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                      Advanced verification
                    </li>
                    <li className="flex items-start gap-2 text-sm text-white/90">
                      <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                      Priority support
                    </li>
                    <li className="flex items-start gap-2 text-sm text-white/90">
                      <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                      Team collaboration
                    </li>
                  </ul>
                  <RiveButton 
                    onClick={() => handleStripeCheckout("Pro")} 
                    variant="primary" 
                    className="relative z-10 mt-6 w-full justify-center"
                  >
                    Start Free Trial
                  </RiveButton>
                </div>
              </div>
            </TunnelSection>

            {/* Plan 3 */}
            <TunnelSection z={-88800} x={0} width="100vw">
              <div style={{ padding: "0 16px" }}>
                <div className="soft-card p-6 text-center flex flex-col">
                  <div className="relative z-10 w-10 h-10 rounded-full mx-auto mb-4 flex items-center justify-center soft-card__icon-pill">
                    <CheckCircle2 className="w-5 h-5 text-white" strokeWidth={2} />
                  </div>
                  <h3 className="relative z-10 text-white" style={{ fontSize: 18, fontWeight: 600 }}>Enterprise</h3>
                  <p className="relative z-10 text-sm mt-1 text-white/80">Custom solutions for large enterprises</p>
                  <div className="relative z-10 mt-4 flex items-baseline justify-center gap-1">
                    <span className="text-white" style={{ fontSize: 28, fontWeight: 700 }}>Custom</span>
                  </div>
                  <ul className="relative z-10 mt-6 space-y-2 text-left flex-1">
                    <li className="flex items-start gap-2 text-sm text-white/90">
                      <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                      Custom integrations
                    </li>
                    <li className="flex items-start gap-2 text-sm text-white/90">
                      <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                      On-premise deployment
                    </li>
                    <li className="flex items-start gap-2 text-sm text-white/90">
                      <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                      Dedicated support
                    </li>
                    <li className="flex items-start gap-2 text-sm text-white/90">
                      <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                      SLA guarantees
                    </li>
                  </ul>
                  <a href="mailto:founder@shipgate.dev?subject=ShipGate%20Enterprise" className="relative z-10 mt-6 block w-full py-3 text-center soft-card__btn">Contact Sales</a>
                </div>
              </div>
            </TunnelSection>
          </>
        ) : (
          <TunnelSection z={-81600} x={150} width="1200px">
            <div style={{ textAlign: "center", padding: "0 16px", width: "100%" }}>
              <h2 className="section-heading mx-auto mb-4">Pricing</h2>
              <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: 40 }}>Free to start. Scale when you need to.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                {PRICING_PLANS.map(({ icon: Icon, name, price, period, tagline, features, cta, ctaAction, highlighted }) => (
                  <div key={name} className={`soft-card p-6 text-center flex flex-col ${highlighted ? "ring-1 ring-cyan-500/30" : ""}`}>
                    <div className="relative z-10 w-10 h-10 rounded-full mx-auto mb-4 flex items-center justify-center soft-card__icon-pill">
                      <Icon className="w-5 h-5 text-white" strokeWidth={2} />
                    </div>
                    <h3 className="relative z-10 text-white" style={{ fontSize: 18, fontWeight: 600 }}>{name}</h3>
                    <p className="relative z-10 text-sm mt-1 text-white/80">{tagline}</p>
                    <div className="relative z-10 mt-4 flex items-baseline justify-center gap-1">
                      {price === "—" ? (
                        <span className="text-white" style={{ fontSize: 28, fontWeight: 700 }}>{period}</span>
                      ) : (
                        <>
                          <span className="text-white" style={{ fontSize: 36, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.03em" }}>${price}</span>
                          <span className="text-white/80">{period}</span>
                        </>
                      )}
                    </div>
                    <ul className="relative z-10 mt-6 space-y-2 text-left flex-1">
                      {features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-white/90">
                          <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {highlighted ? (
                      <RiveButton 
                        onClick={() => handleStripeCheckout(name)} 
                        variant="primary" 
                        className="relative z-10 mt-6 w-full justify-center"
                      >
                        {cta}
                      </RiveButton>
                    ) : (
                      <a href={ctaAction === "contact" ? "mailto:founder@shipgate.dev?subject=ShipGate%20Enterprise" : "#"} className="relative z-10 mt-6 block w-full py-3 text-center soft-card__btn">{cta}</a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </TunnelSection>
        )}

        {/* ── FAQ ── */}
        <TunnelSection z={-96000} x={mobile ? 0 : -170} width={mobile ? "100vw" : "950px"}>
          <FAQSection isMobile={mobile} />
        </TunnelSection>

        {/* ── CTA ── */}
        <TunnelSection z={-108000} x={0} width={mobile ? "100vw" : "850px"}>
          <div style={{
            padding: mobile ? "40px 20px" : "56px 40px", borderRadius: 16,
            position: "relative", overflow: "hidden", width: "100%",
          }} className="soft-card">
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              width: 400, height: 400, borderRadius: "50%",
              background: `radial-gradient(circle, ${T.ship}08, transparent 70%)`,
            }} />
            <h2 className="section-heading mx-auto" style={{ marginBottom: 12, position: "relative", textAlign: "center" }}>
              Start shipping with proof.
            </h2>
            <p style={{ fontSize: 15, color: T.text2, marginBottom: 28, position: "relative", textAlign: "center" }}>
              One command. Thirty seconds. Your first proof bundle.
            </p>
            <div style={{ textAlign: "center", position: "relative" }}>
              <RiveButton href="https://marketplace.visualstudio.com/items?itemName=ShipGate.shipgate-isl" variant="primary">Download Now</RiveButton>
            </div>
          </div>
        </TunnelSection>

      </ScrollTunnel>

      {/* ═══ DEMO VIDEO SECTION — after tunnel ends ═══ */}
      <div style={{
        position: "relative", zIndex: 10,
        background: "linear-gradient(180deg, rgba(6,6,10,0) 0%, rgba(6,6,10,1) 12%, rgba(6,6,10,1) 100%)",
        paddingTop: 120,
      }}>
        <div style={{
          maxWidth: 960, margin: "0 auto", padding: "0 24px 80px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>See It In Action</div>
          <h2 className="section-heading mx-auto" style={{ marginBottom: 12 }}>
            See ShipGate in action
          </h2>
          <p style={{ fontSize: 15, color: T.text2, marginBottom: 40, maxWidth: 500, margin: "0 auto 40px" }}>
            A demonstration of ShipGate running verification tests on a Playwright project.
          </p>

          {/* Demo video */}
          <div style={{
            position: "relative", width: "100%", maxWidth: "95vw", height: mobile ? "50vh" : "75vh", margin: "0 auto",
            borderRadius: 16, overflow: "hidden",
            border: `1px solid ${T.border}`,
            boxShadow: `0 0 60px ${T.ship}10`,
          }}>
            <video
              controls
              autoPlay
              muted
              playsInline
              preload="metadata"
              style={{
                width: "100%", height: "100%", display: "block",
                borderRadius: 16,
                background: "#000",
                objectFit: "cover",
              }}
            >
              <source src={`/demo-video.mp4?t=${Date.now()}`} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 80, paddingTop: 40, borderTop: `1px solid ${T.border}` }}>
            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fit, minmax(200px, 1fr))", gap: mobile ? 24 : 40, marginBottom: 40 }}>
                {/* Product */}
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: T.text0, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>Product</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <a href="/features" style={{ fontSize: 13, color: T.text2, textDecoration: "none", transition: "color 0.2s" }}>Features</a>
                    <a href="/pricing" style={{ fontSize: 13, color: T.text2, textDecoration: "none", transition: "color 0.2s" }}>Pricing</a>
                    <a href="/security" style={{ fontSize: 13, color: T.text2, textDecoration: "none", transition: "color 0.2s" }}>Security</a>
                    <a href="/live-api" style={{ fontSize: 13, color: T.text2, textDecoration: "none", transition: "color 0.2s" }}>Live API</a>
                    <a href="/comparison" style={{ fontSize: 13, color: T.text2, textDecoration: "none", transition: "color 0.2s" }}>Comparison</a>
                  </div>
                </div>

                {/* Resources */}
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: T.text0, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>Resources</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <a href="https://blog.shipgate.dev" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: T.text2, textDecoration: "none", transition: "color 0.2s" }}>Blog</a>
                    <a href="/docs" style={{ fontSize: 13, color: T.text2, textDecoration: "none", transition: "color 0.2s" }}>Documentation</a>
                    <a href="/walkthrough" style={{ fontSize: 13, color: T.text2, textDecoration: "none", transition: "color 0.2s" }}>Walkthrough</a>
                    <a href="/dashboard" style={{ fontSize: 13, color: T.text2, textDecoration: "none", transition: "color 0.2s" }}>Dashboard</a>
                    <a href="/pipeline" style={{ fontSize: 13, color: T.text2, textDecoration: "none", transition: "color 0.2s" }}>Pipeline</a>
                  </div>
                </div>

                {/* Company */}
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: T.text0, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>Company</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <a href="/about" style={{ fontSize: 13, color: T.text2, textDecoration: "none", transition: "color 0.2s" }}>About</a>
                    <a href="/contact" style={{ fontSize: 13, color: T.text2, textDecoration: "none", transition: "color 0.2s" }}>Contact</a>
                    <a href="/privacy" style={{ fontSize: 13, color: T.text2, textDecoration: "none", transition: "color 0.2s" }}>Privacy</a>
                    <a href="/terms" style={{ fontSize: 13, color: T.text2, textDecoration: "none", transition: "color 0.2s" }}>Terms</a>
                  </div>
                </div>

                              </div>

              {/* Bottom bar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 24, borderTop: `1px solid ${T.border}`, flexWrap: "wrap", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <img src={shipgateLogo} alt="ShipGate" style={{ width: 40, height: 40, objectFit: "contain", mixBlendMode: "screen" }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.text0 }}>ShipGate</span>
                </div>
                <p style={{ fontSize: 12, color: T.text3, margin: 0 }}>&copy; {new Date().getFullYear()} ShipGate. All rights reserved.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sign In Modal */}
      <SignInModal />
    </div>
  );
}