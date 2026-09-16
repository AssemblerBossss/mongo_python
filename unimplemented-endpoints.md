# Endpoints the ported frontend expects, not yet in `backend/`

Frontend (`frontend/`, ported from mongo-gui-modern) calls these via `fetch("/api/...")`, proxied
by `next.config.mjs` to `BACKEND_API_ORIGIN`. Original implementation for each lives in
`reference/mongo-gui-nextjs-api/src/app/api/...` (Next.js + native MongoDB driver + SQLite auth —
reference only, not runnable).

Current `backend/` (FastAPI) has no `/api` prefix and no multi-database concept — it operates on
one Mongo database from config, with routes like `/collections`, `/collections/{name}/documents`.
None of the routes below exist there yet.

## Architecture mismatch to resolve first

The ported UI is built around **switching between multiple databases** (`/databases`,
`/databases/{dbName}/...`). `backend/` currently assumes a single fixed database
(`backend/app/database.py` + config). Decide: either (a) add a `db_name` path segment throughout
`backend/`, or (b) strip the database-switcher UI down to the single configured database. Everything
below assumes the UI is kept as-is (option a).

## Auth (none of this exists in backend/ at all)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login` | body `{password}`, checks against single `admin` user, sets JWT session cookie. Rate-limited (5/min) in `mongo.conf`. |
| POST | `/api/auth/logout` | clears session cookie |
| PATCH | `/api/auth/change-password` | body `{currentPassword, newPassword}` |
| — | `proxy.ts` (Next middleware) | guards all pages/API routes, redirects to `/login` without a valid session cookie — needs an equivalent auth dependency in FastAPI |

Reference auth model (`reference/mongo-gui-nextjs-api/src/lib/auth-db.ts`): single hardcoded
`admin` user in SQLite, bcrypt hash, auto-created with a random password on first run. Decide
whether the Python backend keeps single-user auth or does something else.

## App / global info

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/app` | `{mode: "full"\|"readonly", readonly, systemDatabases}` — drives read-only UI restrictions |
| GET | `/api/stats` | home dashboard: server-wide counts (databases, collections, documents...) |
| GET | `/api/server-stats` | `/server-stats` page: mongod build info / uptime / connections / memory |

## Databases

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/databases` | list databases (name, size, collection count) |
| DELETE | `/api/databases/{dbName}` | drop a database |
| GET | `/api/databases/{dbName}/collections` | list collections in a database |
| DELETE | `/api/databases/{dbName}/collections/{collectionName}` | drop a collection |
| GET | `/api/databases/{dbName}/collections/{collectionName}/stats` | collection stats (doc count, storage size, index sizes...) |

`backend/` has close cousins for a single DB: `GET/POST /collections`, `DELETE
/collections/{name}`, `GET /collections/{name}/fields` — none support a `dbName` segment or
collection-level stats.

## Documents

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/databases/{dbName}/collections/{collectionName}/documents` | paginated/filtered list |
| POST | same | create document |
| DELETE | `.../documents/{docId}` | delete one |
| PATCH | `.../documents/{docId}` | update one |
| PATCH | `.../documents/bulk` | bulk update, body `{filter, update}` |
| DELETE | `.../documents/bulk` | bulk delete, body `{filter, confirm}` (confirm must equal collection name — a UI safety check) |

`backend/app/routers/documents.py` already implements list/create/get/put/patch/delete for a
single fixed database — logic can likely be reused, just needs the `dbName` segment and the two
bulk routes added.

## Indexes

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/databases/{dbName}/collections/{collectionName}/indexes` | list indexes |
| POST | same | create index |
| DELETE | `.../indexes/{indexName}` | drop index |

Nothing equivalent in `backend/` today.

## Validation rules

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/databases/{dbName}/collections/{collectionName}/validation` | read `$jsonSchema`/validator config |
| PATCH | same | update validator + validationLevel/Action |

Nothing equivalent in `backend/`.

## Query tools

| Method | Path | Purpose |
|---|---|---|
| POST | `.../aggregate` | run an aggregation pipeline, return results |
| POST | `.../explain` | run `.explain()` on a find/aggregate query |
| POST | `.../schema` | sample documents and infer a field/type schema (schema analyzer tab) |

Nothing equivalent in `backend/`. These need query-safety limits ported from
`reference/.../src/lib/query-parser.ts` and `api-guards.ts` (max pipeline stages, max sample size,
query timeouts — see `MONGO_QUERY_MAX_TIME_MS`, `MAX_AGGREGATION_STAGES`,
`MAX_SCHEMA_SAMPLE_SIZE` in `reference/mongo-gui-nextjs-api/env.example.reference`).

## Deprecated, skip

`GET /api/mongo/databases` — original route returns HTTP 410, superseded by `/api/databases`. Not
called by the frontend. No need to port.

## Endpoints backend/ has that the frontend doesn't use

`backend/app/routers/imports.py` (JSON scan-result import, multipart file upload) and
`/collections/{name}/filters` (typed filter metadata) are project-specific features not present in
mongo-gui-modern's UI — nothing to reconcile, just note the ported frontend has no UI for them yet
if they're meant to stay user-facing.
