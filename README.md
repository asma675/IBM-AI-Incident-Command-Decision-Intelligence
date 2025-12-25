# AI Incident Command — Decision Intelligence (Vite + React)

Single-page app for incident tracking, AI-style analysis, predictions, governance, and a knowledge base.

This repo is **self-contained**: it stores data locally (browser storage) so it runs without any external backend.

## Quick start

```bash
npm install
npm run dev
```

## StackBlitz

1. Create a new **Vite + React** project (or import this repo)
2. Ensure scripts exist:
   - `npm run dev` (already included)
   - `npm run start` (already included)
3. Run

```bash
npm install
npm run dev
```

## Deploy to Vercel

Vite builds to static assets.

- Build command: `npm run build`
- Output directory: `dist`

To support client-side routing (React Router), a `vercel.json` rewrite is included.

## Data storage

Data is stored in `localStorage` under:

- `icdi_local_db_v1`
- `icdi_local_meta_v1`

To reset the app, clear site data in your browser or delete those keys in DevTools.
