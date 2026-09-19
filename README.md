# Batch Processing System

A Next.js app that lets you submit a batch of `N` jobs, process them in the background with workers, and watch the results update live in the browser.

**Stack:** Next.js 16 · TypeScript · BullMQ · Redis · PostgreSQL · Tailwind CSS

> 🔗 **Repo:** https://github.com/MohdAnas007/BatchProcessing

---

## How It Works

**1. Enter N on the home page**
The user types a number and clicks "Launch Workers". The app navigates to `/url?count=N`.

**2. A batch job is created**
The page calls `POST /api/url`, which creates a `Batch` record in the database and pushes one job onto the **batch queue**.

**3. The Batch Worker fans out**
The Batch Worker picks up the job, creates `N` individual `BatchItem` rows in the database, and pushes `N` jobs onto the **item queue**.

**4. Item Workers process each job**
Up to 5 Item Workers run concurrently. Each one waits 1–2 seconds (simulated work), then randomly marks the item as `SUCCESS` or `FAILED`. It saves the result to the database and publishes an update to a Redis channel.

**5. Results stream to the browser in real time**
The browser holds open an SSE connection (`GET /api/url?batchId=...`). The server listens on the same Redis channel and forwards matching events to the browser. Each item card updates as its result arrives.

**6. Retry a failed item**
Click any FAILED card. The app calls `POST /api/retry`, which resets the item to `PENDING` and re-queues it. The card updates immediately (optimistic UI).

---

## Architecture

```
Browser
  │
  ├─ POST /api/url  ──────────► [batch-processing queue]
  │    returns batchId                │
  │                          Batch Worker
  └─ GET  /api/url?batchId=…          │  creates N items
       (SSE stream)         ──────► [item-processing queue]
            ▲                               │
            │                      Item Workers (×5 concurrent)
            │                               │  updates DB
     Redis "item-updates"  ◄──── publishes result
     (pub/sub channel)
```

**Key pieces:**
- **`POST /api/url`** — creates the batch, enqueues the batch job, returns `batchId`
- **`GET /api/url?batchId`** — opens an SSE stream; subscribes to Redis and forwards events
- **Batch Worker** — fans one batch job out into N item jobs
- **Item Workers** — process items, write to DB, publish status via Redis
- **`POST /api/retry`** — resets a failed item to PENDING and re-queues it

---

## Setup

### Prerequisites
- Node.js v18+
- Redis (local or remote)
- PostgreSQL database

### Install

```bash
git clone https://github.com/MohdAnas007/BatchProcessing.git
cd BatchProcessing
npm install
```

### Environment variables

Create a `.env` file:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
REDIS_URL=redis://localhost:6379
```

> Tables (`batches`, `batch_items`) are created automatically on first run.

### Run

Open **three terminals**:

```bash
# Terminal 1 — web server
npm run dev

# Terminal 2 — batch worker (fan-out)
npm run worker

# Terminal 3 — item worker (processing)
npm run worker2
```

Then open **http://localhost:3000**, enter a number, and click **Launch Workers**.

---

## Project Structure

```
├── app/
│   ├── page.tsx                  # Home page (input form)
│   ├── url/page.tsx              # Tracker page (/url?count=N)
│   └── api/
│       ├── url/route.tsx         # POST: create batch | GET: SSE stream
│       └── retry/route.tsx       # POST: retry a failed item
│
├── components/
│   ├── Home.tsx                  # Input form component
│   └── BatchTracker.tsx          # Live item grid + retry logic
│
├── lib/
│   ├── Queue/queue1.ts           # batch-processing BullMQ queue
│   ├── Queue/queue2.ts           # item-processing queue (3 retries, exp backoff)
│   └── Workers/
│       ├── batchWorker.ts        # Fan-out: 1 batch → N item jobs
│       └── jobworker.ts          # Process each item + publish result
│
├── db/
│   ├── model.ts                  # Sequelize models: Batch, BatchItem
│   └── sequelize.ts              # DB connection
│
└── pubsub/
    ├── publisher.ts              # Redis publisher
    └── subscriber.ts             # Redis subscriber
```

---

## Design Decisions

**Why two queues?**
The `POST` request returns instantly regardless of batch size. The Batch Worker does the fan-out asynchronously, so a batch of 1,000 is no slower to submit than a batch of 4.

**Why SSE instead of WebSockets?**
Status updates only need to flow one way (server → browser). SSE works over plain HTTP, needs no protocol upgrade, and is natively supported by `EventSource` in every browser.

**Why Redis Pub/Sub to bridge workers and SSE?**
Workers and the web server run as separate processes. Redis is the shared message bus that lets a worker's status update reach the correct browser connection.

**Why BullMQ?**
Jobs survive process crashes (stored in Redis). Built-in retry with exponential back-off, concurrency limits, and event hooks — all with minimal setup. Items are configured with **3 retries**, **exponential backoff starting at 1s**.

---

## Trade-offs

| What | Decision | Cost |
|------|----------|------|
| SSE over WebSockets | Simpler infra | Retry must be a separate POST |
| `subscriber.subscribe()` per SSE connection | Simple to reason about | Redundant at scale; needs a singleton manager |
| Random 50/50 outcome | Exercises retry paths easily | Not realistic failure behaviour |
| Sequelize `sync` | No migration setup needed | Should use proper migrations in production |
| `tsx` to run workers | No build step | Slower than compiled JS in production |
