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

## Sheet intake (how a job is created)

A job is built from its drawing set rather than a form. Each sheet is uploaded on its own and
tagged by hand with what it is, so nothing is auto-classified into the wrong bucket: power plan,
lighting/RCP, panel schedule, single-line diagram, LV/specialty, site plan.

An intake sheet is a `documents` row with `status = 'intake'` and a `sheet_type`, not a separate
table - the file lives in the `project-documents` Storage bucket, exactly as a processed
document does, so one lifecycle covers both. `sheet_type` is the estimator's label; `doc_type`
stays the classifier's opinion, and a disagreement between the two stays visible instead of
being overwritten.

The cross-reference and document tabs stay locked until the set has all three required sheets
(a power plan, a panel schedule and a single-line diagram) - the Drawing tab is deliberately
unlocked, being an independent manual tool. `POST /api/projects/:id/sheets/process` refuses to
run on an incomplete set, because cross-referencing two sheets out of three would produce
confidently wrong merges.

```bash
GET    /api/projects/:id/sheets            # the set + which required types are missing
POST   /api/projects/:id/sheets            # one sheet: multipart `file` + `sheet_type`
DELETE /api/projects/:id/sheets/:sheetId   # remove a sheet and its stored file
POST   /api/projects/:id/sheets/process    # run the pipeline over the whole set
```

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
