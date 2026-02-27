# Gumroad Publish Checklist

Complete every item before clicking "Publish".

---

## Product Setup

- [ ] Title: `ShipGate CI Toolkit — Local & CI Quality Gates for AI-Written Code`
- [ ] Short description: copied from GUMROAD_COPY.md "SHORT DESCRIPTION"
- [ ] Product type: Digital download
- [ ] File: upload `shipgate-ci-toolkit-v1.0.0.zip` (the buyer ZIP)
- [ ] Preview image: Screenshot #1 (verdict screen) — 1600×900 PNG, dark background
- [ ] Demo GIF: Upload 30-second demo (see storyboard in GUMROAD_COPY.md)
- [ ] Additional screenshots: 4 more screenshots attached as gallery

## Pricing (3 variants)

- [ ] Tier A — Solo Dev: **$49** — label "Solo Dev (Personal Use)"
- [ ] Tier B — Pro Founder: **$149** — label "Pro Founder (Commercial, 1 Org)"  
- [ ] Tier C — Team: **$399** — label "Team (Up to 10 Seats, Agency Use)"
- [ ] Confirm "let buyers choose their price" is OFF
- [ ] Enable "Suggest a price" is OFF

## Add-ons (separate products, link from FAQ)

- [ ] Gate Pack: AI Hallucination — $49 (create as separate Gumroad product, link in description)
- [ ] Gate Pack: Security Baseline — $49 (create as separate Gumroad product, link in description)
- [ ] CI Pack: Multi-Provider — $29 (create as separate Gumroad product, link in description)

## Page Copy

- [ ] Paste full copy from GUMROAD_COPY.md "FULL GUMROAD PAGE COPY"
- [ ] Replace any [PLACEHOLDER] text
- [ ] Verify all code blocks render correctly in preview
- [ ] Check that pricing section matches the variants set above

## Thank-You Page

- [ ] Paste content from GUMROAD_COPY.md "THANK-YOU PAGE COPY"
- [ ] Add upgrade CTA: "Bought Solo? Email support@shipgate.dev with your order ID to upgrade."

## Delivery Email

- [ ] Subject: `Your ShipGate CI Toolkit is ready`
- [ ] Body: "Thanks for purchasing ShipGate. Your download is attached. Start with QUICKSTART.md — run the demo in under 5 minutes. Questions? support@shipgate.dev"

## SEO / Discovery

- [ ] Tags: `developer tools`, `CI/CD`, `quality gates`, `AI code`, `TypeScript`, `GitHub Actions`, `code quality`, `testing`
- [ ] Custom permalink: `shipgate-ci-toolkit`
- [ ] Enable "Discover" (Gumroad marketplace listing)

## Pre-Publish Verification

- [ ] Download the ZIP yourself and verify:
  - [ ] `shipgate --version` works after install
  - [ ] `shipgate gate examples/demo-repo/specs/user-service.isl --impl examples/demo-repo/src --threshold 90` returns SHIP with score 97%
  - [ ] JSON report matches `examples/expected-output/shipgate.report.json`
  - [ ] GitHub Actions template is valid YAML
  - [ ] All `*.sh` hooks are executable (`chmod +x`)

## Post-Publish

- [ ] Tweet/post announcement with demo GIF
- [ ] Submit to: Hacker News "Show HN", relevant subreddits (r/webdev, r/devops, r/javascript)
- [ ] Email any beta users / waitlist
- [ ] Set up Google Analytics or Gumroad analytics tracking
- [ ] Monitor support@shipgate.dev for first buyer questions
