# @isl-lang/codegen-ui

Generate safe, accessible Next.js landing pages from ISL UI blueprints.

## Features

- **UI Blueprint Syntax** - Declarative section-based page structure
- **Design Tokens** - CSS custom properties for consistent styling
- **Safety Constraints** - Built-in a11y, SEO, security checks
- **Gate Integration** - SHIP/NO_SHIP verdicts before generation
- **Next.js App Router** - Modern React Server Components

## Installation

```bash
pnpm add @isl-lang/codegen-ui
```

## Quick Start

### 1. Define your landing page in ISL

```isl
domain MyProduct {
  ui_blueprint LandingPage {
    
    constraints {
      a11y: images_have_alt
      a11y: buttons_have_labels
      security: no_inline_secrets
      security: safe_urls
      seo: has_h1_heading
    }

    section hero: hero {
      heading {
        level: "1"
        content: "Welcome to MyProduct"
      }
      
      text {
        content: "Build amazing things faster."
      }
      
      button {
        label: "Get Started"
        href: "/signup"
      }
    }

    section features: features {
      layout: grid { columns: 3 }
      
      heading {
        level: "2"
        content: "Features"
      }
      
      container {
        heading { level: "3", content: "Fast" }
        text { content: "Lightning quick performance." }
      }
    }
  }
}
```

### 2. Run safety checks

```bash
isl-ui check landing.isl
```

Output:
```
🔍 ISL UI Safety Checker

  ✅ a11y: images_have_alt
  ✅ a11y: buttons_have_labels
  ✅ security: no_inline_secrets
  ✅ security: safe_urls
  ✅ seo: has_h1_heading

🎉 SHIP - All safety checks passed!
```

### 3. Generate Next.js code

```bash
isl-ui generate landing.isl -o ./my-landing
```

Generated structure:
```
my-landing/
├── app/
│   ├── page.tsx
│   └── layout.tsx
├── components/
│   ├── HeroSection.tsx
│   └── FeaturesSection.tsx
└── styles/
    └── tokens.css
```

## UI Blueprint Syntax

### Sections

| Type | Description |
|------|-------------|
| `hero` | Hero section with centered layout |
| `features` | Feature grid or list |
| `testimonials` | Customer testimonials |
| `cta` | Call to action block |
| `footer` | Page footer |
| `header` | Navigation header |
| `content` | Generic content section |

### Content Blocks

| Block | Properties |
|-------|------------|
| `heading` | `level`, `content` |
| `text` | `content` |
| `image` | `src`, `alt` (required) |
| `button` | `label`, `href` |
| `link` | `content`, `href` |
| `form` | `action`, `method`, `submitLabel` |
| `container` | Wrapper for nested blocks |

### Layouts

```isl
layout: grid { columns: 3, gap: "24px" }
layout: flex { gap: "16px" }
layout: stack { gap: "8px" }
```

### Design Tokens

```isl
tokens {
  primaryColor: color "#6366f1"
  spacing_md: spacing "16px"
  heading_font: typography "Inter, sans-serif"
}
```

## Safety Checks

### Accessibility (a11y)

- `images_have_alt` - All images must have alt text
- `buttons_have_labels` - Buttons need accessible names
- `heading_hierarchy` - No skipped heading levels
- `forms_have_labels` - Form inputs need labels

### Security

- `no_inline_secrets` - Detect hardcoded API keys/tokens
- `safe_urls` - Block `javascript:`, `data:` URLs

### SEO

- `has_h1_heading` - Page must have h1
- `single_h1` - Only one h1 per page

### Performance

- `image_count` - Warn if too many images
- `lazy_load_images` - Enforce lazy loading

## API

```typescript
import { 
  generateLandingPage, 
  checkBlueprintSafety,
  toGateFindings 
} from '@isl-lang/codegen-ui';

// Run safety checks
const safetyResult = checkBlueprintSafety(blueprint);

if (safetyResult.passed) {
  // Generate Next.js code
  const result = generateLandingPage(blueprint, {
    outputDir: './generated',
    typescript: true,
    tailwind: true,
    routerType: 'app',
  });
  
  for (const file of result.files) {
    console.log(`Generated: ${file.path}`);
  }
}

// Convert to gate findings
const findings = toGateFindings(safetyResult);
```

## Integration with ISL Gate

The safety checker integrates with ISL Gate for CI/CD:

```typescript
import { toGateFindings } from '@isl-lang/codegen-ui';
import { runGate } from '@isl-lang/gate';

const safetyResult = checkBlueprintSafety(blueprint);
const findings = toGateFindings(safetyResult);

const gateResult = await runGate({
  findings,
  filesConsidered: 1,
  filesScanned: 1,
}, { projectRoot: process.cwd() });

if (gateResult.verdict === 'NO_SHIP') {
  console.error('Gate blocked:', gateResult.reasons);
  process.exit(1);
}
```

## License

MIT
