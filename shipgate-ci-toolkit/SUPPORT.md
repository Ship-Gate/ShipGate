# Support

## Getting Help

**Email:** support@shipgate.dev  
**Response time:** 1–2 business days (Pro/Team), 3–5 business days (Solo)

Include your ShipGate version (`shipgate --version`) and the command you ran.

---

## Updates

ShipGate uses semantic versioning. Updates are delivered as new ZIP downloads from your Gumroad library.

- **Patch updates (1.0.x):** Bug fixes — always safe to apply
- **Minor updates (1.x.0):** New gates, new presets, new CI templates — backward compatible
- **Major updates (x.0.0):** Breaking changes — review CHANGELOG before upgrading

You will receive an email when new versions are available (Gumroad auto-notifies buyers).

---

## Tier Differences

| Feature                        | Solo (A) | Pro (B) | Team (C) |
|-------------------------------|----------|---------|----------|
| Baseline preset               | ✓        | ✓       | ✓        |
| Strict + AI-heavy presets     | —        | ✓       | ✓        |
| GitHub Actions template       | ✓        | ✓       | ✓        |
| GitLab + CircleCI templates   | —        | ✓       | ✓        |
| Git hooks pack                | —        | ✓       | ✓        |
| Gate Pack add-ons             | —        | ✓       | ✓        |
| Agency/client project use     | —        | —       | ✓        |
| Priority support              | —        | —       | ✓        |
| Seats                         | 1        | 1–3     | Purchased |

---

## Common Issues

**"Required ISL packages not available"**  
Run `npm install` in your project root. ShipGate requires `@isl-lang/parser`, `@isl-lang/typechecker`, and `@isl-lang/isl-verify`.

**"Spec file not found"**  
The path passed to `shipgate gate` must point to an `.isl` file or a directory containing `.isl` files. Check your `specs/` folder.

**"Confidence X% below minimum 20%"**  
ShipGate needs at least 2 passing test scenarios to trust the score. Add more scenarios to your ISL spec.

**Gate returns FAIL but score looks fine**  
Check the `blockers` array in the JSON output. A policy violation or zero-test execution can override the score.

**CI annotation not showing on GitHub**  
The `annotateGitHub` step requires `GITHUB_TOKEN` to be available. It is automatically set in GitHub Actions — no manual setup needed.

---

## Refund Policy

No refunds after download. If you have a pre-purchase question, email support@shipgate.dev before buying.
