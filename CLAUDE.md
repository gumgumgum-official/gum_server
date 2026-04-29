# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"껌딱지월드" (Gum World) — graduation exhibition backend for 2026. Manages monitor assignment, queuing, voting, and game scores. Node.js + Express, Supabase (PostgreSQL), deployed on Railway.

## Commands

```bash
npm run dev          # development (nodemon auto-restart)
npm start            # production
npm test             # Jest unit + integration tests
npm run test:watch   # Jest watch mode
npm run test:coverage
npm run test:client  # manual scenario test (requires server running)
npm run test:api     # quick health/status test (requires server running)
```

Run a single test file:
```bash
npx jest __tests__/integration.test.js
npx jest src/managers/MonitorManager.test.js
```

## Architecture

All state is **in-memory** (no persistence between restarts). Supabase is used only for votes and game scores.

### `server.js` — `createApp(options)` factory

The entire Express app is built inside `createApp()`, which returns `{ app, monitorManager, monitorBindingManager, queueManager, voteService, scoreService }`. This factory pattern enables integration tests to get isolated instances without spinning up a real server. Passing mock services via `options` (e.g. `options.voteService`) bypasses Supabase in tests.

### Managers (in-memory)

**`MonitorManager`** — core monitor lifecycle:
- `monitors` object holds state per monitorId: `{ status, currentWorry, reservedWorry, clientId }`
- `reserve(monitorId, worryData)` — tablet/queue assigns a worry; monitor stays **idle**
- `start(monitorId)` — Stage 3 begins; `reservedWorry` → `currentWorry`, status → **busy**
- `release(monitorId)` — Stage 6 ends; `currentWorry` cleared, status → **idle** (reservedWorry untouched)
- `ensureMonitor(monitorId)` — lazily creates UUID-keyed slots (capped at `MAX_MONITOR_REGISTRY_SIZE`, default 64)
- `findAvailable()` — returns first slot that is idle AND has no reservedWorry

**`MonitorBindingManager`** — maps browser `instanceId` (UUID stored in localStorage) → `monitor-1` or `monitor-2`. Allows two browsers at the same URL to each claim a stable slot. First-come-first-served; third instanceId gets 409.

**`QueueManager`** — FIFO queue with 5-minute auto-expiry. `add()` returns 1-based position. `dequeue()` pops the front and cancels its timeout.

### Services (Supabase-backed)

**`VoteService`** — reads/writes `public.votes` table. `createVoteAndGetResults()` inserts then fetches aggregated counts for all 3 candidates in one response.

**`ScoreService`** — reads/writes `public.game_scores`. `resolveUniqueUserId()` appends a numeric suffix (`userId2`, `userId3`…) on collision. `getLeaderboard()` aggregates totals client-side after a full table fetch.

### Monitor ID format

- `monitor-1` / `monitor-2` — legacy fixed slots (pre-seeded in MonitorManager)
- Standard UUID (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) — dynamic slots, created on first `reserve` or `start`
- Anything else (e.g. `monitor-99`) — **invalid**, returns 400

`src/utils/monitorId.js` exports `isValidMonitorIdParam` and `normalizeMonitorIdParam` for validation and normalisation.

### Monitor state machine

```
idle (no reservedWorry)
  → reserve() → idle + reservedWorry
  → start() → busy + currentWorry
  → release() → idle (no currentWorry)
  → complete endpoint calls release(), then dequeue()+reserve() if queue non-empty
```

`GET /api/monitors/:id/current` returns `idle` while only `reservedWorry` is set (Stage 3 not yet started). Use `GET /status` to read `reservedWorry` directly (for the "고민 도착" toast on the monitor start screen).

## Environment Variables

```
PORT=3000
NODE_ENV=development|production
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=...
MAX_MONITOR_REGISTRY_SIZE=64   # optional, default 64
```

## Supabase Schema

```sql
-- votes
create table public.votes (
  id uuid primary key default gen_random_uuid(),
  candidate_no smallint not null check (candidate_no in (1, 2, 3)),
  session_id text null, client_id text null,
  created_at timestamptz not null default now()
);

-- game_scores
create table public.game_scores (
  id bigint generated always as identity primary key,
  user_id text not null, score integer not null check (score >= 0),
  created_at timestamptz not null default now()
);
```

## Testing notes

Integration tests inject mock services via `createApp({ voteService: mockVoteService })`. Manager-level tests instantiate classes directly. There is no database hit in tests — Supabase is not required locally.
