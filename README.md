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
