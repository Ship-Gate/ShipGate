# ShipGate — Quickstart

## 1. Install

```bash
npm install -g @shipgate/cli
shipgate --version
# shipgate/1.0.0
```

## 2. Run the demo

First, install the demo's test runner dependencies (required for behavioral verification):

```bash
cd examples/demo-repo
npm install
cd ../..
```

Then run the gate:

```bash
shipgate gate examples/demo-repo/specs/user-service.isl \
  --impl examples/demo-repo/src \
  --threshold 90
```

To quickly verify the spec parses cleanly without running full verification:

```bash
shipgate check examples/demo-repo/specs/user-service.isl
# ✔ Checked 1 file — ✓ All 1 file passed
```

## 3. Gate your own project

```bash
# Initialize a config in your project root
shipgate init

# Gate against your specs
shipgate gate specs/ --impl src --threshold 90
```

## 4. Add to CI (GitHub Actions)

Copy the template and commit:

```bash
mkdir -p .github/workflows
cp ci/github-actions/shipgate.yml .github/workflows/shipgate.yml
git add .github/workflows/shipgate.yml
git commit -m "ci: add ShipGate quality gate"
```

## 5. Switch to strict preset

```bash
shipgate gate specs/ --impl src --threshold 95
```

The `strict` preset enables drift detection, chaos testing, and blocks on high-severity findings.

## 6. Install git hooks (recommended)

```bash
cp hooks/pre-commit.sh .git/hooks/pre-commit
cp hooks/pre-push.sh   .git/hooks/pre-push
chmod +x .git/hooks/pre-commit .git/hooks/pre-push
```

## 7. View JSON output

```bash
cat .shipgate/last-report.json | jq '.verdict, .score, .summary'
```

## 8. Auto-fix findings

```bash
shipgate heal specs/my-spec.isl --impl src
```

---

## Key Commands

| Command | What it does |
|---|---|
| `shipgate gate <spec> --impl <dir> --threshold 90` | Full SHIP/FAIL verdict |
| `shipgate verify <spec> --impl <dir>` | Behavioral verification only |
| `shipgate check <spec>` | Parse + type-check spec only |
| `shipgate heal <spec> --impl <dir>` | Auto-fix flagged findings |
| `shipgate drift <spec> --impl <dir>` | Spec-to-impl drift report |
| `shipgate coverage <spec>` | Behavioral coverage % |
| `shipgate trust-score <spec> --impl <dir>` | Score + confidence only |
| `shipgate lint specs/` | Lint ISL spec files |
| `shipgate fmt specs/` | Format ISL spec files |
| `shipgate compliance soc2 <spec>` | SOC2 control mapping |
