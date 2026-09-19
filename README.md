# Batch Processing System

A full-stack batch job processing system built with **Next.js**, **BullMQ**, **Redis**, and **PostgreSQL**. The user enters a number `N` on the home page, which triggers a two-stage worker pipeline that processes `N` items concurrently and streams live status updates back to the browser via **Server-Sent Events (SSE)**.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [User Flow](#user-flow)
- [Architecture](#architecture)
- [Design Decisions](#design-decisions)
- [Trade-offs](#trade-offs)
- [Prerequisites](#prerequisites)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Project Structure](#project-structure)

---

## Features

- Home page form — enter `N` to start a batch job
- Two-stage worker pipeline: **Batch Worker** → **Item Worker**
- Items processed concurrently (up to 5 at a time per worker)
- Failed items auto-retried up to **3 times** with **exponential back-off**
- Real-time progress streamed to the UI via **SSE + Redis Pub/Sub**
- Manual **per-item retry** — click any failed card to re-queue it
- Optimistic UI updates — failed card flips to PENDING instantly

---

## Tech Stack

| Layer          | Technology                                  |
|----------------|---------------------------------------------|
| Framework      | Next.js 16 (App Router), TypeScript         |
| Queue          | BullMQ (backed by Redis)                    |
| Pub/Sub        | Redis (`ioredis` publisher + subscriber)    |
| Database       | PostgreSQL via Sequelize ORM                |
| Frontend       | React 19, Tailwind CSS v4, Lucide Icons     |
| Workers        | `tsx` (long-running Node.js processes)      |

---

## User Flow

```
  ┌─────────────────────────────────────────────────────┐
  │                    localhost:3000/                   │
  │                                                     │
  │   ┌─────────────────────────────────────────────┐   │
  │   │              Process Items                   │   │
  │   │                                             │   │
  │   │   Number of items                           │   │
  │   │   ┌─────────────────────────────────────┐  │   │
  │   │   │  e.g. 25                            │  │   │
  │   │   └─────────────────────────────────────┘  │   │
  │   │                                             │   │
  │   │   ┌─────────────────────────────────────┐  │   │
  │   │   │     Start Processing  →              │  │   │
  │   │   └─────────────────────────────────────┘  │   │
  │   └─────────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────────┘
                          │
              User enters N and clicks button
                          │
                          ▼
              Navigates to /url?count=N
                          │
                          ▼
  ┌─────────────────────────────────────────────────────┐
  │              localhost:3000/url?count=4              │
  │                                                     │
  │   Batch Processing   ● Tracking Batch: abc-123      │
  │   ─────────────────────────────────────────         │
  │   Progress                            2 / 4         │
  │   ██████████████░░░░░░░░░░░░░░░░░░░░   50%          │
  │                                                     │
  │   ┌──────────────┐  ┌──────────────┐               │
  │   │ Item #1      │  │ Item #2      │               │
  │   │ uuid-f1eb…   │  │ uuid-eed8…   │               │
  │   │   ● SUCCESS  │  │  ⟳ PENDING   │               │
  │   └──────────────┘  └──────────────┘               │
  │   ┌──────────────┐  ┌──────────────┐               │
  │   │ Item #3      │  │ Item #4      │               │
  │   │ uuid-c0d4…   │  │ uuid-0361…   │               │
  │   │   ✕ FAILED   │  │   ● SUCCESS  │               │
  │   │  click retry │  │              │               │
  │   └──────────────┘  └──────────────┘               │
  └─────────────────────────────────────────────────────┘
```

---

## Architecture

### High-Level Diagram

```
  ┌──────────────────────────────────────────────────────────────────────┐
  │                         BROWSER                                      │
  │                                                                      │
  │   /  (Home Page)                   /url?count=N (Tracker Page)       │
  │   ┌────────────────┐               ┌──────────────────────────────┐  │
  │   │ Enter N        │               │ BatchTracker Component       │  │
  │   │ → navigate to  │               │  - Opens EventSource (SSE)   │  │
  │   │   /url?count=N │               │  - Renders item status cards │  │
  │   └───────┬────────┘               │  - Click FAILED → POST retry │  │
  │           │                        └──────────┬────────────────────┘  │
  └───────────┼─────────────────────────────────┬─┼────────────────────┘
              │ navigate                         │ │ SSE stream
              ▼                                 │ │ (EventSource)
  ┌───────────────────────────────────────────────────────────────────────┐
  │                     NEXT.JS SERVER (npm run dev)                      │
  │                                                                       │
  │  POST /api/url                      GET /api/url?batchId=<id>         │
  │  ┌──────────────────────┐           ┌──────────────────────────────┐  │
  │  │ 1. Validate count    │           │ 1. Subscribe Redis channel   │  │
  │  │ 2. Create Batch row  │           │    "item-updates"            │  │
  │  │    (PENDING) in PG   │           │ 2. Open ReadableStream       │  │
  │  │ 3. Enqueue batch job │           │ 3. On message: filter by     │  │
  │  │    → BullMQ          │           │    batchId, push to stream   │  │
  │  │ 4. Return { batchId }│           │ 4. On abort: cleanup & close │  │
  │  └──────────┬───────────┘           └──────────────────────────────┘  │
  │             │                                                          │
  │  POST /api/retry                                                       │
  │  ┌──────────────────────┐                                             │
  │  │ 1. Reset item PENDING│                                             │
  │  │ 2. Re-enqueue item   │                                             │
  │  │ 3. Publish PENDING   │                                             │
  │  │    event via Redis   │                                             │
  │  └──────────────────────┘                                             │
  └────────┬──────────────────────────────────────────────────────────────┘
           │ enqueue
           ▼
  ┌─────────────────────────────────────────────────────┐
  │               REDIS                                  │
  │                                                     │
  │  ┌──────────────────────┐  ┌─────────────────────┐  │
  │  │  BullMQ Queues       │  │  Pub/Sub Channel    │  │
  │  │                      │  │                     │  │
  │  │  [batch-processing]  │  │  "item-updates"     │  │
  │  │  [item-processing]   │  │  publisher.publish()│  │
  │  │  (persistent jobs,   │  │  subscriber.on()    │  │
  │  │   retries, backoff)  │  │                     │  │
  │  └──────────┬───────────┘  └──────────┬──────────┘  │
  └────────────-┼────────────────────────-┼─────────────┘
                │ consume                  │ subscribe
                ▼                          ▼
  ┌─────────────────────────┐   ┌─────────────────────────┐
  │  BATCH WORKER           │   │  NEXT.JS SSE Handler    │
  │  (npm run worker)       │   │  /api/url GET           │
  │                         │   │  (relays to browser)    │
  │  Concurrency: 5         │   └─────────────────────────┘
  │  Queue: batch-processing│
  │                         │
  │  1. Set Batch → RUNNING │
  │  2. Create N BatchItems │
  │     in PostgreSQL       │
  │  3. Enqueue N jobs into │
  │     [item-processing]   │
  │  4. Set Batch →         │
  │     COMPLETED           │
  └────────────┬────────────┘
               │ enqueue N item jobs
               ▼
  ┌─────────────────────────────────────────────────────────┐
  │  ITEM WORKER  (npm run worker2)                          │
  │                                                         │
  │  Queue: item-processing                                 │
  │  Concurrency: 5                                         │
  │  Retries: 3 attempts, exponential backoff (1s base)     │
  │                                                         │
  │  Per item:                                              │
  │  1. Fetch BatchItem from PostgreSQL                     │
  │  2. Simulate work (random 1–2s delay)                   │
  │  3. Randomly resolve SUCCESS or FAILED (50/50)          │
  │  4. Update BatchItem status in PostgreSQL               │
  │  5. Publish event to Redis "item-updates" channel       │
  │     { batchId, itemId, itemNum, status }                │
  └─────────────────────────────────────────────────────────┘
```

### Data Flow Summary

```
  User enters N
      │
      ▼
  POST /api/url ──► Creates Batch (PG) ──► Enqueues [batch-processing] job
      │
      │ returns { batchId }
      ▼
  Browser opens EventSource /api/url?batchId=<id>
      │
      ▼
  Batch Worker picks up job
      │── Creates N BatchItem rows in PostgreSQL
      └── Enqueues N jobs into [item-processing] queue
                │
                ▼  (up to 5 concurrent)
        Item Worker processes each job
                │── Updates BatchItem in PostgreSQL
                └── Publishes to Redis "item-updates"
                              │
                              ▼
                    SSE handler receives event
                              │
                              ▼
                    Browser receives update
                    → Item card updates in real time
```

---

## Design Decisions

### 1. Two-stage queue (batch → item)
`POST /api/url` returns a `batchId` immediately without waiting for any processing. The **Batch Worker** handles fan-out, and the **Item Worker** handles individual jobs. This keeps API responses fast regardless of batch size — a batch of 10,000 behaves the same as a batch of 4.

### 2. Server-Sent Events (SSE) over WebSockets
SSE is unidirectional (server → client) which is all that's needed for status streaming. It works over plain HTTP with no protocol upgrade, requires no separate WebSocket server, and is natively supported by `EventSource` in the browser.

### 3. Redis Pub/Sub as the SSE bridge
The Next.js web process and the Item Worker are separate OS processes. A Redis channel (`item-updates`) lets the worker publish events that the web process relays to connected SSE clients — no shared memory needed.

### 4. BullMQ for queueing
BullMQ provides persistent job storage in Redis, automatic retries with configurable back-off, concurrency control, and event hooks. The item queue uses **3 retry attempts** with **exponential back-off starting at 1 second**.

### 5. Sequelize ORM + PostgreSQL
PostgreSQL provides durable, queryable state for batches and items that survives worker restarts. Sequelize's `sync` makes local development frictionless (tables auto-created on first run).

### 6. Optimistic UI on retry
When a user clicks a FAILED card, the UI immediately flips it to PENDING before the API responds. If the API call fails, the card reverts — a simple UX pattern that makes the interface feel instant.

---

## Trade-offs

| Area | Decision | Trade-off |
|------|----------|-----------|
| **SSE over WebSockets** | Simpler server, no upgrade handshake | No bidirectional comms; retry needs a separate POST |
| **Shared Redis subscriber** | `subscriber.subscribe()` called on every SSE connection | Redundant at scale; a singleton subscriber manager would be cleaner |
| **50/50 random outcome** | Demonstrates retry paths without a real service | Not realistic; artificially exercises failure handling |
| **Sequelize `sync`** | Zero-friction local setup | Unsafe for production; migrations should replace this |
| **`tsx` for workers** | No build step, fast iteration | Interpreted TypeScript is slower than compiled JS in production |
| **No authentication** | Keeps demo focused on the pipeline | Any user can submit arbitrary batch sizes |
| **Monorepo** | Shared types, single deployment | Workers and web server tightly coupled; should be separate services at scale |

---

## Prerequisites

- **Node.js** v18+
- **npm** v9+
- **Redis** — local (`localhost:6379`) or a remote instance
- **PostgreSQL** — a database accessible via connection string

---

## Setup & Installation

```bash
# 1. Navigate to the project
cd myapp

# 2. Install dependencies
npm install

# 3. Configure environment variables
# Edit .env with your Redis and PostgreSQL URLs (see below)
```

---

## Environment Variables

```env
# PostgreSQL connection string
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# Redis connection string
REDIS_URL=redis://localhost:6379
```

---

## Running the App

Three terminals must run simultaneously:

```bash
# Terminal 1 — Next.js web server
npm run dev

# Terminal 2 — Batch Worker (fan-out)
npm run worker

# Terminal 3 — Item Worker (processing)
npm run worker2
```

Open **http://localhost:3000** → enter a number → click **Start Processing**.

---

## Project Structure

```
myapp/
├── app/
│   ├── api/
│   │   ├── url/route.tsx       # POST: create batch | GET: SSE stream
│   │   └── retry/route.tsx     # POST: re-enqueue a failed item
│   ├── url/
│   │   ├── page.tsx            # /url?count=N — renders BatchTracker
│   │   └── loading.tsx         # Suspense skeleton
│   ├── layout.tsx
│   ├── page.tsx                # Home — renders the input form
│   └── globals.css
├── components/
│   ├── Home.tsx                # Input form — enter N, navigate to /url
│   └── BatchTracker.tsx        # SSE listener + live item grid + retry
├── db/
│   ├── model.ts                # Sequelize models: Batch, BatchItem
│   ├── sequelize.ts            # Sequelize instance + connectToDb()
│   └── pool.ts                 # Raw pg Pool
├── lib/
│   ├── Queue/
│   │   ├── queue1.ts           # "batch-processing" BullMQ queue
│   │   ├── queue2.ts           # "item-processing" queue (3 retries, exp backoff)
│   │   ├── redis.ts            # Shared ioredis connection for BullMQ
│   │   └── clearq.ts           # Dev utility to drain queues
│   └── Workers/
│       ├── batchWorker.ts      # Consumes batch-processing → fans out items
│       └── jobworker.ts        # Consumes item-processing → processes + publishes
├── pubsub/
│   ├── publisher.ts            # ioredis client for publishing
│   └── subscriber.ts           # ioredis client for subscribing
├── config/
│   └── config.ts               # Centralised env config
├── package.json
├── tsconfig.json
└── next.config.ts
```
