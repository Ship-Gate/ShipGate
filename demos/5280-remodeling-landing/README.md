# 5280 Remodeling Landing Page

Marketing landing page for 5280 Remodeling handyman service. Implements the ISL spec at `intent/5280-remodeling-landing.isl`.

## Features

- **Hero** – Headline and CTA for quote requests
- **Services** – List of handyman services (from `/api/services`)
- **Contact form** – Submit quote requests via `/api/contact`

## API

| Endpoint        | Method | Description                        |
|----------------|--------|------------------------------------|
| `/api/contact` | POST   | Submit contact/quote request      |
| `/api/services`| GET    | List handyman services offered    |

## Security (per ISL)

- **Rate limiting** – 5 requests/min per IP on contact endpoint
- **Input validation** – Zod schema for all contact fields
- **Audit logging** – All submissions logged (BR-002)
- **Sanitization** – Basic HTML stripping on form input

## Run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001).
