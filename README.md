# Batch Processing System

A full-stack batch job processing system built with **Next.js**, **BullMQ**, **Redis**, and **PostgreSQL**. It accepts a count `N`, fans out `N` work items across a background job queue, processes each item asynchronously with randomised success/failure, and streams live status updates back to the browser via **Server-Sent Events (SSE)** using Redis Pub/Sub.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Architecture](#architecture)
- [Design Decisions](#design-decisions)
- [Trade-offs](#trade-offs)
- [Project Structure](#project-structure)

---

## Features

- Submit a batch job with an integer `N` → creates `N` items in the database
- Two-stage worker pipeline: **Batch Worker** → **Item Worker**
- Items processed concurrently (up to 5 at a time per worker)
- Failed items auto-retried up to **3 times** with **exponential back-off**
- Real-time progress streamed to the UI via **SSE + Redis Pub/Sub**
- Manual **per-item retry** from the UI (click any failed card)
- Optimistic UI updates — failed item flips to PENDING instantly on retry click

---

## Tech Stack

| Layer          | Technology                                  |
|----------------|---------------------------------------------|
| Framework      | Next.js 16 (App Router), TypeScript         |
| Queue          | BullMQ (backed by Redis)                    |
| Pub/Sub        | Redis (`ioredis` publisher + subscriber)    |
| Database       | PostgreSQL via Sequelize ORM                |
| Frontend       | React 19, Tailwind CSS v4                   |
| Workers        | `tsx` (long-running Node.js processes)      |

---

## Prerequisites

- **Node.js** v18+
- **npm** v9+
- **Redis** — running locally (`localhost:6379`) or a remote instance
- **PostgreSQL** — a database with the connection URL in your `.env`

---

## Setup & Installation

```bash
# 1. Clone / navigate to the project
cd myapp

# 2. Install dependencies
npm install

# 3. Copy environment variables and fill in your values
cp .env.example .env   # or edit .env directly

# 4. Create the database tables (Sequelize auto-syncs on first connection)
#    Tables created automatically on first run: batches, batch_items
```

---

## Environment Variables

Create a `.env` file in the project root with the following keys:

```env
# PostgreSQL connection string
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# Redis connection string
REDIS_URL=redis://localhost:6379
```

> **Note:** The app uses `dotenv` via the `dotenv/config` loader in workers, and Next.js automatically loads `.env` for the web process.

---

## Running the App

You need **three terminals** running simultaneously:

```bash
# Terminal 1 — Next.js dev server (API routes + frontend)
npm run dev

# Terminal 2 — Batch Worker (splits batches into items)
npm run worker

# Terminal 3 — Item Worker (processes each item)
npm run worker2
```

Then open your browser:

```
http://localhost:3000/url?count=4
```

Replace `4` with any positive integer to create a batch of that size.

---

## Architecture

```
Browser
  │
  │  POST /api/url { count: N }
  ▼
Next.js API Route (/api/url)
  │  Creates Batch record (PENDING) in PostgreSQL
  │  Enqueues job → [batch-processing] BullMQ Queue
  │  Returns { batchId }
  │
  │  GET /api/url?batchId=<id>   (SSE stream opened)
  │  Subscribes to Redis channel "item-updates"
  ▼
Browser (EventSource)
  │  Receives real-time item status events via SSE


[batch-processing] Queue
  │
  ▼
Batch Worker  (npm run worker)
  │  Sets Batch → RUNNING
  │  Creates N BatchItem rows (PENDING) in PostgreSQL
  │  Enqueues N jobs → [item-processing] BullMQ Queue
  │  Sets Batch → COMPLETED


[item-processing] Queue
  │  (attempts: 3, exponential back-off starting at 1s)
  ▼
Item Worker  (npm run worker2)
  │  Simulates work (random 1–2s delay)
  │  Randomly resolves to SUCCESS or FAILED (50/50)
  │  Updates BatchItem in PostgreSQL
  │  Publishes { batchId, itemId, itemNum, status }
  │      → Redis channel "item-updates"
  │
  ▼
SSE Subscriber in /api/url GET handler
  │  Filters events by batchId
  │  Streams matching events to the browser
  ▼
Browser — BatchTracker component updates item cards in real time
  │
  └─ On FAILED card click → POST /api/retry
       Re-sets item → PENDING, re-enqueues into [item-processing]
       Publishes PENDING event immediately for instant UI feedback
```

---

## Design Decisions

### 1. Two-stage queue (batch → item)
The POST request returns a `batchId` immediately without waiting for any item work to complete. The **Batch Worker** handles the fan-out, and the **Item Worker** handles individual processing. This keeps the API response fast and decouples batch size from HTTP timeout limits — a batch of 10,000 items is no different to a batch of 4 from the API perspective.

### 2. Server-Sent Events (SSE) over WebSockets
SSE is unidirectional (server → client), which is all that's needed for status streaming. It works over plain HTTP/2 with no extra protocol upgrade, requires no external WebSocket server, and is natively supported by the browser `EventSource` API. The trade-off is that retries require a separate POST — a small price for significantly simpler infrastructure.

### 3. Redis Pub/Sub as the SSE bridge
The Next.js SSE route and the Item Worker run in separate processes. A shared Redis channel (`item-updates`) lets the worker publish events that the web process relays to connected clients. This is lightweight and avoids the need for a message broker like Kafka or RabbitMQ for this scale.

### 4. BullMQ for queueing
BullMQ provides persistent job storage, automatic retries with back-off, concurrency control, and event hooks out of the box. The item queue is configured with **3 retry attempts** and **exponential back-off starting at 1 second**, protecting against transient failures without hammering a downstream service.

### 5. Sequelize ORM + PostgreSQL
PostgreSQL gives durable, queryable storage for batch and item state that survives worker restarts. Sequelize's `sync` makes local development frictionless (tables auto-created) while remaining compatible with migration-based workflows.

### 6. Optimistic UI updates on retry
When a user clicks a failed item, the UI immediately flips the card to PENDING before the API responds. This makes the UI feel instant. If the API call fails, the card reverts to FAILED — a simple but effective UX pattern.

---

## Trade-offs

| Area | Decision | Trade-off |
|------|----------|-----------|
| **SSE over WebSockets** | Simpler server code, no upgrade needed | No bidirectional communication; retry must be a separate HTTP call |
| **Single Redis subscriber per SSE handler** | Easy to reason about; no extra fan-out layer | Calling `subscriber.subscribe()` on every SSE connection is redundant if already subscribed; a single shared subscriber module (or a dedicated subscriber manager) would be cleaner at scale |
| **50/50 random success/failure** | Demonstrates retry and failure paths without a real external service | Not representative of real-world failure rates; retry logic is exercised artificially |
| **Sequelize `sync` (auto-create tables)** | Zero-friction local setup | Not safe for production; migrations should be used instead |
| **`tsx` for workers** | No separate build step; fast iteration | Adds `tsx` as a dev dependency and runs TypeScript interpreted at runtime; a compiled worker would be faster in production |
| **No authentication** | Keeps the demo focused on the core pipeline | Any user can submit arbitrary batch sizes; rate limiting and auth should be added before production |
| **Monorepo (all in one Next.js app)** | Simple deployment, shared type definitions | Workers and the web server are tightly coupled; at scale these would be separate services with their own deployment lifecycle |

---

## Project Structure

```
myapp/
├── app/
│   ├── api/
│   │   ├── url/route.tsx       # POST: create batch & enqueue | GET: SSE stream
│   │   └── retry/route.tsx     # POST: re-enqueue a failed item
│   ├── url/
│   │   ├── page.tsx            # /url?count=N — renders BatchTracker
│   │   └── loading.tsx         # Suspense loading state
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   └── BatchTracker.tsx        # Client component — SSE listener + item grid
├── db/
│   ├── model.ts                # Sequelize models: Batch, BatchItem
│   ├── sequelize.ts            # Sequelize instance + connectToDb()
│   └── pool.ts                 # pg Pool (used separately where needed)
├── lib/
│   ├── Queue/
│   │   ├── queue1.ts           # "batch-processing" BullMQ queue
│   │   ├── queue2.ts           # "item-processing" BullMQ queue (3 retries, exp backoff)
│   │   ├── redis.ts            # Shared ioredis connection for BullMQ
│   │   └── clearq.ts           # Utility to drain queues during dev
│   └── Workers/
│       ├── batchWorker.ts      # Consumes batch-processing queue → fans out items
│       └── jobworker.ts        # Consumes item-processing queue → processes items
├── pubsub/
│   ├── publisher.ts            # ioredis client for publishing events
│   └── subscriber.ts           # ioredis client for subscribing to events
├── config/
│   └── config.ts               # Centralised env config
├── package.json
├── tsconfig.json
└── next.config.ts
```
