# AGENTS.md

## Project scope

This repository contains a Spanish-language pet store and grooming management application.

Core stack:

- Next.js App Router
- TypeScript
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- Tailwind CSS

Supabase is the confirmed provider for authentication, PostgreSQL, and file storage. Keep deployment configuration provider-neutral unless the user explicitly requests a platform-specific implementation.

## Before changing code

1. Read the relevant repository documentation before editing.
2. Inspect `package.json`, the existing lockfile, and existing scripts.
3. Use the package manager already in use. Do not introduce a second lockfile.
4. Follow the existing folder structure and architectural conventions.
5. Treat the current database schema, RLS policies, and RPC contracts as authoritative.

Do not add a dependency, top-level directory, major abstraction, or deployment-specific configuration without asking first.

## Next.js architecture

- Use the App Router exclusively.
- Prefer Server Components.
- Add `"use client"` only when browser state, effects, or event handlers are required.
- Prefer Server Actions for mutations initiated by the application UI.
- Use Route Handlers for webhooks, external integrations, file endpoints, or APIs consumed outside the Next.js application.
- Keep server code compatible with a standard Node.js runtime. Do not assume Edge runtime support.
- Keep business and data-access logic out of page and UI components.
- Put Supabase RPC calls in dedicated server-side data-access modules.
- Keep Supabase server clients in dedicated server-only modules.
- Never import server-only modules into Client Components.

## Language and UI

- All user-facing text must be in Spanish.
- Code identifiers, filenames, comments, and technical documentation must be in English.
- User-visible validation and error messages must be in Spanish.
- Log technical details only on the server.
- Never expose secrets, SQL statements, stack traces, or internal error details to the browser.
- Preserve accessibility basics: semantic HTML, associated labels, keyboard access, and visible focus states.
- Use Tailwind CSS and reuse existing UI components before creating new components or proposing another UI library.

## Supabase access

Use Supabase RPC functions as the primary application data-access interface.

- Prefer `supabase.rpc(...)` through dedicated server-side modules.
- Direct table access is allowed under RLS, but it is secondary.
- Do not replace an existing RPC flow with direct table writes unless the task explicitly requires it.
- Use the authenticated user's Supabase session for normal application operations so `auth.uid()` and RLS remain effective.
- Reserve `service_role` for trusted server-only operations such as background jobs, Auth administration, and internal maintenance.
- Never expose `service_role` in browser code, Client Components, public environment variables, or responses.
- Keep privileged clients in server-only modules.

Validate all form, URL, and request input at the server boundary before calling Supabase. Use the repository's existing validation library. Ask before adding Zod or any other dependency.

## Database workflow

Database files include:

- `setup.sql`: destructive initialization for a fresh database only
- `rpc.sql`: RPC functions, authorization helpers, RLS policies, and grants
- `supabase_storage.sql`: Storage bucket configuration
- `README.md`: database and RPC documentation

Rules:

- Never run `setup.sql` against an existing or production database.
- Ask before running any migration or destructive command against a remote Supabase project.
- Treat `setup.sql` as the initial schema snapshot.
- Put every future database change in a new timestamped Supabase migration.
- Use the Supabase CLI migration workflow already configured in the repository.
- Do not edit an existing migration unless the user explicitly requests it.
- Do not place new schema changes in `rpc.sql` when they belong in a migration.
- Keep RPCs, RLS policies, constraints, and migrations consistent.
- Update the database `README.md` whenever tables, enums, RLS policies, permissions, or RPC signatures change.
- Regenerate Supabase TypeScript database types after schema, enum, view, or RPC changes.
- Never edit generated database types manually.

## RPC conventions

- Keep RPC names and signatures consistent with the database README.
- Use RPCs for transactional and rule-heavy operations.
- Keep authorization and integrity checks in PostgreSQL when the existing contract defines them there.
- Do not duplicate or weaken PostgreSQL validation in a way that creates conflicting behavior.
- Preserve stable SQLSTATE codes and stable database error messages.
- Translate database errors into appropriate Spanish UI messages at the server boundary.
- Keep complex flows atomic.
- Do not silently change soft-delete behavior, audit behavior, role permissions, or branch scoping.

## Storage

- Treat the `petstore` bucket as private.
- Store object paths rather than permanent public URLs when that is the existing convention.
- Generate signed URLs on the server.
- Never expose privileged Storage credentials to the browser.

## Domain rules

Preserve these defaults unless the task explicitly changes them:

- Timezone: `America/Guatemala`
- Currency: GTQ
- Telephone format: E.164
- UI language: Spanish
- Branch access, role permissions, soft deletion, audit behavior, and service workflow are enforced by the existing database contracts.

Handle dates and timestamps explicitly. Do not rely on the deployment server's local timezone.

## Environment and secrets

- Never commit secrets.
- Do not modify real environment files such as `.env.local`.
- Document new environment variables in `.env.example`.
- Do not use public-prefixed environment variables for server secrets.

## Scope and code quality

- Keep changes narrowly scoped to the requested task.
- Avoid unrelated refactors.
- Preserve existing naming, folder, and component conventions.
- Ask before making a necessary architectural deviation.
- Keep comments and documentation concise.
- Add comments only when the intent is not self-evident.
- Do not add or run tests unless the user explicitly asks.
- Do not claim a check passed unless it was actually run.

## Final response

Keep the final response minimal.

Mention only:

- what changed;
- any important blocker or risk;
- checks not run when that omission matters.

Do not provide a long recap unless requested.
