# Batch Processing System

A full-stack batch job processing system built with **Next.js 16**, **BullMQ**, **Redis**, and **PostgreSQL**. The user visits the home page, enters a number `N`, and the system fans out `N` jobs across background workers — processing each concurrently and streaming live status updates to the browser via **Server-Sent Events (SSE)**.

> **GitHub:** https://github.com/MohdAnas007/BatchProcessing

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [User Flow](#user-flow)
- [Architecture](#architecture)
- [Design Decisions](#design-decisions)
- [Trade-offs](#trade-offs)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Setup & Installation](#setup--installation)
- [Running the App](#running-the-app)
- [Project Structure](#project-structure)

---

## Features

- **Home page form** — enter `N`, click "Launch Workers", navigate to the live tracker
- **Two-stage worker pipeline** — Batch Worker fans out into N Item Worker jobs
- **Concurrent processing** — up to 5 jobs processed simultaneously per worker
- **Auto-retry** — failed items retried up to 3× with exponential back-off (1s base)
- **Real-time SSE** — item status updates streamed to the browser via Redis Pub/Sub
- **Manual retry** — click any FAILED card to re-queue it instantly
- **Optimistic UI** — FAILED card flips to PENDING immediately on click

---

## Tech Stack

| Layer        | Technology                                       |
|--------------|--------------------------------------------------|
| Framework    | Next.js 16 (App Router), TypeScript              |
| Job Queue    | BullMQ (Redis-backed persistent queues)          |
| Pub/Sub      | Redis via `ioredis` (publisher + subscriber)     |
| Database     | PostgreSQL via Sequelize ORM                     |
| Frontend     | React 19, Tailwind CSS v4, Lucide React icons    |
| Workers      | `tsx` — long-running Node.js TypeScript processes |

---

## User Flow

```
  ┌──────────────────────────────────────────────────────┐
  │               localhost:3000  (Home Page)             │
  │                                                      │
  │   ┌──────────────────────────────────────────────┐   │
  │   │           Initialize Batch                   │   │
  │   │                                              │   │
  │   │   Total Items (N)                            │   │
  │   │   ┌────────────────────────────────────┐    │   │
  │   │   │  e.g. 50                           │    │   │
  │   │   └────────────────────────────────────┘    │   │
  │   │                                              │   │
  │   │   ┌────────────────────────────────────┐    │   │
  │   │   │   Launch Workers  →                │    │   │
  │   │   └────────────────────────────────────┘    │   │
  │   └──────────────────────────────────────────────┘   │
  └──────────────────────────────────────────────────────┘
                           │
           User enters N, clicks "Launch Workers"
                           │
                           ▼
             Navigates to  /url?count=N
                           │
                           ▼
  ┌──────────────────────────────────────────────────────┐
  │       localhost:3000/url?count=4  (Tracker Page)     │
  │                                                      │
  │  Batch Execution Dashboard       ● Processing        │
  │  ID: 631d7a9f-7ee0-...                               │
  │  ✓ 2 Success  |  ✕ 1 Failed                          │
  │                                                      │
  │  Success Rate ─────────────────────────────  50%     │
  │  ████████████░░░░░░░░░░░░░░░░░░  Processed: 3/4      │
  │                                                      │
  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │
  │  │  #1      │ │  #2      │ │  #3      │ │  #4    │  │
  │  │ f1eb6f…  │ │ eed8f7…  │ │ c0d4bc…  │ │ 0361…  │  │
  │  │ ✓ Done   │ │ ↻ Sync   │ │ ✕ Fail   │ │ ✓ Done │  │
  │  │          │ │          │ │ [Retry]  │ │        │  │
  │  └──────────┘ └──────────┘ └──────────┘ └────────┘  │
  └──────────────────────────────────────────────────────┘
```

---

## Architecture

### Component Diagram

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │                            BROWSER                                     │
  │                                                                        │
  │   /  (Home)                        /url?count=N  (Tracker)             │
  │   ┌──────────────────┐             ┌────────────────────────────────┐  │
  │   │  Home.tsx        │             │  BatchTracker.tsx              │  │
  │   │  - Input form    │  navigate   │  - POST /api/url on mount      │  │
  │   │  - Validates N   │ ──────────► │  - Opens EventSource (SSE)     │  │
  │   │  - router.push() │             │  - Renders N item cards        │  │
  │   └──────────────────┘             │  - Click FAILED → POST /retry  │  │
  │                                    └──────────┬─────────────────────┘  │
  └───────────────────────────────────────────────┼────────────────────────┘
                                                  │ SSE stream (EventSource)
                                                  │ POST /api/url
                                                  │ POST /api/retry
                                                  ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                    NEXT.JS SERVER  (npm run dev)                       │
  │                                                                        │
  │  POST /api/url               GET /api/url?batchId=<id>                 │
  │  ┌────────────────────┐      ┌────────────────────────────────────┐    │
  │  │ 1. Validate count  │      │ 1. subscriber.subscribe(           │    │
  │  │ 2. INSERT Batch    │      │       "item-updates")              │    │
  │  │    (PENDING) → PG  │      │ 2. Open ReadableStream             │    │
  │  │ 3. queue1.add()    │      │ 3. subscriber.on("message", ...)   │    │
  │  │    → [batch-proc]  │      │    filter by batchId, enqueue      │    │
  │  │ 4. return batchId  │      │ 4. req.signal "abort" → cleanup    │    │
  │  └────────┬───────────┘      └────────────────────────────────────┘    │
  │           │                                                             │
  │  POST /api/retry                                                        │
  │  ┌────────────────────┐                                                │
  │  │ 1. UPDATE item     │                                                │
  │  │    → PENDING in PG │                                                │
  │  │ 2. queue2.add()    │                                                │
  │  │ 3. publisher       │                                                │
  │  │    .publish(PENDING│                                                │
  │  │    event)          │                                                │
  │  └────────────────────┘                                                │
  └───────────────┬────────────────────────────────────────────────────────┘
                  │ .add() jobs
                  ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                              REDIS                                     │
  │                                                                        │
  │   BullMQ Queues (persistent)        Pub/Sub Channel                    │
  │  ┌──────────────────────────┐      ┌──────────────────────────────┐    │
  │  │  [batch-processing]      │      │  "item-updates"              │    │
  │  │  [item-processing]       │      │  publisher.publish(payload)  │    │
  │  │  - stored in Redis       │      │  subscriber.on("message"…)   │    │
  │  │  - retries: 3, exp       │      │                              │    │
  │  │    backoff from 1s       │      └──────────────┬───────────────┘    │
  │  └──────────┬───────────────┘                     │ subscribe          │
  └─────────────┼───────────────────────────────────  ┼ ──────────────────┘
                │ consume                              │
                ▼                                     ▼
  ┌─────────────────────────┐          ┌──────────────────────────────┐
  │  BATCH WORKER           │          │  Next.js SSE GET handler     │
  │  npm run worker         │          │  /api/url  (GET)             │
  │                         │          │  Relays filtered events      │
  │  Concurrency: 5         │          │  to the browser's            │
  │  Queue: batch-processing│          │  EventSource stream          │
  │                         │          └──────────────────────────────┘
  │  1. Batch → RUNNING     │
  │  2. CREATE N BatchItems │
  │     in PostgreSQL       │
  │  3. queue2.add() ×N     │
  │     → [item-processing] │
  │  4. Batch → COMPLETED   │
  └────────────┬────────────┘
               │ N item jobs enqueued
               ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │  ITEM WORKER   npm run worker2                                         │
  │                                                                        │
  │  Queue: item-processing   Concurrency: 5                               │
  │  Attempts: 3  |  Backoff: exponential, 1s base                         │
  │                                                                        │
  │  For each job:                                                          │
  │   1. BatchItem.findOne({ id: itemId }) from PostgreSQL                 │
  │   2. await sleep(random 1–2s)  — simulates real work                   │
  │   3. Math.random() > 0.5 → "SUCCESS" or "FAILED"                       │
  │   4. item.update({ status }) in PostgreSQL                             │
  │   5. publisher.publish("item-updates", { batchId, itemId,              │
  │                                          itemNum, status })            │
  └────────────────────────────────────────────────────────────────────────┘
```

### Data Flow (Step-by-Step)

```
  User enters N on home page
          │
          ▼
  router.push("/url?count=N")
          │
          ▼
  BatchTracker mounts → POST /api/url { count: N }
          │
          ├─► Creates Batch row (PENDING) in PostgreSQL
          ├─► Enqueues job into [batch-processing] BullMQ queue
          └─► Returns { batchId }
                    │
                    ▼
  BatchTracker opens EventSource → GET /api/url?batchId=<id>
          │
          ▼
  Batch Worker picks up job from [batch-processing]
          │
          ├─► Sets Batch → RUNNING in PostgreSQL
          ├─► Creates N BatchItem rows (PENDING) in PostgreSQL
          ├─► Enqueues N jobs into [item-processing] queue
          └─► Sets Batch → COMPLETED in PostgreSQL
                    │
                    ▼
  Item Worker picks up each job (up to 5 concurrent)
          │
          ├─► Simulates processing (1–2s)
          ├─► Randomly → SUCCESS or FAILED
          ├─► Updates BatchItem in PostgreSQL
          └─► Publishes event to Redis "item-updates"
                    │
                    ▼
  Next.js SSE handler receives Redis message
          │
          ├─► Filters by batchId
          └─► Streams event to browser's EventSource
                    │
                    ▼
  BatchTracker receives event → updates item card in real time
          │
          └─► If FAILED: user clicks card → POST /api/retry
                    │
                    ├─► Resets item to PENDING in PostgreSQL
                    ├─► Re-enqueues into [item-processing]
                    └─► Publishes PENDING event immediately
                        (optimistic UI feedback)
```

---

## Design Decisions

### 1. Two-stage queue (batch → item)
`POST /api/url` returns a `batchId` **immediately** — no waiting for any processing. The Batch Worker handles fan-out; the Item Worker handles individual jobs. This decouples API response time from batch size. A batch of 10,000 items responds just as fast as a batch of 4.

### 2. Server-Sent Events over WebSockets
SSE is strictly server→client, which is all that's needed. It runs over plain HTTP (no upgrade handshake), requires no extra server process, and is natively supported by `EventSource` in every modern browser. Retries and other client actions go through normal `POST` requests.

### 3. Redis Pub/Sub as the SSE bridge
The Next.js web process and the workers are separate OS processes with no shared memory. A Redis channel (`item-updates`) lets any worker publish an event that any web process SSE handler can receive and relay to its connected client.

### 4. BullMQ for job queuing
BullMQ stores jobs durably in Redis — if a worker crashes, jobs are not lost. It provides built-in concurrency control, configurable retries with exponential back-off, and lifecycle event hooks, all with minimal boilerplate.

### 5. Sequelize + PostgreSQL for state
PostgreSQL gives durable, queryable state for `Batch` and `BatchItem` records that survive process restarts. Sequelize's `sync` auto-creates tables locally, eliminating manual migration setup for a demo project.

### 6. Optimistic UI updates on retry
Clicking a FAILED card immediately flips it to PENDING in React state **before** the API responds. If the API call fails, the card reverts to FAILED. This makes the UI feel instant and responsive.

---

## Trade-offs

| Area | Choice Made | Trade-off |
|------|-------------|-----------|
| **SSE vs WebSockets** | SSE — simpler, HTTP-native | No bidirectional channel; retries need a separate `POST` |
| **Subscriber per SSE connection** | `subscriber.subscribe()` called each time | Redundant subscriptions; a singleton subscriber manager would scale better |
| **50/50 random outcome** | Easy way to demonstrate retries without a real service | Artificial failure rate — not representative of production |
| **Sequelize `sync`** | Zero-setup table creation | Dangerous in production; proper migration tooling (e.g. Umzug) should replace it |
| **`tsx` for workers** | No build step required | Interpreted TypeScript at runtime; a compiled worker (`tsc` output) would be faster in production |
| **No auth / rate limiting** | Keeps the demo focused | Any client can submit arbitrarily large batches |
| **Monorepo layout** | Shared types between web + workers | Tight coupling; at scale, workers and web should be independent deployable services |

---

## Prerequisites

- **Node.js** v18+
- **npm** v9+
- **Redis** running locally on `localhost:6379` (or a remote URL)
- **PostgreSQL** database (local or remote)

---

## Environment Variables

Create a `.env` file in the project root:

```env
# PostgreSQL — Sequelize connection string
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# Redis — used by BullMQ queues and ioredis pub/sub
REDIS_URL=redis://localhost:6379
```

> Next.js automatically loads `.env` for the web server.  
> Workers load it via `dotenv/config` (injected by the `tsx` loader).

---

## Setup & Installation

```bash
# 1. Clone the repo
git clone https://github.com/MohdAnas007/BatchProcessing.git
cd BatchProcessing

# 2. Install dependencies
npm install

# 3. Configure environment
#    Edit .env with your DATABASE_URL and REDIS_URL

# 4. Tables are auto-created on first run via Sequelize sync
#    (batches, batch_items)
```

---

## Running the App

You need **three terminals** open simultaneously:

```bash
# Terminal 1 — Next.js dev server (web + API routes)
npm run dev

# Terminal 2 — Batch Worker (splits batch into N item jobs)
npm run worker

# Terminal 3 — Item Worker (processes each item)
npm run worker2
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

Enter a number (1–100), click **Launch Workers**, and watch items process live.

### Available npm scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `next dev` | Next.js development server with Turbopack |
| `build` | `next build` | Production build |
| `start` | `next start` | Production server |
| `lint` | `eslint` | Lint source files |
| `worker` | `tsx lib/Workers/batchWorker.ts` | Batch fan-out worker |
| `worker2` | `tsx lib/Workers/jobworker.ts` | Item processing worker |

---

## Project Structure

```
myapp/
│
├── app/                            # Next.js App Router
│   ├── api/
│   │   ├── url/route.tsx           # POST: create batch + enqueue
│   │   │                           # GET:  SSE stream for a batchId
│   │   └── retry/route.tsx         # POST: re-enqueue a failed item
│   ├── url/
│   │   ├── page.tsx                # /url?count=N — renders BatchTracker
│   │   └── loading.tsx             # Suspense skeleton shown while loading
│   ├── layout.tsx                  # Root layout (fonts, global styles)
│   ├── page.tsx                    # / — renders Home input form
│   └── globals.css                 # Tailwind base + global CSS
│
├── components/
│   ├── Home.tsx                    # Input form: enter N → navigate to /url
│   └── BatchTracker.tsx            # SSE listener + live item grid + retry
│
├── db/
│   ├── model.ts                    # Sequelize models: Batch, BatchItem
│   ├── sequelize.ts                # Sequelize instance, connectToDb()
│   └── pool.ts                     # Raw pg Pool (for direct queries)
│
├── lib/
│   ├── Queue/
│   │   ├── queue1.ts               # "batch-processing" BullMQ Queue
│   │   ├── queue2.ts               # "item-processing" Queue
│   │   │                           #   attempts: 3, backoff: exponential 1s
│   │   ├── redis.ts                # Shared ioredis connection for BullMQ
│   │   └── clearq.ts               # Dev utility: drain both queues
│   └── Workers/
│       ├── batchWorker.ts          # Consumes batch-processing → creates items
│       └── jobworker.ts            # Consumes item-processing → process + publish
│
├── pubsub/
│   ├── publisher.ts                # ioredis client used to publish events
│   └── subscriber.ts               # ioredis client used to subscribe to events
│
├── config/
│   └── config.ts                   # Centralised env var config (DATABASE_URL, REDIS_URL)
│
├── tailwind.config.ts              # Tailwind CSS configuration
├── next.config.ts                  # Next.js configuration
├── tsconfig.json                   # TypeScript compiler options
└── package.json                    # Scripts and dependencies
```
