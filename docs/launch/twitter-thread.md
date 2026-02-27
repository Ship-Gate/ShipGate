# Twitter/X Launch Thread

[1/10]
AI coding assistants generate code that compiles, passes ESLint, and looks perfect.

Then you deploy and discover:
- A route that doesn't exist in any spec
- An env var that was never configured
- An auth endpoint that doesn't check tokens

These aren't syntax bugs. Linters can't catch them. Tests don't know to look.

[2/10]
We built shipgate — a behavioral CI gate for AI-generated code.

It doesn't lint. It doesn't just run tests. It verifies that your implementation satisfies a behavioral contract — preconditions, postconditions, invariants.

One verdict: SHIP or NO_SHIP.

npm install -g shipgate

[3/10]
The contract is written in ISL (Intent Specification Language).

You can write it by hand:

```
behavior CreateUser {
  preconditions { input.email.isValid() }
  postconditions { result.user.status == PENDING }
  errors { DUPLICATE_EMAIL }
}
```

Or just describe what you want in English and let shipgate generate it.

[4/10]
This is the "vibe pipeline." One command:

$ shipgate vibe "build a todo API with auth"

→ Generates ISL spec (87% confidence)
→ Generates 14 files (API, DB, tests, frontend)
→ Verifies against spec
→ SHIP. Ship Score: 91/100.

Natural language in. Verified project out. 12 seconds.

[5/10]
The "Truthpack" is the secret weapon.

shipgate auto-extracts every route, env var, and auth rule from your codebase. When AI suggests new code, shipgate cross-references it against reality.

New route not in the Truthpack? Ghost route. BLOCK.
Env var not declared? Ghost env. BLOCK.

[6/10]
27 policy rules. Not vibes-based. Deterministic.

- AUTH_MISSING (critical)
- SECRET_HARDCODED (critical)
- SQL_INJECTION (critical)
- CORS_WILDCARD (high)
- MASS_ASSIGNMENT (high)
- RATE_LIMIT_MISSING (high)
- GHOST_ROUTE (high)
- GHOST_ENV (high)

Every rule has a severity, a remediation hint, and works across TS/Python/Rust/Go.

[7/10]
CI integration is one line:

```yaml
- run: npx shipgate gate specs/ --impl src/ --ci
```

Exit 0 = SHIP.
Exit 1 = NO_SHIP.

Evidence bundle uploaded as a GitHub artifact. Bot comments the verdict on your PR. No config needed beyond that.

[8/10]
It also runs as an MCP server inside Cursor.

Every AI suggestion gets intercepted in real time and checked against your Truthpack + policy rules.

Ghost route → BLOCK
Missing auth → WARN
Clean code → ALLOW

You see the verdict before the suggestion is accepted.

[9/10]
Multi-language from day one:

shipgate vibe "REST API" --lang typescript
shipgate vibe "REST API" --lang python
shipgate vibe "REST API" --lang rust
shipgate vibe "REST API" --lang go

Same ISL spec. Different target. Same verification.

ISL is language-agnostic. The implementation is what gets verified.

[10/10]
shipgate is open source. MIT license. ISL is open. The policy engine is open. Evidence bundles are an open JSON schema.

We're not building a linter. We're building the specification layer AI needs to be trustworthy.

npm install -g shipgate
https://github.com/Ship-Gate/ShipGate

Try it. Break it. Tell me what's wrong.
