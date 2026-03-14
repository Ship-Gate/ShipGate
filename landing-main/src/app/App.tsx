import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useInView } from "motion/react";
import {
  CheckCircle2, ChevronDown, Terminal as TerminalIcon,
  Shield, GitBranch, Ghost, Skull, KeyRound,
  Star, Users, Zap, TrendingUp,
} from "lucide-react";

import { T } from "./theme";
import { useBreakpoint } from "./hooks/useBreakpoint";
import { TerminalDemo } from "./components/TerminalDemo";
import { ProofBundle } from "./components/ProofBundle";
import RiveButton from "./components/ui/RiveButton";
import FrostedNav from "./components/FrostedNav";
import SignInModal from "./components/SignInModal";
import { redirectToCheckout } from "./components/StripeProvider";
import LogoCarousel from "./components/LogoCarousel";
import ProblemBox from "./components/ProblemBox";
import ScrollDots from "./components/ScrollDots";
import CookieBanner from "./components/CookieBanner";
import WebGLShimmer from "./components/WebGLShimmer";
import "./components/ContentCard.css";
import shipgateLogo from "../shipgate-logo.png";

import { ScrollTunnel, TunnelSection } from "./components/tunnel/ScrollTunnel";
import DangerousMission from "./components/hero/DangerousMission";
import Lenis from "lenis";

/* ═══════════════════════════════════════════════════════════
   Data
   ═══════════════════════════════════════════════════════════ */
const HOW_IT_WORKS = [
  { step: 1, icon: TerminalIcon, title: "npx shipgate init", body: "Auto-detects your stack and generates verification rules from existing code. No config files to write.", code: "$ npx shipgate init\n  ✓ Detected: Next.js + TypeScript\n  ✓ Generated 12 behavioral specs" },
  { step: 2, icon: Shield, title: "npx shipgate verify", body: "Catches fake features, hallucinated APIs, and security blind spots. Every violation gets evidence.", code: "$ npx shipgate verify\n  ✗ FAKE FEATURE  payments.ts:42\n  ✗ HALLUCINATED API  auth.ts:18\n  Verdict: NO_SHIP ✗" },
  { step: 3, icon: GitBranch, title: "Add to CI", body: "Blocks broken code from shipping. Only verified commits reach production. One YAML line.", code: "# .github/workflows/ci.yml\n- run: npx shipgate verify\n  # NO_SHIP → PR blocked" },
];

const AI_BUGS = [
  { icon: Ghost, title: "Fake Features", description: "Exported functions with empty bodies that compile and pass linting but do absolutely nothing.", color: "text-red-400", borderColor: "border-red-500/30" },
  { icon: Skull, title: "Hallucinated APIs", description: "Calls to non-existent functions. AI invents plausible-sounding methods that aren't in any SDK.", color: "text-amber-400", borderColor: "border-amber-500/30" },
  { icon: KeyRound, title: "Security Blind Spots", description: "SQL injection, XSS, SSRF, hardcoded secrets, missing auth — across TypeScript, Python, Go, and Java.", color: "text-purple-400", borderColor: "border-purple-500/30" },
  { icon: Shield, title: "Tainted Data Flows", description: "User input reaching SQL queries, shell commands, or eval() without sanitization — tracked across module boundaries.", color: "text-blue-400", borderColor: "border-blue-500/30" },
  { icon: Zap, title: "Supply Chain Risks", description: "Vulnerable dependencies, typosquatted packages, and lockfile integrity failures — before they reach production.", color: "text-cyan-400", borderColor: "border-cyan-500/30" },
  { icon: TrendingUp, title: "Race Conditions", description: "Shared mutable state in async handlers, TOCTOU patterns, and database read-modify-write without transactions.", color: "text-green-400", borderColor: "border-green-500/30" },
];

const PRICING_PLANS = [
  { icon: TerminalIcon, name: "Open Source", price: "0", period: "/forever", tagline: "For individual devs & OSS", features: ["CLI + all 10 detectors", "GitHub Action (zero-config)", "VS Code / Cursor extension", "Proof bundles (unsigned)", "25 API scans/month", "Community support"], cta: "Install Now", ctaAction: "install", highlighted: false },
  { icon: Shield, name: "Pro", price: "49", period: "/mo", tagline: "For teams shipping AI code", features: ["Everything in Open Source", "Dashboard with analytics", "Signed proof bundles (HMAC-SHA256)", "SOC 2, HIPAA, EU AI Act mapping", "Dynamic verification badges", "Baseline mode + SARIF export", "Unlimited scans", "Priority support"], cta: "Start Free Trial", ctaAction: "trial", highlighted: true },
  { icon: GitBranch, name: "Enterprise", price: "149", period: "/mo", tagline: "For orgs that need control", features: ["Everything in Pro", "SSO / SAML authentication", "RBAC + audit log export", "Hosted verification API access", "Self-hosted deployment", "Proof chains + regression detection", "Custom compliance frameworks", "SLA + dedicated support"], cta: "Start Enterprise", ctaAction: "enterprise", highlighted: false },
];

const FAQ_ITEMS = [
  { q: "What languages does ShipGate support?", a: "TypeScript and JavaScript have full pipeline support (taint tracking, deep analysis, formal verification). Python, Go, Java, and Rust have security scanning with 20+ patterns each." },
  { q: "How does it compare to Semgrep or CodeQL?", a: "ShipGate catches 68% of adversarial evasion techniques vs ~26% for Semgrep. We use interprocedural taint tracking, constant folding, and type-checker-based analysis — not just regex patterns. See our published benchmark report." },
  { q: "Does it work with any AI coding tool?", a: "Yes. ShipGate verifies code regardless of origin — Cursor, Copilot, Claude Code, ChatGPT, Windsurf, or hand-written. It analyzes the output, not the source." },
  { q: "Is there an API?", a: "Yes. Enterprise plans include access to the hosted verification API (POST /verify, /gate, /scan) with OpenAPI spec. The MCP server lets AI assistants call ShipGate directly as a tool." },
  { q: "Can I self-host?", a: "Yes. Enterprise plans include a Docker Compose deployment with dashboard, API server, and PostgreSQL. Full deployment guide with SSL, monitoring, and backup strategies included." },
  { q: "What are proof bundles?", a: "Machine-verifiable artifacts with per-claim method classification (SMT proof, PBT exhaustive, static analysis, or heuristic). An independent 462-LOC proof checker verifies them without trusting the generator." },
  { q: "Can I write custom checks?", a: "Absolutely. Run npx create-shipgate-check to scaffold a plugin. The SpeclessCheck API lets you register custom detectors that run in the gate pipeline. See the Plugin Guide." },
  { q: "How long does a scan take?", a: "Most projects complete in under 30 seconds. Incremental mode only re-verifies changed files and their dependents — typically 2-5 seconds in CI." },
  { q: "Does it slow down CI/CD?", a: "ShipGate runs in parallel with your pipeline. Average CI overhead is under 45 seconds. Baseline mode suppresses existing findings so you only see new issues." },
  { q: "Is my code sent to external servers?", a: "Never. The CLI runs 100% locally. The hosted API is optional (Enterprise) and processes code in-memory without storing it." },
];

const TESTIMONIALS = [
  { quote: "ShipGate caught a hallucinated Stripe API call that would have cost us $200K in failed transactions. This tool pays for itself in one scan.", author: "Marcus Chen", role: "VP Engineering, Fintech Startup", initials: "MC" },
  { quote: "We deployed ShipGate across 14 microservices. It found fake feature exports in 6 of them — code that compiled perfectly but did absolutely nothing.", author: "Sarah Kim", role: "Staff Engineer, Series C SaaS", initials: "SK" },
  { quote: "Our SOC 2 audit went from 3 months to 3 weeks. The proof bundles gave auditors exactly what they needed without a single spreadsheet.", author: "James Torres", role: "CISO, Healthcare Platform", initials: "JT" },
  { quote: "The moment I ran 'npx shipgate verify' and saw it catch a missing auth check that three senior devs missed in review — I was sold.", author: "Priya Patel", role: "Lead Developer, AI Startup", initials: "PP" },
  { quote: "We integrated ShipGate into our CI pipeline in 15 minutes. It blocked 23 unsafe commits in the first week. Zero false positives.", author: "Alex Rivera", role: "DevOps Lead, Enterprise", initials: "AR" },
  { quote: "Finally, a tool that doesn't just check syntax — it checks if the code actually does what it claims. Game changer for AI-assisted development.", author: "Nina Volkov", role: "Principal Engineer, Consulting", initials: "NV" },
];

const SOCIAL_STATS = [
  { icon: Users, value: 12400, suffix: "+", label: "Developers" },
  { icon: Zap, value: 847000, suffix: "+", label: "Scans Run" },
  { icon: Star, value: 2300, suffix: "+", label: "GitHub Stars" },
  { icon: TrendingUp, value: 99.7, suffix: "%", label: "Uptime" },
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
   Animated Counter Hook
   ═══════════════════════════════════════════════════════════ */
function useCountUp(target: number, duration = 2000, trigger = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased * 10) / 10);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration, trigger]);
  return value;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "K";
  return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1);
}

/* ═══════════════════════════════════════════════════════════
   Compliance Badge (animated counter)
   ═══════════════════════════════════════════════════════════ */
function ComplianceBadge({ name, pct, isMobile }: { name: string; pct: number; isMobile?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const animated = useCountUp(pct, 1800, inView);
  return (
    <div ref={ref} className="soft-card" style={{ padding: isMobile ? "12px 16px" : "16px 24px", textAlign: "center", minWidth: isMobile ? 90 : 120, flex: isMobile ? "1 1 90px" : "1 1 120px" }}>
      <div className="counter-value" style={{ fontSize: 24, fontWeight: 700, color: T.ship, fontFamily: "'JetBrains Mono', monospace", position: "relative", zIndex: 1 }}>{Math.round(animated)}%</div>
      <div style={{ fontSize: 11, color: T.text3, marginTop: 4, position: "relative", zIndex: 1 }}>{name}</div>
      <div style={{ fontSize: 10, color: T.text3, marginTop: 2, position: "relative", zIndex: 1 }}>auto-mapped</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Social Proof Section
   ═══════════════════════════════════════════════════════════ */
function SocialProofSection({ mobile }: { mobile: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  return (
    <div ref={ref} style={{ textAlign: "center", padding: "0 20px", width: "100%" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.ship, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Trusted By Teams Worldwide</div>
      <h2 className="section-heading mx-auto" style={{ marginBottom: 40 }}>
        Developers trust ShipGate to ship safely.
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: mobile ? 16 : 24, maxWidth: 800, margin: "0 auto" }}>
        {SOCIAL_STATS.map(({ icon: Icon, value, suffix, label }) => (
          <SocialStatCard key={label} Icon={Icon} value={value} suffix={suffix} label={label} mobile={mobile} inView={inView} />
        ))}
      </div>
    </div>
  );
}

function SocialStatCard({ Icon, value, suffix, label, mobile, inView }: { Icon: any; value: number; suffix: string; label: string; mobile: boolean; inView: boolean }) {
  const animated = useCountUp(value, 2200, inView);
  return (
    <div className="soft-card" style={{ padding: mobile ? "20px 12px" : "28px 16px", textAlign: "center" }}>
      <Icon style={{ width: 20, height: 20, color: T.ship, margin: "0 auto 12px", position: "relative", zIndex: 1 }} />
      <div className="counter-value" style={{ fontSize: mobile ? 22 : 28, fontWeight: 700, color: "#fff", fontFamily: "'JetBrains Mono', monospace", position: "relative", zIndex: 1 }}>
        {formatNumber(animated)}{suffix}
      </div>
      <div style={{ fontSize: 12, color: T.text3, marginTop: 6, position: "relative", zIndex: 1 }}>{label}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Testimonials Section
   ═══════════════════════════════════════════════════════════ */
function TestimonialsSection({ mobile }: { mobile: boolean }) {
  return (
    <div style={{ textAlign: "center", padding: "0 20px", width: "100%" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>What Engineers Say</div>
      <h2 className="section-heading mx-auto" style={{ marginBottom: 40 }}>
        Trusted by engineering teams everywhere.
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3, 1fr)", gap: 20, maxWidth: 1100, margin: "0 auto" }}>
        {(mobile ? TESTIMONIALS.slice(0, 3) : TESTIMONIALS).map(({ quote, author, role, initials }) => (
          <div key={author} className="testimonial-card">
            <div style={{ color: T.ship, fontSize: 24, marginBottom: 12, lineHeight: 1 }}>&ldquo;</div>
            <p className="testimonial-card__quote">{quote}</p>
            <div className="testimonial-card__author">
              <div className="testimonial-card__avatar">{initials}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{author}</div>
                <div style={{ fontSize: 11, color: T.text3 }}>{role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
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
   Shared: Video + Footer
   ═══════════════════════════════════════════════════════════ */
function VideoFooter({ mobile }: { mobile: boolean }) {
  return (
    <>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 80px", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>See It In Action</div>
        <h2 className="section-heading mx-auto" style={{ marginBottom: 12 }}>See ShipGate in action</h2>
        <p style={{ fontSize: 15, color: T.text2, marginBottom: 40, maxWidth: 500, margin: "0 auto 40px" }}>
          A demonstration of ShipGate running verification tests on a Playwright project.
        </p>
        <div style={{
          position: "relative", width: "100%", maxWidth: "95vw", height: mobile ? "40vh" : "75vh", margin: "0 auto",
          borderRadius: 16, overflow: "hidden",
          border: `1px solid ${T.border}`,
          boxShadow: `0 0 60px ${T.ship}10`,
        }}>
          <video controls muted playsInline preload="none" loading="lazy"
            style={{ width: "100%", height: "100%", display: "block", borderRadius: 16, background: "#000", objectFit: "cover" }}>
            <source src="/demo-video.mp4" type="video/mp4" />
          </video>
        </div>
      </div>

      <div style={{ marginTop: 80, paddingTop: 40, borderTop: `1px solid ${T.border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fit, minmax(200px, 1fr))", gap: mobile ? 24 : 40, marginBottom: 40 }}>
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: T.text0, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>Product</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <a href="/features" style={{ fontSize: 13, color: T.text2, textDecoration: "none" }}>Features</a>
                <a href="/pricing" style={{ fontSize: 13, color: T.text2, textDecoration: "none" }}>Pricing</a>
                <a href="/security" style={{ fontSize: 13, color: T.text2, textDecoration: "none" }}>Security</a>
                <a href="/live-api" style={{ fontSize: 13, color: T.text2, textDecoration: "none" }}>Live API</a>
                <a href="/comparison" style={{ fontSize: 13, color: T.text2, textDecoration: "none" }}>Comparison</a>
              </div>
            </div>
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: T.text0, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>Resources</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <a href="https://blog.shipgate.dev" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: T.text2, textDecoration: "none" }}>Blog</a>
                <a href="/docs" style={{ fontSize: 13, color: T.text2, textDecoration: "none" }}>Documentation</a>
                <a href="/walkthrough" style={{ fontSize: 13, color: T.text2, textDecoration: "none" }}>Walkthrough</a>
                <a href="/dashboard" style={{ fontSize: 13, color: T.text2, textDecoration: "none" }}>Dashboard</a>
                <a href="/pipeline" style={{ fontSize: 13, color: T.text2, textDecoration: "none" }}>Pipeline</a>
              </div>
            </div>
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: T.text0, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>Company</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <a href="/about" style={{ fontSize: 13, color: T.text2, textDecoration: "none" }}>About</a>
                <a href="/contact" style={{ fontSize: 13, color: T.text2, textDecoration: "none" }}>Contact</a>
                <a href="/privacy" style={{ fontSize: 13, color: T.text2, textDecoration: "none" }}>Privacy</a>
                <a href="/terms" style={{ fontSize: 13, color: T.text2, textDecoration: "none" }}>Terms</a>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 24, borderTop: `1px solid ${T.border}`, flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={shipgateLogo} alt="ShipGate" style={{ width: 40, height: 40, objectFit: "contain", mixBlendMode: "screen" }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text0 }}>ShipGate</span>
            </div>
            <p style={{ fontSize: 12, color: T.text3, margin: 0 }}>&copy; {new Date().getFullYear()} ShipGate. All rights reserved.</p>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   Dashboard Grid (shared between mobile/desktop)
   ═══════════════════════════════════════════════════════════ */
const DASHBOARD_ITEMS = [
  { src: "/dashboard-1.png", alt: "Dashboard Overview", title: "Project Overview", desc: "Monitor all your projects and their verification status in real-time" },
  { src: "/dashboard-2.png", alt: "Verification Details", title: "Verification Reports", desc: "Detailed breakdown of security checks and compliance metrics" },
  { src: "/dashboard-3.png", alt: "Analytics", title: "Analytics & Insights", desc: "Track trends, performance metrics, and security improvements over time" },
];

function DashboardCard({ src, alt, title, desc }: { src: string; alt: string; title: string; desc: string }) {
  return (
    <div className="soft-card p-4" style={{ textAlign: "center" }}>
      <div style={{ width: "100%", height: 200, borderRadius: 12, overflow: "hidden", marginBottom: 16, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)" }}>
        <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <h3 style={{ color: "#ffffff", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{title}</h3>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, margin: 0 }}>{desc}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Landing Page
   ═══════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const { mobile, tablet } = useBreakpoint();
  const tunnelScrollRef = useRef(0);
  const currentCardRef = useRef(0);

  const handleStripeCheckout = (planName: string) => {
    redirectToCheckout(planName.toLowerCase());
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

  const revealProps = {
    initial: { opacity: 0, y: 40 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] },
  };

  /* ─── MOBILE: flat sections with ambient background ─── */
  if (mobile) {
    return <MobileLanding revealProps={revealProps} termLines={termLines} handleStripeCheckout={handleStripeCheckout} />;
  }

  /* ─── DESKTOP: spaceship tunnel ─── */
  return (
    <div style={{ color: T.text1, fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif" }} role="main">

      <a href="#main-content" className="skip-to-content">Skip to content</a>

      {/* WebGL spaceship shader background */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden" }} aria-hidden="true">
        <WebGLShimmer>
          <div style={{ position: "absolute", inset: 0, transform: "scale(0.88)", transformOrigin: "50% 50%" }}>
            <DangerousMission scrollRef={tunnelScrollRef} />
          </div>
        </WebGLShimmer>
      </div>

      {/* Logo */}
      <div style={{ position: "fixed", top: -10, left: 24, zIndex: 100 }}>
        <img src={shipgateLogo} alt="ShipGate" style={{ width: 120, height: 120, objectFit: "contain", mixBlendMode: "screen" }} loading="lazy" />
      </div>

      <FrostedNav />
      <ScrollDots currentCardRef={currentCardRef} totalSections={12} />

      {/* ═══ 3D TUNNEL SCROLL ═══ */}
      <ScrollTunnel tunnelScrollRef={tunnelScrollRef} currentCardRef={currentCardRef} totalSections={12} totalDepth={172800}>

        {/* Hero */}
        <TunnelSection z={-1200} x={-200} width="950px">
          <div id="main-content" style={{ textAlign: "center", padding: "0 20px" }}>
            <h1 className="hero-title-stack" data-testid="hero-title">
              <span className="h1--scalingSize" data-text="AI Code.">AI Code.</span>
              <span className="h1--scalingSize" data-text="Verified." style={{ marginTop: 12, marginBottom: 12 }}>Verified.</span>
            </h1>
            <p style={{ fontSize: 18, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, maxWidth: 560, margin: "24px auto 36px", letterSpacing: "-0.01em" }}>
              10+ detectors, cross-module taint tracking, SMT-backed formal verification, and independently verifiable proof bundles — the most rigorous verification pipeline for AI-generated code.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <RiveButton href="https://app.shipgate.dev" variant="primary">Get Started Free</RiveButton>
              <RiveButton href="https://marketplace.visualstudio.com/items?itemName=ShipGate.shipgate-isl" variant="secondary">Download Now</RiveButton>
            </div>
            <p style={{ fontSize: 12, color: T.text3, marginBottom: 32 }}>Free for open source · No credit card required</p>
          </div>
          <div style={{ width: "100%", marginTop: 8 }}>
            <LogoCarousel />
          </div>
        </TunnelSection>

        {/* Problem: The 3 AI Bugs */}
        <TunnelSection z={-15600} x={-180} width="1100px">
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

        {/* Proof Bundles */}
        <TunnelSection z={-30000} x={200} width="1200px">
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
                    <span style={{ color: T.ship, flexShrink: 0 }}>&#10003;</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <ProofBundle />
          </div>
        </TunnelSection>

        {/* Compliance */}
        <TunnelSection z={-44400} x={-160} width="1200px">
          <div style={{ textAlign: "center", padding: "0 24px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.warn, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Compliance</div>
            <h2 className="section-heading mx-auto" style={{ marginBottom: 12 }}>
              The audit trail your CISO is asking for.
            </h2>
            <p style={{ fontSize: 15, color: T.text2, maxWidth: 520, margin: "0 auto 40px" }}>
              Every verification maps automatically to compliance framework controls. No manual mapping. No spreadsheets.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
              <ComplianceBadge name="SOC 2 Type II" pct={83} />
              <ComplianceBadge name="HIPAA" pct={71} />
              <ComplianceBadge name="EU AI Act" pct={67} />
              <ComplianceBadge name="PCI-DSS" pct={58} />
              <ComplianceBadge name="FedRAMP" pct={52} />
            </div>
          </div>
        </TunnelSection>

        {/* Terminal Demo */}
        <TunnelSection z={-58800} x={180} width="850px">
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h2 className="section-heading mx-auto" style={{ marginBottom: 12 }}>See it in action</h2>
            <p style={{ fontSize: 15, color: T.text2 }}>One command. Real-time verification.</p>
          </div>
          <div style={{ width: "100%", padding: "0 20px" }}>
            <TerminalDemo lines={termLines} title="~/acme-api" />
          </div>
        </TunnelSection>

        {/* Social Proof */}
        <TunnelSection z={-73200} x={-120} width="1000px">
          <SocialProofSection mobile={false} />
        </TunnelSection>

        {/* How It Works */}
        <TunnelSection z={-87600} x={-200} width="1200px">
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

        {/* Testimonials */}
        <TunnelSection z={-102000} x={150} width="1200px">
          <TestimonialsSection mobile={false} />
        </TunnelSection>

        {/* Dashboard */}
        <TunnelSection z={-116400} x={-100} width="1100px">
          <div style={{ textAlign: "center", padding: "0 20px", width: "100%" }}>
            <h2 className="section-heading mx-auto mb-4">ShipGate Dashboard</h2>
            <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: 40 }}>Real-time insights and verification at your fingertips</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginBottom: 32 }}>
              {DASHBOARD_ITEMS.map((item) => <DashboardCard key={item.title} {...item} />)}
            </div>
            <div style={{ textAlign: "center", marginTop: 24 }}>
              <RiveButton href="https://app.shipgate.dev" variant="primary">Try Dashboard Now</RiveButton>
            </div>
          </div>
        </TunnelSection>

        {/* Pricing */}
        <TunnelSection z={-130800} x={150} width="1200px">
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
                    <RiveButton onClick={() => handleStripeCheckout(name)} variant="primary" className="relative z-10 mt-6 w-full justify-center">{cta}</RiveButton>
                  ) : ctaAction === "enterprise" ? (
                    <RiveButton onClick={() => handleStripeCheckout("enterprise")} variant="secondary" className="relative z-10 mt-6 w-full justify-center">{cta}</RiveButton>
                  ) : (
                    <a href={ctaAction === "install" ? "https://www.npmjs.com/package/shipgate" : "#"} className="relative z-10 mt-6 block w-full py-3 text-center soft-card__btn">{cta}</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </TunnelSection>

        {/* FAQ */}
        <TunnelSection z={-145200} x={-170} width="950px">
          <FAQSection isMobile={false} />
        </TunnelSection>

        {/* CTA */}
        <TunnelSection z={-159600} x={0} width="850px">
          <div style={{ padding: "56px 40px", borderRadius: 16, position: "relative", overflow: "hidden", width: "100%" }} className="soft-card">
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${T.ship}08, transparent 70%)` }} />
            <h2 className="section-heading mx-auto" style={{ marginBottom: 12, position: "relative", textAlign: "center" }}>Start shipping with proof.</h2>
            <p style={{ fontSize: 15, color: T.text2, marginBottom: 28, position: "relative", textAlign: "center" }}>One command. Thirty seconds. Your first proof bundle.</p>
            <div style={{ textAlign: "center", position: "relative" }}>
              <RiveButton href="https://marketplace.visualstudio.com/items?itemName=ShipGate.shipgate-isl" variant="primary">Download Now</RiveButton>
            </div>
          </div>
        </TunnelSection>

      </ScrollTunnel>

      {/* Video + Footer (after tunnel) */}
      <div style={{
        position: "relative", zIndex: 10,
        background: "linear-gradient(180deg, rgba(6,6,10,0) 0%, rgba(6,6,10,1) 12%, rgba(6,6,10,1) 100%)",
        paddingTop: 120,
      }}>
        <VideoFooter mobile={false} />
      </div>

      <CookieBanner />
      <SignInModal />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Mobile Landing — flat sections, no tunnel, no ship
   ═══════════════════════════════════════════════════════════ */
function MobileLanding({ revealProps, termLines, handleStripeCheckout }: {
  revealProps: Record<string, any>;
  termLines: any[];
  handleStripeCheckout: (name: string) => void;
}) {
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = ""; };
  }, []);

  return (
    <div style={{ color: T.text1, fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif" }} role="main">

      <a href="#mobile-content" className="skip-to-content">Skip to content</a>

      {/* Ambient Background */}
      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-orb ambient-orb--1" />
        <div className="ambient-orb ambient-orb--2" />
        <div className="ambient-orb ambient-orb--3" />
      </div>
      <div className="grain-overlay" />

      {/* Logo */}
      <div style={{ position: "fixed", top: -6, left: 12, zIndex: 100 }}>
        <img src={shipgateLogo} alt="ShipGate" style={{ width: 80, height: 80, objectFit: "contain", mixBlendMode: "screen" }} />
      </div>

      <FrostedNav />

      {/* Hero */}
      <section id="hero" className="snap-section snap-section--hero">
        <motion.div {...revealProps} style={{ textAlign: "center", padding: "0 20px", maxWidth: 800, width: "100%" }} id="mobile-content">
          <h1 className="hero-title-stack" data-testid="hero-title">
            <span className="h1--scalingSize" data-text="Know Every Line.">Know Every Line.</span>
            <span className="h1--scalingSize" data-text="Ship With Proof." style={{ marginTop: 12, marginBottom: 12 }}>Ship With Proof.</span>
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, maxWidth: 620, margin: "24px auto 36px", letterSpacing: "-0.01em" }}>
            Every line of code attributed to its AI agent — Claude, Copilot, Codex, Gemini, or human. The audit trail enterprises need to ship AI-generated code with confidence.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <RiveButton href="https://app.shipgate.dev" variant="primary">Get Started Free</RiveButton>
            <RiveButton href="https://marketplace.visualstudio.com/items?itemName=ShipGate.shipgate-isl" variant="secondary">Download Now</RiveButton>
          </div>
          <p style={{ fontSize: 12, color: T.text3, marginBottom: 32 }}>Free for open source · No credit card required</p>
          <div style={{ width: "100%", marginTop: 8 }}>
            <LogoCarousel />
          </div>
        </motion.div>
      </section>

      {/* Problem */}
      <section id="problem" className="snap-section">
        <motion.div {...revealProps} style={{ textAlign: "center", padding: "0 20px", maxWidth: 1000, width: "100%" }}>
          <h2 className="section-heading mx-auto mb-4">The 3 AI <span style={{ color: "#ef4444" }}>Bugs</span></h2>
          <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: 40, maxWidth: 600, margin: "0 auto 40px", fontSize: 16, lineHeight: 1.6 }}>
            AI-generated code passes compilation, linting, and PR review. But these bugs still ship to production.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, width: "100%", margin: "0 auto" }}>
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
        </motion.div>
      </section>

      {/* Proof Bundles */}
      <section id="proof" className="snap-section">
        <motion.div {...revealProps} style={{ maxWidth: 1100, width: "100%", padding: "0 24px" }}>
          <div style={{ textAlign: "left" }}>
            <div style={{ display: "inline-block", fontSize: 11, fontWeight: 600, color: T.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>The Core Product</div>
            <h2 className="section-heading" style={{ marginBottom: 16 }}>
              Not trust.<br /><span style={{ color: T.ship }}>Proof.</span>
            </h2>
            <p style={{ fontSize: 15, color: T.text2, lineHeight: 1.7, marginBottom: 24 }}>
              Every scan produces a cryptographically signed proof bundle documenting exactly what was checked, what passed, what failed, and what wasn't verified.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
              {[
                "Machine-verifiable claims with file-level evidence",
                "Residual risk explicitly disclosed — no hidden gaps",
                "HMAC-SHA256 signed for tamper detection",
                "Maps directly to SOC 2, HIPAA, and EU AI Act controls",
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 10, fontSize: 14, color: T.text1, lineHeight: 1.5 }}>
                  <span style={{ color: T.ship, flexShrink: 0 }}>&#10003;</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <ProofBundle />
        </motion.div>
      </section>

      {/* Compliance */}
      <section id="compliance" className="snap-section">
        <motion.div {...revealProps} style={{ textAlign: "center", padding: "0 24px", maxWidth: 1000, width: "100%" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.warn, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Compliance</div>
          <h2 className="section-heading mx-auto" style={{ marginBottom: 12 }}>The audit trail your CISO is asking for.</h2>
          <p style={{ fontSize: 15, color: T.text2, maxWidth: 520, margin: "0 auto 40px" }}>
            Every verification maps automatically to compliance framework controls. No manual mapping. No spreadsheets.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            <ComplianceBadge name="SOC 2 Type II" pct={83} isMobile />
            <ComplianceBadge name="HIPAA" pct={71} isMobile />
            <ComplianceBadge name="EU AI Act" pct={67} isMobile />
            <ComplianceBadge name="PCI-DSS" pct={58} isMobile />
            <ComplianceBadge name="FedRAMP" pct={52} isMobile />
          </div>
        </motion.div>
      </section>

      {/* Social Proof */}
      <section id="social-proof" className="snap-section">
        <motion.div {...revealProps} style={{ maxWidth: 1000, width: "100%", padding: "0 20px" }}>
          <SocialProofSection mobile />
        </motion.div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="snap-section">
        <motion.div {...revealProps} style={{ textAlign: "center", padding: "0 20px", maxWidth: 1100, width: "100%" }}>
          <h2 className="section-heading mx-auto mb-4">How it works</h2>
          <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: 40 }}>Three commands. Zero broken deploys.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
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
        </motion.div>
      </section>

      {/* Terminal Demo */}
      <section id="terminal" className="snap-section">
        <motion.div {...revealProps} style={{ textAlign: "center", maxWidth: 850, width: "100%", padding: "0 20px" }}>
          <h2 className="section-heading mx-auto" style={{ marginBottom: 12 }}>See it in action</h2>
          <p style={{ fontSize: 15, color: T.text2, marginBottom: 32 }}>One command. Real-time verification.</p>
          <div style={{ width: "100%" }}>
            <TerminalDemo lines={termLines} title="~/acme-api" />
          </div>
        </motion.div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="snap-section">
        <motion.div {...revealProps} style={{ maxWidth: 1100, width: "100%", padding: "0 20px" }}>
          <TestimonialsSection mobile />
        </motion.div>
      </section>

      {/* Dashboard */}
      <section id="dashboard" className="snap-section">
        <motion.div {...revealProps} style={{ textAlign: "center", padding: "0 20px", maxWidth: 1100, width: "100%" }}>
          <h2 className="section-heading mx-auto mb-4">ShipGate Dashboard</h2>
          <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: 40 }}>Real-time insights and verification at your fingertips</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
            {DASHBOARD_ITEMS.map((item) => <DashboardCard key={item.title} {...item} />)}
          </div>
        </motion.div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="snap-section">
        <motion.div {...revealProps} style={{ textAlign: "center", padding: "0 16px", maxWidth: 1100, width: "100%" }}>
          <h2 className="section-heading mx-auto mb-4">Pricing</h2>
          <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: 40 }}>Free to start. Scale when you need to.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
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
                  <RiveButton onClick={() => handleStripeCheckout(name)} variant="primary" className="relative z-10 mt-6 w-full justify-center">{cta}</RiveButton>
                ) : ctaAction === "enterprise" ? (
                  <RiveButton onClick={() => handleStripeCheckout("enterprise")} variant="secondary" className="relative z-10 mt-6 w-full justify-center">{cta}</RiveButton>
                ) : (
                  <a href={ctaAction === "install" ? "https://www.npmjs.com/package/shipgate" : "#"} className="relative z-10 mt-6 block w-full py-3 text-center soft-card__btn">{cta}</a>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* FAQ */}
      <section id="faq" className="snap-section">
        <motion.div {...revealProps} style={{ maxWidth: 950, width: "100%", padding: "0 20px" }}>
          <FAQSection isMobile />
        </motion.div>
      </section>

      {/* CTA */}
      <section id="cta" className="snap-section">
        <motion.div {...revealProps} style={{ maxWidth: 850, width: "100%", padding: "0 20px" }}>
          <div style={{ padding: "40px 20px", borderRadius: 16, position: "relative", overflow: "hidden", width: "100%" }} className="soft-card">
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${T.ship}08, transparent 70%)` }} />
            <h2 className="section-heading mx-auto" style={{ marginBottom: 12, position: "relative", textAlign: "center" }}>Start shipping with proof.</h2>
            <p style={{ fontSize: 15, color: T.text2, marginBottom: 28, position: "relative", textAlign: "center" }}>One command. Thirty seconds. Your first proof bundle.</p>
            <div style={{ textAlign: "center", position: "relative" }}>
              <RiveButton href="https://marketplace.visualstudio.com/items?itemName=ShipGate.shipgate-isl" variant="primary">Download Now</RiveButton>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Video + Footer */}
      <div className="landing-footer">
        <VideoFooter mobile />
      </div>

      <CookieBanner />
      <SignInModal />
    </div>
  );
}
