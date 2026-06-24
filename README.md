# MyPetStore Grooming

Spanish-first grooming operations app for a Guatemala pet store chain.

## What is included

- Next.js App Router dashboard for grooming operations.
- Seeded in-memory data for branches, users, customers, pets, services, appointments, records, and WhatsApp reminder logs.
- Prisma PostgreSQL schema for the planned production data model.
- Business-rule tests for appointment status transitions, groomer conflicts, reports, and reminder messages.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Database setup later

Copy `.env.example` to `.env`, set `DATABASE_URL`, then run:

```bash
npx prisma generate
npx prisma migrate dev
```

The current UI reads from `lib/seed-data.ts` so the first prototype can run before PostgreSQL is available.
