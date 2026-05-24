# Inventory Reservation System

## Running Locally

### What you need

* Node.js 18+
* PostgreSQL DB (Supabase / Neon free tier works fine)
* Upstash Redis instance

### Setup Steps

1. Clone the repo
2. Install dependencies

```bash
npm install
```

3. Copy the env file

```bash
cp .env.example .env.local
```

Then fill in all the required values.

4. Run Prisma migrations

```bash
npx prisma migrate dev
```

5. Seed the database

```bash
npx prisma db seed
```

6. Start the dev server

```bash
npm run dev
```

---

## How Reservation Expiry Works

In production, a Vercel Cron job hits:

```txt
POST /api/cron/expire-reservations
```

once per day on Vercel Hobby.

That endpoint checks for all reservations that are still `PENDING` but already crossed their `expiresAt` time. Once found, it releases them inside a DB transaction by:

* marking the reservation as `RELEASED`
* reducing the reserved stock count

There’s also lazy cleanup in place. The product listing runs the same expiry cleanup before returning availability, so expired reservations are released when the app receives normal traffic.

For example:

* if someone opens the product list, expired pending reservations are released before stock is shown
* if someone tries to confirm an expired reservation, the API rejects it immediately
* if a user comes back to an old reservation page, pending reservations can be cleaned up there too

On Vercel Pro, the cron schedule can be changed back to every minute with `* * * * *`.

---

## Concurrency Handlingg

To avoid overselling inventory, reservation creation uses a distributed Redis lock through Upstash.

The lock is scoped per

```txt
(productId, warehouseId)
```

and uses Redis `NX` + `PX` flags, meaning only one request can hold the lock at a time for that stock bucket.

Inside that lock window:

* stock availability is checked
* reserved stock gets incremented
* reservation gets created

The lock is always released in a `finally` block so it doesn’t stay stuck if something fails midway.

On top of that, stock updates + reservation status updates run inside Prisma transactions, so inventory and reservation state stay in sync.

---

## Idempotency

Clients send an `Idempotency-Key` header (UUID per operation).

Before processing a request, the server checks Redis for:

```txt
idempotency:{key}
```

If the request was already processed earlier, the cached response is returned instead of running the operation again.

Successful responses are stored in Redis for 24 hours.

This makes retries safe in cases like:

* network failures
* frontend retry logic
* accidental duplicate submits

without creating duplicate reservations or purchases.

---

## Things I’d Improve Further

A few things I’d probably change if this moved closer to production scale:

* Use integer minor units for money instead of `Float`
  (safer once real payments get involved)

* Add DB-level constraints to prevent negative stock values

* Batch reservation expiry updates instead of processing one-by-one for larger datasets

* Add proper auth + warehouse-level permissions

* Add better observability around:

  * lock contention
  * idempotency hits
  * expired reservation volume
  * failed reservation attempts

The current implementation is reliable enough for the assignment/use-case, but these would make it much more production-ready.
