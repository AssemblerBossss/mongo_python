# Frontend (mongo_python)

Next.js UI ported from [mongo-gui-modern](https://github.com/Samuel-Community/mongo-gui). Only the
UI layer (`src/app/*` pages, `src/components/*`, client-safe `src/lib/*`) was kept — the original
project's Next.js API routes and server-side Mongo/SQLite/auth code were left out and are not part
of this app anymore. The Python backend in `../backend` is meant to replace that server layer.

`fetch("/api/...")` calls in the ported pages are proxied to the backend via `rewrites()` in
`next.config.mjs`, controlled by `BACKEND_API_ORIGIN` (see `.env.example`).

See `../unimplemented-endpoints.md` for the list of routes the UI expects that `backend/` does not
implement yet, and `../reference/mongo-gui-nextjs-api/` for the original Next.js API route
implementations kept as a porting reference.

## Development

```bash
npm install
npm run dev
```
