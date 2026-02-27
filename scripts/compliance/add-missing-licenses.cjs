#!/usr/bin/env node
/** One-off: add "license": "MIT" to package.json files that lack it. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const list = [
  'corpus/golden/package.json',
  'demos/chaos-checkout-demo/package.json',
  'demos/e2e-login-demo/package.json',
  'demos/evaluator-demo/package.json',
  'demos/isl-demo/package.json',
  'demos/playwright-showcase/package.json',
  'demos/reality-probe-demo/package.json',
  'demos/repo-isl-verified/package.json',
  'demos/repo-specless/package.json',
  'demos/safe-ai-demo/package.json',
  'demos/spec-assist-demo/package.json',
  'demos/three-big-lies/live-sessions/01-money-transfer/package.json',
  'demos/three-big-lies/live-sessions/02-login/package.json',
  'demos/three-big-lies/live-sessions/03-registration/package.json',
  'demos/verification-demo/package.json',
  'my-app/package.json',
  'packages/ci-docker/package.json',
  'packages/codegen-harness/package.json',
  'packages/core/src/pipeline/fixtures/test-workspace/package.json',
  'packages/dashboard-api/package.json',
  'packages/isl-coverage/package.json',
  'packages/isl-semantic-analysis/package.json',
  'packages/phantom-dependency-scanner/tests/fixtures/missing-dependency/package.json',
  'packages/phantom-dependency-scanner/tests/fixtures/unresolvable-import/package.json',
  'packages/phantom-dependency-scanner/tests/fixtures/valid-project/package.json',
  'packages/phantom-dependency-scanner/tests/fixtures/workspace-project/package.json',
  'packages/phantom-dependency-scanner/tests/fixtures/workspace-project/packages/isl-core/package.json',
  'packages/runtime-adapters/examples/fastify-sample/package.json',
  'packages/stdlib-auth/examples/express-app/package.json',
  'packages/stdlib-auth/examples/fastify-app/package.json',
  'samples/isl/package.json',
  'samples/tutorials/hello-world/package.json',
  'samples/tutorials/rest-api/package.json',
  'tests/e2e/package.json',
];

let fixed = 0;
for (const p of list) {
  const f = path.join(root, p);
  if (!fs.existsSync(f)) continue;
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (j.license) continue;
  const keys = Object.keys(j);
  const ordered = {};
  for (const k of keys) {
    ordered[k] = j[k];
    if (k === 'version') ordered.license = 'MIT';
  }
  if (!ordered.license) ordered.license = 'MIT';
  fs.writeFileSync(f, JSON.stringify(ordered, null, 2) + '\n');
  fixed++;
}
console.log('Added license to', fixed, 'packages');
