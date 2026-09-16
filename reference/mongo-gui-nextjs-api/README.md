# mongo-gui Next.js API reference (not built, not used)

This is the original server-side code from `mongo-gui-modern` (Next.js API routes + the
`auth-db`/`mongodb`/`jwt`/`rate-limit`/`api-guards` libs and `proxy.ts` middleware they depend on).
It talks to MongoDB and a local SQLite auth DB directly and is kept here **only as reading material**
while porting the same behavior to the Python backend in `../../backend`.

Not wired into `frontend/` and not part of any build — copy logic out of it, don't import from it.
See `../../unimplemented-endpoints.md` for the endpoint-by-endpoint porting checklist.
