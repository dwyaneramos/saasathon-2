# Hackathon Project

React (Vite) frontend + Express backend.

## Structure

```
client/   React app (Vite dev server on :5173, proxies /api to the backend)
server/   Express API (listens on :5050)
```

## Setup

```bash
npm run install:all
```

## Development

Run both frontend and backend together:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5050 (API routes under `/api`)

The Vite dev server proxies `/api/*` requests to the Express server, so the frontend can just call `fetch('/api/...')`.

## Adding an API route

Add a new router file in `server/src/routes/`, then mount it in `server/src/index.js`.

## Document pipeline (NZ electrical)

`server/src/pipeline/` ingests site plans, wiring/electrical layout plans, and legacy job
paperwork (COCs/ESCs, quotes, invoices, cable schedules), filters noise pages with a cheap
model, extracts structured electrical data with a stronger model, validates it, and writes
one JSON file per document plus a run manifest. It's a standalone batch pipeline - no UI, no
API route, no cable-sizing or pricing logic; something else in the project consumes its JSON.

```bash
cd server
cp .env.example .env   # add OPENAI_API_KEY
npm run pipeline -- --input data/input --output data/output   # defaults shown
npm run pipeline:selfcheck                                    # pure-logic assertions, no API calls
```

Real job files go in `server/data/input/` (gitignored - never commit real client files).
Output lands in `server/data/output/`, one `<doc_id>.json` per source document plus
`manifest.json`. Synthetic fixtures for trying the pipeline live in
`server/src/pipeline/fixtures/`.

Every extracted field carries `provenance` (`extracted` | `inferred` | `assumed`), a `rule`
citation when it isn't `extracted`, and a `confidence`; every extracted item carries
`doc_id`/`page`/`bbox`/`method`/`confidence` for traceability. Low-confidence or inconsistent
items are flagged in `needs_review` rather than dropped or guessed. Known limitation: PII
redaction before the API call only covers emails/phone numbers in text-derived input (regex);
names and addresses in scanned plans aren't redacted pre-upload - see the comment in
`server/src/pipeline/redact.ts`.
