# Association Management System

A web-based management platform for a single residential apartment association (built for
"Ceebros Gardens" — five blocks: **Mayflower, Tulip, Primrose, Daffodil, Orchid**). Two internal
staff logins, **Admin** and **Secretary**, manage every other record in the system — residents,
vendors, staff, and association members are data the app tracks, not accounts that log in
themselves.

The project doubles as a data-structures showcase: every module that genuinely benefits from one
is backed by a real C data structure (BST, heap, hash table, FIFO queue, growable array), compiled
and invoked as a stateless per-request compute engine. Postgres is the single source of truth;
the C programs never touch disk.

## Features

- **Resident directory** — owner/tenant records, block/floor/door number, parking, contact info
- **Association members** — committee roster with roles (President, Secretary, Treasurer, Committee Member, Resident)
- **Vendor management** — service history, cost tracking, 1–5 star ratings, and a "best value" (rating-per-rupee) recommendation
- **Staff attendance** — check-in/check-out tracking, hourly wage, computed earnings
- **Facility booking** — reserve gym/pool/clubhouse/playground slots with automatic overlap/double-booking rejection
- **Meeting records** — agenda, location, attendees, and outcomes for every committee meeting
- **Maintenance dues** — a per-resident monthly ledger; record, mark paid, view unpaid balances
- **Complaints / helpdesk** — a priority-aware queue (urgent issues jump ahead), assignable and resolvable
- **Notices** — a pinnable announcements feed
- **Profile** — real logged-in username/role, account age, last login, and self-service password change

## Architecture

```
Frontend (static HTML/CSS/JS)  →  Node/Express (server/app.js)  →  Postgres (source of truth)
                                          │
                                          └──(for DS-backed modules only)──▶  C compute engine
                                                                              (spawned via execFile,
                                                                               data piped via stdin,
                                                                               no disk I/O of its own)
```

For every DS-backed module, Node reads the module's current rows from Postgres, serializes them
to CSV, pipes that to a compiled C program's stdin via `execFile` (a real argv array — never a
shell string, which is what eliminates command injection entirely), the C program performs one
operation in memory and prints `{"result": ..., "state": [...]}` to stdout, and Node reconciles
`state` back into Postgres (upsert-by-natural-key + prune, never delete-then-reinsert, so ids and
foreign-key-dependent rows survive).

| Module | Data structure | Why |
|---|---|---|
| Residents | Block → Floor (linked lists) → Resident (BST by door number) | Genuine BST-backed CRUD/search |
| Association members | Singly linked list | — |
| Vendors | BST by id + min-heap by cost + max-heap by rating | Trades off cost vs. rating for "best value" |
| Staff | Min-heap by check-in time + max-heap by check-out time | — |
| Facility bookings | Hash table (resident lookup) + per-facility sorted timeline | O(k)-with-early-exit overlap detection |
| Meetings | Growable array (realloc) | No fixed slot cap |
| Complaints | FIFO queue (linked list); `high` priority enqueues at the head | Simplest structure for "urgent jumps the queue" |
| Notices, Maintenance dues | Plain Postgres CRUD | No natural DS-shaped operation — forcing one would be artificial |
| Auth | bcrypt + JWT in Node | Deliberately not shelled out to C |

See [CLAUDE.md](CLAUDE.md) for the full design rationale, the C stdin/stdout parsing contract, and
notes for anyone (human or AI) editing `Backend/*.c`.

## Data validation

Every field that reaches the database is validated server-side before it's ever written — not
just client-side regex that a direct API call could bypass. Rules are centralized in
[`server/lib/validators.js`](server/lib/validators.js): names (letters/spaces only), 10-digit
phone numbers, `user@domain` email shape, positive costs/wages/dues amounts, `YYYY-MM` due
periods, `MM/YY` vendor contract dates, and blocks/roles/facilities/priorities restricted to their
known sets. Vendor validation is also enforced a second time inside `Backend/vendorsds.c` itself
(defense in depth, and a restoration of validators the original CLI prototype had before this
codebase's C→stateless-engine refactor dropped them).

## Tech stack

- **Frontend:** static HTML/CSS/JavaScript (no framework, no build step)
- **Backend:** Node.js + Express (controllers, routing, auth, the Postgres↔C bridge)
- **Compute engines:** C, compiled per platform (`npm run build:c`)
- **Database:** PostgreSQL — the single source of truth (Docker Compose locally, any managed
  Postgres in production)
- **Auth:** bcrypt password hashing + JWT in an httpOnly, `sameSite=strict` cookie — no server-side
  session store
- **Tests:** Jest + Supertest

## Project structure

```
Backend/            C compute-engine sources (compiled to server/c-executables/, not checked in)
Frontend/            Static HTML/CSS/JS pages
server/
  app.js             Express app entry point
  controllers/       One per module — validate, call the DS engine or Postgres directly, respond
  routes/            Express routers, one per module
  lib/                validators.js, csvShape.js, dsEngine.js (the C-engine bridge)
  middleware/         auth.js (JWT sign/verify, cookie handling)
  db/                 pool.js, migrate.js, migrations/*.sql, reset.js, seedSynthetic.js, createUser.js
scripts/build-c.js    Compiles every Backend/*.c into server/c-executables/
tests/                Jest unit + full-stack tests
docker/Dockerfile     Multi-stage build: gcc + compile, then a slim Node runtime image
docker-compose.yml    App + local Postgres for development
```

## Getting started

### Prerequisites

- **Node.js** 18+ with npm
- **Docker** and Docker Compose (recommended path), **or** a reachable Postgres instance for the
  native path
- **gcc** — only needed for the native path; Docker's build stage installs it for you

### Option A — Docker (recommended)

```bash
cp .env.example .env   # only JWT_SECRET matters here — docker-compose sets DATABASE_URL itself
docker compose up -d --build
```

Then, one-time setup (each command run **separately** — chaining with `&&` on the host shell only
sends the first command into the container):

```bash
docker compose exec app npm run migrate
docker compose exec app npm run db:reset
docker compose exec app npm run seed
docker compose exec app npm run create-user -- --username admin --password <your-password> --role admin
```

The app is now at **http://localhost:3000**. Log in with the account you just created.

### Option B — Local/native

```bash
npm install
cp .env.example .env
```

Edit `.env`: set `DATABASE_URL` to a reachable Postgres connection string and `JWT_SECRET` to any
random value (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).

```bash
npm run build:c    # compiles Backend/*.c into server/c-executables/ — gcc must be on PATH
npm run migrate
npm run db:reset    # optional on a brand-new database, but harmless
npm run seed        # optional — populates realistic synthetic data
npm run create-user -- --username admin --password <your-password> --role admin
node server/app.js
```

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `DATABASE_SSL` | Set to `false` for a local/Docker Postgres without SSL; leave unset (or anything else) for a managed Postgres that requires SSL |
| `JWT_SECRET` | Signs the auth cookie — generate a real random value for anything beyond local dev |
| `PORT` | Defaults to `3000` |
| `NODE_ENV` | `development` locally, `production` in Docker/deployment |

## Database

Schema lives in `server/db/migrations/*.sql`, applied via `npm run migrate` (tracked in a
`schema_migrations` table — no ORM, just numbered SQL files). Single-tenant: no association/tenant
id anywhere, by design.

- `npm run db:reset` — truncates every data table (residents, vendors, staff, meetings, bookings,
  complaints, notices, dues, and the login audit log) and restarts id sequences. Leaves `users`
  untouched, since account bootstrap is a separate, explicit step.
- `npm run seed` — populates the (now-empty) database with realistic synthetic data: 33 residents
  spread across all 5 blocks, a committee roster, 9 vendors with ratings, 7 staff members with
  check-in/out history, 6 meetings, 7 facility bookings, 6 complaints across every priority, 5
  notices, and 3 months of dues for 20 residents. Every row satisfies the same validators the live
  API enforces.
- `npm run create-user -- --username <name> --password <pw> --role <admin|secretary>` — bootstraps
  a login from the command line (handy for the first account or scripted setup).

Accounts can also be created through the app itself: the **Sign in** page links to a **Create
account** page (`signup.html` → `POST /api/signup`) where anyone can register a username, password,
and role (Admin or Secretary) and is signed straight in. Signup is deliberately open — there's no
invite/approval gating — and both roles can use every feature.

## Running tests

```bash
npm test
```

`tests/*.test.js` runs two kinds of tests:
- **Pure unit tests** (`csvShape`, `resync`, `auth` middleware) — no external dependencies, always run.
- **Full-stack tests** (`api.auth`, `api.residents`) and the DS-engine integration test — gated
  behind `DATABASE_URL` being set and the relevant compiled `.exe`/binary existing (`describe.skip`
  otherwise). Run them locally with a Postgres reachable and `npm run build:c` already done:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5433/association_management \
DATABASE_SSL=false \
JWT_SECRET=any-value-for-testing \
npm test
```

CI (`.github/workflows/ci.yml`) spins up a `postgres:16` service, runs migrations, and runs the
full suite on every push.

## Deploying

This app spawns compiled C binaries via `child_process` and expects a persistent, writable-enough
process — that's incompatible with a serverless/ephemeral platform like Vercel. Deploy to any
platform that runs long-lived Docker containers instead: **Render, Railway, or Fly.io** all work
well with the existing `docker/Dockerfile` as-is.

General steps (the same on any of the three):

1. **Provision a managed Postgres** — Render and Railway both have a built-in managed Postgres
   offering; Supabase also works from any platform. Copy its connection string.
2. **Create the web service from `docker/Dockerfile`** — point the platform's "deploy from
   Dockerfile" flow at this repo; the Dockerfile's build context is the repo root
   (`docker build -f docker/Dockerfile .`), and it needs no changes to run on any of these
   platforms.
3. **Set environment variables** on the platform (never commit real values):
   - `DATABASE_URL` → the managed Postgres connection string from step 1
   - `DATABASE_SSL` → leave unset (managed Postgres providers require SSL)
   - `JWT_SECRET` → a real random value (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
   - `NODE_ENV` → `production`
4. **Run one-off release commands** after the first deploy (most platforms have a "run command"
   or "one-off job" feature — use it, don't build this into the container's start command):
   ```bash
   npm run migrate
   npm run seed              # optional — synthetic demo data
   npm run create-user -- --username admin --password <a-real-password> --role admin
   ```
5. **Confirm it actually works** — log in at the deployed URL and click through a few pages
   before considering the deploy done.

Platform-specific notes:
- **Render**: "New → Web Service", connect the repo, set the Dockerfile path to
  `docker/Dockerfile`, add a managed Postgres instance from the Render dashboard, run the release
  commands from the service's Shell tab.
- **Railway**: "New Project → Deploy from GitHub repo", add a Postgres plugin, set the Dockerfile
  path in service settings, run release commands via `railway run <command>` or the web shell.
- **Fly.io**: `fly launch` (it will detect `docker/Dockerfile`), `fly postgres create` for the
  database, `fly secrets set DATABASE_URL=... JWT_SECRET=...`, then `fly ssh console` to run the
  release commands.

## Acknowledgements

- Guided by faculty of **Sri Sivasubramaniya Nadar College of Engineering**
- Special thanks to our client from **Ceebros Gardens** for feedback during development

## License

MIT — see [LICENSE](LICENSE).
