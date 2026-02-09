import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import { readFileSync } from "node:fs";

// Load ISL TextMate grammar for syntax highlighting
const islGrammar = JSON.parse(
  readFileSync(new URL("./src/isl-grammar.json", import.meta.url), "utf-8"),
);

export default defineConfig({
  site: "https://docs.shipgate.dev",
  integrations: [
    starlight({
      title: "ShipGate",
      description:
        "Stop AI from shipping fake features. Powered by ISL (Intent Specification Language).",
      logo: {
        light: "./src/assets/logo-light.svg",
        dark: "./src/assets/logo-dark.svg",
        replacesTitle: false,
      },
      social: {
        github: "https://github.com/guardiavault-oss/ISL-LANG",
      },
      editLink: {
        baseUrl:
          "https://github.com/guardiavault-oss/ISL-LANG/edit/main/packages/docs/",
      },
      customCss: ["./src/styles/custom.css"],
      expressiveCode: {
        shiki: {
          langs: [islGrammar],
        },
      },
      head: [
        {
          tag: "meta",
          attrs: {
            property: "og:image",
            content: "https://docs.shipgate.dev/og.png",
          },
        },
      ],
      sidebar: [
        {
          label: "Getting Started",
          items: [
            {
              label: "Installation",
              slug: "getting-started/installation",
            },
            {
              label: "Quick Start",
              slug: "getting-started/quickstart",
            },
            {
              label: "Your First Spec",
              slug: "getting-started/your-first-spec",
            },
          ],
        },
        {
          label: "ISL Language",
          items: [
            {
              label: "Syntax Reference",
              slug: "isl-language/syntax-reference",
            },
            { label: "Types", slug: "isl-language/types" },
            { label: "Entities", slug: "isl-language/entities" },
            { label: "Behaviors", slug: "isl-language/behaviors" },
            {
              label: "Postconditions",
              slug: "isl-language/postconditions",
            },
            { label: "Scenarios", slug: "isl-language/scenarios" },
            { label: "Chaos Engineering", slug: "isl-language/chaos" },
            {
              label: "Standard Library",
              slug: "isl-language/stdlib",
            },
          ],
        },
        {
          label: "Guides",
          items: [
            {
              label: "CI/CD Integration",
              slug: "guides/ci-integration",
            },
            {
              label: "Specless Mode",
              slug: "guides/specless-mode",
            },
            {
              label: "Team Configuration",
              slug: "guides/team-config",
            },
            {
              label: "Migration Guide",
              slug: "guides/migration",
            },
            {
              label: "Best Practices",
              slug: "guides/best-practices",
            },
          ],
        },
        {
          label: "CLI Reference",
          items: [
            { label: "check", slug: "cli/check" },
            { label: "gate", slug: "cli/gate" },
            { label: "verify", slug: "cli/verify" },
            { label: "generate", slug: "cli/generate" },
            { label: "lint", slug: "cli/lint" },
            { label: "init", slug: "cli/init" },
            { label: "repl", slug: "cli/repl" },
            { label: "watch", slug: "cli/watch" },
          ],
        },
        {
          label: "API Reference",
          items: [
            { label: "Gate API", slug: "api/gate-api" },
            { label: "Dashboard API", slug: "api/dashboard-api" },
          ],
        },
        {
          label: "VS Code Extension",
          items: [
            { label: "Installation", slug: "vscode/installation" },
            { label: "Features", slug: "vscode/features" },
            { label: "Changelog", slug: "vscode/changelog" },
          ],
        },
      ],
    }),
  ],
});
