# ISL Frequently Asked Questions

---

## General

### What is ISL?

ISL (Intent Specification Language) is a declarative language for specifying API behavior. You write contracts—inputs, outputs, preconditions, postconditions—and ISL generates TypeScript types, test scaffolds, and a trust score measuring how well your implementation matches the spec.

### Is ISL a programming language?

No. ISL is a specification language. You don't write business logic in ISL—you describe *what* your code should do. Then you write implementations in your language of choice (TypeScript, Python, etc.) and ISL verifies they match the spec.

### Do I need AI to use ISL?

No. ISL works entirely without AI. The parser, type generator, test generator, and verifier are all deterministic tools. AI features (like natural language to ISL translation) are optional and experimental.

### What languages does ISL support?

v1.0 generates TypeScript. Python and Go codegen are planned for v1.1. The specification language itself is language-agnostic—implementations can be in any language, but type generation is TypeScript-first.

---

## Pricing

### How much does ISL cost?

| Plan | Price | What You Get |
|------|-------|--------------|
| **Free** | $0 | Full parsing, type generation, basic test generation, trust scores |
| **Pro** | $29/month | Advanced expression evaluation, property-based testing, chaos testing, detailed reports |
| **Team** | $99/month | Everything in Pro + team workspace, spec ownership, audit logs |
| **Enterprise** | Contact us | Custom needs, SLA, dedicated support |

### What's included in Free?

- Full ISL syntax parsing
- TypeScript type generation
- Basic test scaffold generation
- Trust score calculation
- 100 verification runs/month
- Community support (Discord, GitHub)

### What does Pro add?

- **Advanced expression evaluation**: More expressions compile to real tests (fewer PARTIAL results)
- **Property-based testing**: Thousands of random inputs to find edge cases
- **Chaos testing**: Fault injection (timeouts, network failures) to test resilience
- **Detailed evidence reports**: Full breakdown of every test clause
- **Full CI/CD integration**: GitHub Actions, GitLab CI, block PRs below threshold
- **10,000 verification runs/month**
- **Priority email support**

### Is there a free trial for Pro?

Yes. Contact support@intentos.dev for a 14-day trial token.

### What if I cancel Pro?

Your specs and generated code keep working. You lose advanced features:
- Expression evaluation reverts to basic (more PARTIAL results)
- No property-based or chaos testing
- Basic evidence reports only

No data loss. No lock-in.

### Is there a refund policy?

Yes. 30-day money-back guarantee, no questions asked.

### Do you offer student/OSS discounts?

Yes. Email support@intentos.dev with proof of student status or a link to your open-source project. We offer 50% off Pro for qualifying users.

---

## Pro Gating

### How do I activate Pro?

1. Sign up at [intentos.dev/pro](https://intentos.dev/pro)
2. Get your token from the dashboard
3. Set it in your environment or config:

```bash
# Environment variable
export ISL_PRO_TOKEN=isl_pro_abc123...

# Or in .islrc.json
{
  "pro": {
    "token": "isl_pro_abc123..."
  }
}
```

4. Verify with `isl status`

### How does the CLI know I'm Pro?

The CLI checks for `ISL_PRO_TOKEN` in:
1. Environment variable
2. `.islrc.json` in project root
3. `~/.islrc.json` global config

If found and valid, Pro features unlock automatically.

### Can I use Pro in CI/CD?

Yes. Add your token as a secret:

```yaml
# GitHub Actions
env:
  ISL_PRO_TOKEN: ${{ secrets.ISL_PRO_TOKEN }}
```

### What happens if my token expires?

The CLI falls back to Free tier features. Verification still runs, but without advanced expression evaluation, property-based testing, or chaos testing.

### Can I share my Pro token?

One token = one seat. Team and Enterprise plans allow multiple seats. Sharing tokens across users violates the license agreement.

---

## Privacy & Security

### Does ISL send my code anywhere?

**No.** All ISL operations run locally:
- Parsing: Local
- Type generation: Local
- Test generation: Local
- Verification: Local

Your specs and code never leave your machine.

### Does ISL phone home?

By default, ISL sends **zero telemetry**. If you opt in (see Telemetry section), anonymous usage stats are sent. Your code is never transmitted.

### Where is my Pro token validated?

Token validation is a lightweight API call to `api.intentos.dev/v1/license/validate`. The request contains:
- Your token
- CLI version
- Operation type (for rate limiting)

It does NOT contain your code, spec contents, or file paths.

### Is the API validation required?

For Pro features, yes—we need to verify your license. Free tier features work fully offline.

### Can I air-gap ISL?

Free tier: Yes, fully offline.
Pro tier: Requires periodic license validation (once per 24 hours, cached).
Enterprise: Contact us for air-gapped licensing options.

---

## Telemetry

### What telemetry does ISL collect by default?

**None.** Telemetry is opt-in only.

### What happens if I opt in?

If you run `isl config set telemetry.enabled true`, we collect:

| Data | Example | Purpose |
|------|---------|---------|
| CLI version | `1.0.0` | Track adoption |
| Command used | `verify` | Understand usage patterns |
| OS/platform | `win32` | Platform-specific bugs |
| Success/failure | `success` | Error rates |
| Duration | `1234ms` | Performance monitoring |

### What we NEVER collect (even with opt-in)

- ❌ Your code
- ❌ Your spec contents
- ❌ File names or paths
- ❌ Error messages containing your data
- ❌ Environment variables
- ❌ Git history or commit info

### How do I opt out?

```bash
isl config set telemetry.enabled false
```

Or in `.islrc.json`:

```json
{
  "telemetry": {
    "enabled": false
  }
}
```

### Where is telemetry data stored?

Anonymous telemetry goes to our analytics service (PostHog, self-hosted). Data is retained for 90 days, then deleted. We don't sell or share telemetry data.

### Is telemetry open source?

Yes. The telemetry module is in `packages/telemetry/` and you can audit exactly what's collected.

---

## Technical

### What does "Trust Score" mean?

Trust Score is a 0-100 number calculated from test results:

```
Score = (Postconditions × 0.40) + (Invariants × 0.30) 
      + (Scenarios × 0.20) + (Temporal × 0.10)
```

Each test clause is PASS (1.0), PARTIAL (0.4), or FAIL (0.0). Higher scores mean more tests passed.

**Important:** Trust Score 95 doesn't mean "95% bug-free." It means "95% of generated tests passed."

### What does "PARTIAL" mean?

PARTIAL means the test ran but couldn't fully verify the assertion. Common reasons:
- Complex expression (e.g., `old(User.count)`) couldn't compile
- Entity binding unavailable (e.g., `User.exists(id)` without DB)
- Aggregate functions not supported (e.g., `sum()`)

PARTIAL contributes 40% to trust score instead of 100%.

### Is ISL formal verification?

No. ISL is empirical testing, not formal verification. It runs tests and reports results. It does not mathematically prove properties.

We plan to add SMT solver integration in future versions, but v1.0 is testing-based.

### Does ISL catch all bugs?

No. ISL catches bugs in scenarios you specify. It tests:
- Precondition violations → should return errors
- Happy paths → should return success
- Error conditions → should return correct error codes
- Postconditions → should hold after execution

It does NOT test:
- Unspecified edge cases
- Concurrency/race conditions
- Security vulnerabilities
- Performance under load (except temporal constraints)

### Can I use ISL with existing tests?

Yes. ISL-generated tests are standard Vitest/Jest tests. They run alongside your existing tests. ISL doesn't replace manual testing—it augments it with spec-driven tests.

---

## Troubleshooting

### "Token invalid" error

1. Check token is set correctly: `isl config get pro.token`
2. Verify token hasn't expired: check your dashboard at intentos.dev
3. Check network connectivity to api.intentos.dev

### "Expression evaluator failed" warning

Some expressions can't be compiled to tests. Options:
1. Simplify the postcondition to something testable
2. Use Pro tier for advanced expression evaluation
3. Complete the TODO in generated tests manually

### Trust score lower than expected

Common causes:
1. Many PARTIAL results (complex expressions)
2. Postconditions that need entity binding
3. Temporal constraints failing due to slow tests

Run `isl verify --verbose` for detailed breakdown.

### Generated tests don't compile

1. Check TypeScript version (requires 4.7+)
2. Run `isl gen` with `--tsconfig ./tsconfig.json`
3. Ensure generated types are imported correctly

---

## Support

### How do I get help?

| Channel | Response Time | Best For |
|---------|---------------|----------|
| [GitHub Issues](https://github.com/intentos/isl/issues) | 1-3 days | Bugs, feature requests |
| [Discord](https://discord.gg/intentos) | Hours | Quick questions, community help |
| Email (support@intentos.dev) | 1-2 days (Pro: same day) | Account issues, Pro support |

### How do I report a bug?

Open a GitHub issue with:
1. ISL CLI version (`isl --version`)
2. Minimal reproducing spec (remove sensitive info)
3. Expected vs actual behavior
4. Full error output

### Can I request features?

Yes. Open a GitHub issue with the `enhancement` label. Include:
1. Use case description
2. Proposed syntax or behavior
3. Why existing features don't solve it

---

## Philosophy

### Why "intent" instead of "implementation"?

Code changes. Intent stays stable. By specifying *what* you want (create user, validate email, return error), you decouple the contract from the implementation. Change how you do it without changing what you promised.

### Why not just use TypeScript types?

TypeScript types define structure. ISL contracts define behavior:
- What inputs are valid (preconditions)
- What outputs should result (postconditions)
- What invariants must hold (always true)
- What errors can happen (exhaustive)

Types say "this is a string." Contracts say "this string must be a valid email that doesn't already exist."

### Is ISL trying to replace testing?

No. ISL generates tests from specs. It's testing, systematized. You still need:
- Integration tests (ISL generates unit tests)
- Performance tests (ISL checks temporal constraints, not load)
- Security audits (ISL doesn't pentest)
- Manual QA (ISL tests code, not UX)

ISL makes one part of testing—contract verification—automatic.

---

*More questions? Ask on [Discord](https://discord.gg/intentos) or email support@intentos.dev.*
