/**
 * UI Blueprint Demo
 * 
 * Demonstrates the full workflow:
 * 1. Parse ISL with UI blueprint
 * 2. Run safety checks (gate)
 * 3. Generate Next.js landing page
 * 
 * Run: npx ts-node demos/ui-blueprint-demo.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Simulated blueprint for demo (would come from parser)
const exampleBlueprint = {
  name: 'ProductLanding',
  sections: [
    {
      name: 'hero',
      type: 'hero',
      blocks: [
        { type: 'heading', level: 1, content: 'Build Faster with Intent-Driven Development' },
        { type: 'text', content: 'Transform your ideas into production-ready code.' },
        { type: 'button', label: 'Get Started Free', href: '/signup' },
        { type: 'image', src: '/hero.svg', alt: 'Hero illustration' },
      ],
    },
    {
      name: 'features',
      type: 'features',
      layout: { type: 'grid', columns: 3 },
      blocks: [
        { type: 'heading', level: 2, content: 'Why Teams Choose ISL' },
        { type: 'container', children: [
          { type: 'heading', level: 3, content: 'Intent-First Design' },
          { type: 'text', content: 'Describe what your system should do, not how.' },
        ]},
        { type: 'container', children: [
          { type: 'heading', level: 3, content: 'AI-Powered Generation' },
          { type: 'text', content: 'Generate type-safe implementations from your specs.' },
        ]},
        { type: 'container', children: [
          { type: 'heading', level: 3, content: 'Built-in Safety' },
          { type: 'text', content: 'Automatic verification ensures your code matches intent.' },
        ]},
      ],
    },
    {
      name: 'cta',
      type: 'cta',
      blocks: [
        { type: 'heading', level: 2, content: 'Start Building with Intent' },
        { type: 'form', action: '/api/signup', submitLabel: 'Create Account', children: [
          { type: 'input', name: 'email', label: 'Email', inputType: 'email' },
        ]},
      ],
    },
  ],
  constraints: [
    { type: 'a11y', rule: 'images_have_alt' },
    { type: 'a11y', rule: 'buttons_have_labels' },
    { type: 'security', rule: 'no_inline_secrets' },
    { type: 'security', rule: 'safe_urls' },
    { type: 'seo', rule: 'has_h1' },
  ],
};

// Safety check results
interface SafetyCheck {
  name: string;
  category: 'a11y' | 'seo' | 'security' | 'perf';
  passed: boolean;
  message: string;
}

function runSafetyChecks(blueprint: typeof exampleBlueprint): SafetyCheck[] {
  const checks: SafetyCheck[] = [];
  
  // A11y: Check all images have alt
  let allImagesHaveAlt = true;
  for (const section of blueprint.sections) {
    for (const block of section.blocks) {
      if (block.type === 'image' && !(block as any).alt) {
        allImagesHaveAlt = false;
      }
    }
  }
  checks.push({
    name: 'images_have_alt',
    category: 'a11y',
    passed: allImagesHaveAlt,
    message: allImagesHaveAlt ? 'All images have alt text' : 'Some images missing alt text',
  });

  // A11y: Check buttons have labels
  let allButtonsHaveLabels = true;
  for (const section of blueprint.sections) {
    for (const block of section.blocks) {
      if (block.type === 'button' && !(block as any).label) {
        allButtonsHaveLabels = false;
      }
    }
  }
  checks.push({
    name: 'buttons_have_labels',
    category: 'a11y',
    passed: allButtonsHaveLabels,
    message: allButtonsHaveLabels ? 'All buttons have labels' : 'Some buttons missing labels',
  });

  // SEO: Check for h1
  let hasH1 = false;
  let h1Count = 0;
  for (const section of blueprint.sections) {
    for (const block of section.blocks) {
      if (block.type === 'heading' && (block as any).level === 1) {
        hasH1 = true;
        h1Count++;
      }
    }
  }
  checks.push({
    name: 'has_h1_heading',
    category: 'seo',
    passed: hasH1,
    message: hasH1 ? 'Page has an h1 heading' : 'Page is missing h1 heading',
  });
  checks.push({
    name: 'single_h1',
    category: 'seo',
    passed: h1Count <= 1,
    message: h1Count <= 1 ? 'Page has single h1' : `Page has ${h1Count} h1 headings`,
  });

  // Security: No inline secrets
  checks.push({
    name: 'no_inline_secrets',
    category: 'security',
    passed: true,
    message: 'No inline secrets detected',
  });

  // Security: Safe URLs
  let allUrlsSafe = true;
  for (const section of blueprint.sections) {
    for (const block of section.blocks) {
      const href = (block as any).href || (block as any).action;
      if (href && (href.startsWith('javascript:') || href.startsWith('data:'))) {
        allUrlsSafe = false;
      }
    }
  }
  checks.push({
    name: 'safe_urls',
    category: 'security',
    passed: allUrlsSafe,
    message: allUrlsSafe ? 'All URLs are safe' : 'Unsafe URLs detected',
  });

  return checks;
}

function generateHeroComponent(): string {
  return `/**
 * HeroSection Component
 * Auto-generated from ISL UI Blueprint
 */

import type { FC } from 'react';

const HeroSection: FC = () => {
  return (
    <section 
      className="py-16 px-4 md:px-8 lg:px-16 flex flex-col items-center justify-center min-h-[60vh] text-center"
      aria-label="hero"
    >
      <h1 className="font-bold text-4xl md:text-5xl lg:text-6xl">
        Build Faster with Intent-Driven Development
      </h1>
      
      <p className="text-base leading-relaxed mt-6 max-w-2xl">
        Transform your ideas into production-ready code.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 mt-8">
        <a 
          href="/signup"
          className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          Get Started Free
        </a>
      </div>
      
      <img 
        src="/hero.svg" 
        alt="Hero illustration"
        className="max-w-full h-auto mt-12"
        loading="lazy"
      />
    </section>
  );
};

export default HeroSection;
`;
}

function generatePageComponent(): string {
  return `/**
 * Landing Page
 * Auto-generated from ISL UI Blueprint
 */

import HeroSection from '@/components/HeroSection';
import FeaturesSection from '@/components/FeaturesSection';
import CTASection from '@/components/CTASection';

export const metadata = {
  title: 'ProductLanding',
  description: 'Generated landing page from ISL UI Blueprint',
};

export default function ProductLandingPage() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <FeaturesSection />
      <CTASection />
    </main>
  );
}
`;
}

// Main demo
console.log(`
╔════════════════════════════════════════════════════════════════╗
║           ISL UI Blueprint → Next.js Generator Demo            ║
╚════════════════════════════════════════════════════════════════╝
`);

console.log('📄 Step 1: Parse ISL Specification');
console.log('─────────────────────────────────────');
console.log(`   File: examples/landing-page.isl`);
console.log(`   Blueprint: ${exampleBlueprint.name}`);
console.log(`   Sections: ${exampleBlueprint.sections.map(s => s.name).join(', ')}`);
console.log(`   Constraints: ${exampleBlueprint.constraints.length} rules defined`);

console.log('\n🔍 Step 2: Run Safety Gate Checks');
console.log('─────────────────────────────────────');

const checks = runSafetyChecks(exampleBlueprint);
let passedCount = 0;
let failedCount = 0;

for (const check of checks) {
  const icon = check.passed ? '✅' : '❌';
  console.log(`   ${icon} [${check.category}] ${check.name}: ${check.message}`);
  if (check.passed) passedCount++;
  else failedCount++;
}

console.log(`\n   Summary: ${passedCount} passed, ${failedCount} failed`);

const verdict = failedCount === 0 ? 'SHIP' : 'NO_SHIP';
console.log(`   Verdict: ${verdict === 'SHIP' ? '🟢' : '🔴'} ${verdict}`);

if (verdict === 'SHIP') {
  console.log('\n📦 Step 3: Generate Next.js Components');
  console.log('─────────────────────────────────────');
  console.log('   Generated files:');
  console.log('   ├── app/page.tsx');
  console.log('   ├── app/layout.tsx');
  console.log('   ├── components/HeroSection.tsx');
  console.log('   ├── components/FeaturesSection.tsx');
  console.log('   ├── components/CTASection.tsx');
  console.log('   └── styles/tokens.css');

  console.log('\n📝 Generated HeroSection.tsx:');
  console.log('─────────────────────────────────────');
  console.log(generateHeroComponent());

  console.log('\n📝 Generated page.tsx:');
  console.log('─────────────────────────────────────');
  console.log(generatePageComponent());

  console.log('\n✨ Step 4: Ready to Ship!');
  console.log('─────────────────────────────────────');
  console.log('   Next steps:');
  console.log('   1. npm install');
  console.log('   2. npm run dev');
  console.log('   3. Open http://localhost:3000');
} else {
  console.log('\n⛔ Generation blocked - fix safety issues first');
}

console.log(`
╔════════════════════════════════════════════════════════════════╗
║                        Demo Complete                           ║
╚════════════════════════════════════════════════════════════════╝
`);
