# ISL Studio Playwright Demo Showcase

Interactive demo showcasing ISL Studio capabilities with Playwright-powered E2E tests for video recording.

## Features

- **Pipeline Demo**: Watch intent transform into verified code step-by-step
- **Live API Demo**: See contract verification on real API calls
- **Comparison Demo**: Regular AI vs ISL Studio side-by-side security comparison
- **Walkthrough**: Guided tour of all features with narration

## Quick Start

```bash
# Install dependencies
pnpm install

# Run the demo (starts both frontend and backend)
pnpm demo:ui

# Open http://localhost:5173
```

## Running Tests

```bash
# Run all Playwright tests
pnpm demo:test

# Run tests with UI (interactive mode)
pnpm demo:test:ui

# Record walkthrough video
pnpm demo:record
```

## Structure

```
playwright-showcase/
├── src/
│   ├── pages/           # Demo pages (Landing, Pipeline, LiveAPI, etc.)
│   ├── components/      # Reusable UI components
│   └── App.tsx          # Main app with routing
├── server/
│   └── index.ts         # Express API simulating ISL pipeline
├── tests/
│   ├── pipeline.spec.ts     # Pipeline demo tests
│   ├── live-api.spec.ts     # Live API demo tests
│   ├── comparison.spec.ts   # Comparison demo tests
│   └── walkthrough.spec.ts  # Walkthrough + video recording
└── playwright.config.ts     # Playwright configuration
```

## Video Recording

The walkthrough test is optimized for creating demo videos:

```bash
# Run specifically the walkthrough project (1920x1080 video)
npx playwright test --project=walkthrough
```

Videos are saved to `test-results/` folder.

## Tech Stack

- React + Vite
- TailwindCSS + Framer Motion
- Playwright for E2E testing
- Express backend for demo API
