# Shipgate Landing Page Copy

---

## Hero Section

### Headline:
# Verify AI-Generated Code Before It Ships

### Subheadline:
Write ISL specs. Generate TypeScript types. Verify implementations. Get a trust score (0-100) for every PR.

### CTA Button:
**Get Started Free** → `npm install -g shipgate`

### Secondary CTA:
[VS Code Extension] [View on GitHub]

---

## Trust Bar (Logos/Social Proof)

```
"TypeScript checks types. Shipgate checks behavior."

Trusted by developers at [company logos - placeholder]
⭐ 500+ GitHub stars  •  📦 10K+ npm installs  •  🔌 2K+ VS Code installs
```

---

## Problem Section

### Headline:
## AI Writes Code That Compiles. But Does It Work?

### Copy:
GitHub Copilot, Cursor, and ChatGPT generate code that:
- ✅ Passes type checking
- ✅ Looks correct to reviewers  
- ❌ **Breaks in production**

Ghost features. Missing edge cases. Subtle bugs. They all slip through.

**The old way:** Write code → Review → Hope it works → Debug in production
**The Shipgate way:** Write intent → Verify → Ship with confidence

---

## Solution Section

### Headline:
## Intent-Driven Development

### The Workflow:
```
1. Write ISL Spec          2. AI Generates Code       3. Shipgate Verifies       4. Ship with Confidence
   ↓                            ↓                         ↓                         ↓
   domain User {               (AI writes                Trust Score: 94/100       Deployed
     id: UUID                   TypeScript from           ✓ Contracts passing       No bugs
     email: String               ISL spec)                 ✓ Edge cases covered
     
     invariants {                                         ✓ Invariants maintained
       email.is_valid()
     }
   }
```

---

## Features Grid

### Feature 1: ISL Language
**Intent Specification Language**
Define entities, behaviors, contracts, and invariants in a declarative syntax.

```isl
behavior CreateUser {
  input { email: String }
  output { success: User }
  
  preconditions {
    email.is_valid()
    not User.exists(email)
  }
  
  postconditions {
    success implies {
      result.email == input.email
    }
  }
}
```

### Feature 2: Type Generation
**Generate TypeScript + Zod**
Get type-safe code automatically. No more hand-writing validators.

```typescript
// Generated from ISL
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
});
```

### Feature 3: Runtime Verification
**Contracts That Actually Run**
Preconditions, postconditions, and invariants are checked at runtime.

```typescript
// Shipgate injects verification
function createUser(input) {
  verifyPreconditions(input);  // Checked at runtime
  const result = db.create(input);
  verifyPostconditions(result); // Checked at runtime
  return result;
}
```

### Feature 4: Trust Score
**Know Before You Ship**
Every implementation gets a composite trust score (0-100).

```
Trust Score: 94/100 ✓ VERIFIED

✓ Preconditions: 12/12 passed
✓ Postconditions: 18/18 passed  
✓ Invariants: 5/5 maintained
✓ Type Coverage: 97%
⚠ Edge Cases: 8/10 handled
```

---

## How It Works (Step-by-Step)

### Step 1: Write Your Intent
```isl
domain TaskManager {
  entity Task {
    id: UUID
    title: String
    status: TaskStatus
    
    invariants {
      title.length > 0
      status in [Todo, Done]
    }
  }
}
```

### Step 2: Generate Types
```bash
$ shipgate gen ts taskmanager.isl
✓ Generated taskmanager/types.ts
✓ Generated taskmanager/validation.ts
✓ Generated taskmanager/index.ts
```

### Step 3: Implement
```typescript
// Write your implementation
export async function createTask(input: CreateTaskInput): Promise<Task> {
  // Shipgate verifies contracts at runtime
  return db.tasks.create(input);
}
```

### Step 4: Verify
```bash
$ shipgate verify ./src
✓ Trust Score: 94/100
✓ 12/12 contracts passing
✓ All invariants maintained
```

---

## Demo Section

### Headline:
## See It In Action

### Video Placeholder:
[60-second demo video: AI generates code → Shipgate verifies → Trust score displayed]

**Or GIF:**
```
[Animated GIF showing CLI in action]
1. shipgate init my-app
2. Edit domain.isl
3. shipgate gen ts
4. shipgate verify
5. Trust score: 94/100 ✓
```

---

## Code Example (Full)

```isl
// domain.isl
domain Ecommerce {
  version: "1.0.0"

  entity User {
    id: UUID @unique @immutable
    email: String @unique
    name: String
    
    invariants {
      email.is_valid()
      name.length > 0
    }
  }

  behavior CreateUser {
    input {
      email: String
      name: String
    }

    output {
      success: User
      errors {
        EMAIL_EXISTS { when: "Email already registered" }
        INVALID_EMAIL { when: "Invalid email format" }
      }
    }

    preconditions {
      email.is_valid()
      not User.exists_by_email(email)
    }

    postconditions {
      success implies {
        result.id != null
        result.email == input.email
      }
    }
  }
}
```

**Generates:**
```typescript
// types.ts
export interface User {
  id: string;
  email: string;
  name: string;
}

export type CreateUserError = 'EMAIL_EXISTS' | 'INVALID_EMAIL';

// validation.ts
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
});

// verification injected at runtime
```

---

## Pricing Section

### Headline:
## Simple Pricing

### Free Tier:
**$0**
- Core CLI
- TypeScript generation
- VS Code extension
- Runtime verification
- Unlimited repos
- Community support

**Get Started →**

### Pro Tier:
**$29 lifetime**
- Everything in Free
- AI healing (auto-fix violations)
- Python/Go generators (coming soon)
- Priority support
- Early access to new features

**Upgrade to Pro →**

### Enterprise:
**Custom**
- Everything in Pro
- SSO/SAML
- Compliance packs (SOC2, ISO)
- On-premise deployment
- Dedicated support
- Custom stdlib modules

**Contact Sales →**

---

## Testimonials (Placeholders)

```
"We caught 3 production bugs before they shipped. Shipgate's trust score
actually means something — we only deploy at 90+ now."
— Sarah Chen, CTO at TechCorp

"Went from 'hope this AI code works' to 'verified and ready to ship' in
one afternoon."
— Alex Rivera, Senior Engineer

"Finally, a tool that makes AI-generated code safe for production."
— Jordan Smith, Engineering Manager
```

---

## FAQ Section

**Q: What is ISL?**
ISL (Intent Specification Language) is a declarative language for defining what your code should do — entities, behaviors, contracts, and invariants.

**Q: Does it work with existing code?**
Yes. Start by writing ISL specs for new features, gradually migrate existing code. Works incrementally.

**Q: What languages does it support?**
Currently TypeScript with Zod validators. Python and Go generators in development.

**Q: How does trust scoring work?**
Composite score based on precondition coverage, postcondition verification, invariant maintenance, type coverage, and edge case handling.

**Q: Is it open source?**
Core ISL parser and TypeScript generator are open source. Advanced verification and AI features are Pro.

**Q: Does it work with Copilot/Cursor?**
Yes. Use the MCP server to integrate Shipgate verification into your AI workflow.

---

## CTA Section (Bottom)

### Headline:
## Ready to Verify Your AI-Generated Code?

### Copy:
Join thousands of developers shipping with confidence.

### Primary CTA:
**Get Started Free**
`npm install -g shipgate`

### Secondary CTAs:
[VS Code Extension] [View Docs] [GitHub]

---

## Footer

**Product:**
- Features
- Pricing
- Changelog
- Roadmap

**Resources:**
- Documentation
- Examples
- API Reference
- Blog

**Community:**
- Discord
- GitHub
- Twitter
- Contact

**Legal:**
- Privacy
- Terms
- License

---

## Meta/SEO

**Title Tag:**
Shipgate — Verify AI-Generated Code with Intent Specifications

**Meta Description:**
Give your AI-generated code a trust score (0-100) before it ships. Write ISL specs, generate TypeScript types, verify implementations.

**Keywords:**
ai code verification, intent specification language, typescript code generation, runtime contract checking, trust score software, copilot verification, cursor verification, zod generator

**Open Graph:**
- Title: Shipgate — Verify AI-Generated Code
- Description: Write intent. Generate code. Verify correctness. Ship with confidence.
- Image: [og-image.png showing trust score 94/100]

---

## A/B Test Variants

### Variant A (Current): "Verify AI-Generated Code"
Focus: AI verification angle

### Variant B: "Intent-Driven Development"
Focus: Write what, not how

### Variant C: "Contracts That Actually Run"
Focus: Runtime verification

**Test:** Run Variant A for 2 weeks, then try B and C to see which converts better.

