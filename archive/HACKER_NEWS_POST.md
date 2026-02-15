# Hacker News Post — Shipgate

## Title Options (Pick one):

**Primary:** Show HN: I built a verification system for AI-generated code

**Alternatives:**
- Show HN: Shipgate — Give your AI-generated code a trust score before shipping
- Show HN: Intent Specification Language — Verify AI code with contracts
- Show HN: From AI generation to verified code

---

## Full Post Body:

I've been building Shipgate for the past year — a verification system that gives AI-generated code a trust score (0-100) before it ships.

**The Problem:**

AI coding assistants (Copilot, Cursor, etc.) generate code that compiles and looks correct, but often breaks in production. Ghost features, edge cases, and subtle bugs slip through code review.

**The Solution:**

Write ISL (Intent Specification Language) specs that define what your code should do, then verify that AI-generated implementations match your intent.

```
Write ISL Spec → AI Generates Code → Shipgate Verifies → Ship with Confidence
```

**What it does:**

1. **ISL Parser** — Domain language for entities, behaviors, contracts, invariants
2. **Type Generation** — TypeScript interfaces + Zod validators from specs  
3. **Runtime Verification** — Contract checking with trust scoring
4. **Deployment Gate** — Block code with trust score < 80

**Example ISL spec:**

```isl
domain Ecommerce {
  entity User {
    id: UUID @unique
    email: String @unique
    
    invariants {
      email.is_valid()
      name.length > 0
    }
  }
  
  behavior CreateUser {
    input { email: String, name: String }
    output { success: User, errors { EMAIL_EXISTS } }
    
    preconditions {
      email.is_valid()
      not User.exists_by_email(email)
    }
    
    postconditions {
      success implies {
        result.email == input.email
        result.status == UserStatus.Created
      }
    }
  }
}
```

Generates TypeScript types + Zod validators + runtime contract checks.

**Try it:**

```bash
npm install -g shipgate
shipgate init my-app
shipgate gen ts my-app.isl
```

**What's ready:**
- ✅ ISL parser with full syntax
- ✅ TypeScript + Zod generation
- ✅ VS Code extension (published)
- ✅ Runtime verification + trust scoring
- ✅ MCP server for AI integration

**In progress:**
- 🚧 Python/Go generators
- 🚧 SMT formal verification
- 🚧 GitHub Action
- 🚧 AI healing (auto-fix violations)

**Pricing:**
- Free: Core CLI, TypeScript gen, unlimited repos
- Pro ($29/lifetime): AI healing, all generators

**Links:**
- Website: https://shipgate.dev
- Repo: https://github.com/shipgate/shipgate
- VS Code: https://marketplace.visualstudio.com/items?itemName=shipgate.shipgate-isl

**Why this matters:**

In the age of AI code generation, verification matters more than generation. TypeScript checks types. Shipgate checks behavior.

What would you verify?

---

## Discussion Points (if comments are slow):

**Potential comment to add if engagement is low:**

"Happy to answer questions about:
- The ISL language design
- How trust scoring works  
- Why we need verification for AI code
- The parser/type checker architecture
- Converting from OpenAPI/GraphQL to ISL"

---

## Follow-up Comments (as needed):

**If someone asks about competitors:**

"Good question. Existing tools:
- TypeScript: type safety only
- Zod: runtime validation only
- Pact: contract testing only
- OpenAPI: API specs only

Shipgate combines: intent specs + code generation + runtime verification + trust scoring in one platform. And it's AI-native — designed for the Copilot/Cursor era."

**If someone asks about adoption:**

"Just launched today. Looking for early adopters who want to verify AI-generated TypeScript. The ISL parser and TypeScript generator are production-ready. Python/Go generators coming next month."

**If someone reports a bug:**

"Thanks for trying it! File an issue at https://github.com/shipgate/shipgate/issues and I'll fix it ASAP."

---

## Timing Strategy:

**Best time to post:** Tuesday-Thursday, 8-10 AM PST

**Why:** HN's peak traffic is morning US time. Tuesday-Thursday avoids weekend lulls and Monday catch-up.

**Backup plan:** If it doesn't hit front page in 2 hours, post at 6 PM PST (when west coast devs check HN after work).

---

## Posting Checklist:

- [ ] Post between 8-10 AM PST on Tuesday-Thursday
- [ ] Monitor first 30 minutes — respond to all comments quickly
- [ ] Have demo video ready to link if people ask
- [ ] Post on Twitter/X immediately after with same hook
- [ ] Cross-post to r/typescript, r/webdev if HN goes well

---

## Expected Questions & Answers:

**Q: How is this different from TLA+ or other formal methods?**
A: TLA+ proves correctness but doesn't generate code. Shipgate generates implementations AND verifies them. It's designed for working developers, not researchers.

**Q: Does it work with existing codebases?**
A: Yes — you can incrementally add ISL specs to existing projects. Start with one entity/behavior, generate types, migrate existing code gradually.

**Q: What about other languages besides TypeScript?**
A: Python generator is in progress. Go and Rust are on the roadmap. The ISL spec is language-agnostic.

**Q: Is this open source?**
A: The core ISL parser and TypeScript generator are open source. Advanced verification and AI features are Pro.

**Q: How does trust scoring work?**
A: Composite score based on: precondition coverage, postcondition verification, invariant maintenance, type coverage, and edge case handling. Not just pass/fail — shows exactly what's verified vs missing.

**Q: Can I use this without AI-generated code?**
A: Absolutely. Write ISL specs by hand, generate types, implement against contracts. The AI angle is just the killer use case right now.

---

## Metrics to Track:

After posting, monitor:
- Upvotes in first hour (target: 50+)
- Position on front page (target: top 20)
- GitHub stars in first 24h (target: 100+)
- npm installs in first 24h (target: 200+)
- VS Code extension installs (target: 50+)

---

## Post-Launch Actions:

If successful (100+ upvotes, front page):
1. Email collected feedback to team
2. Update README with testimonials/quotes
3. Create "Shipgate on HN" blog post
4. Reach out to interested commenters directly
5. Prepare Product Hunt launch for next week

