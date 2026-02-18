# ISL Verify Documentation Site

Complete documentation for the ISL Verify proof bundle system.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3005](http://localhost:3005)

## Build

```bash
npm run build
npm run start
```

## Structure

```
src/
├── app/              # Next.js app router pages
│   ├── page.tsx      # Homepage
│   ├── quickstart/   # Quick start guide
│   ├── specification/# Proof bundle spec
│   ├── guides/       # Integration guides
│   ├── properties/   # Property reference
│   └── api/          # API reference
├── components/       # React components
│   ├── Header.tsx
│   └── Sidebar.tsx
└── lib/             # Utilities
    └── utils.ts
```

## Content

- **Homepage** — Introduction, use cases, quick example
- **Quick Start** — 60-second guide to first proof bundle
- **Specification** — Complete JSON schema and signature scheme
- **Guides** — CI/CD, SOC 2, AI workflow, custom provers
- **Property Reference** — All available properties with filters
- **API Reference** — Programmatic usage

## Stack

- Next.js 14 (App Router)
- MDX for content
- Tailwind CSS
- shadcn/ui components
- TypeScript

## License

MIT
