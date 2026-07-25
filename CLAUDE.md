# CapabilityOS — Operating Guide for AI Coding Assistants

> This file governs every coding session on this repository.
> Read it fully before writing any code, creating any file, or proposing any architecture.
> The full Engineering Constitution lives in `docs/Engineering_Constitution_v1.md`.

---

## What this platform is

**CapabilityOS** is the operating system for organizations that build capability.

It is a **professional judgment support platform** — not an automation platform.
Its purpose is to reduce the operational complexity of developing people,
so that professionals can spend their attention on decisions that matter, not on administration.

The repo is named `workshopOS`. The platform is named **CapabilityOS**.
Use `CapabilityOS` in all new code, copy, and documentation.

**Live URL:** https://workshopos.enablemygrowth.com
**Stack:** Next.js 16 · React 19 · Supabase (auth + DB + storage) · Tailwind v4 · shadcn/ui · Zod · TypeScript
**Deployed on:** Render

---

## What this platform is NOT

Not a CRM. Not an LMS. Not a project management tool. Not a course authoring tool.
Do not propose features, schemas, or patterns that belong to those categories.

---

## The one question that governs every decision

> Does this reduce the operational complexity of developing people?

If a proposed feature, component, query, or abstraction cannot be justified by that question, reconsider it before proceeding.

---

## Architecture rules — non-negotiable

### Folder structure
```
app/              # Next.js App Router — pages and layouts only
features/         # One folder per domain feature
  └── [feature]/
        ├── components/   # UI for this feature only
        ├── actions/      # Server Actions
        ├── hooks/        # Client hooks
        └── schemas/      # Zod schemas
components/ui/    # Shared primitive UI — no business logic
lib/              # Supabase clients, utilities, infrastructure
hooks/            # Shared client hooks
infrastructure/   # Cross-cutting server infrastructure
migrations/       # Supabase SQL migrations
config/           # navigation.ts, permissions.ts, roles.ts, features.ts, constants.ts
docs/             # Engineering Constitution and supporting documents
```

### The three rules that cannot be broken

1. **Business logic never lives in components.** Components are pure UI. Logic lives in Server Actions and feature service functions.
2. **Every database entity carries `organization_id` and `workspace_id`.** No exceptions. Multi-tenancy is enforced at the DB layer via RLS, not only the application layer.
3. **Server Components by default.** Add `'use client'` only when interactivity explicitly requires it.

---

## Domain vocabulary — use these terms exactly

| Use this | Never use |
|---|---|
| Participant | Student, attendee, registrant, delegate |
| Facilitator | Trainer, presenter, teacher |
| Experience | Course, training, event (as a generic term) |
| Workshop | ✓ (specific experience type) |
| Enrollment | Registration (as a record noun) |
| Evidence | Data, analytics (when referring to outcome records) |
| Intelligence | Reports, dashboards (when referring to operational awareness features) |
| Organization | Client, company, tenant |
| Workspace | Instance, environment |

---

## Decision chain — where AI belongs

```
Data → Information → Evidence → Insight → Recommendation → Human Decision
```

AI in this platform operates at **Recommendation** only.
AI never makes decisions. Humans confirm every AI-suggested action.
No feature may take a participant-affecting action without explicit human confirmation.

---

## Current feature state

### Live and working
- Public workshop check-in form: `/r/[slug]`
- Participant self-registration with: first name, last name, email, mobile, company, job title
- Running on Render with Supabase backend

### In progress
- Feature 003: Participant Registration (scaffold in place)

### Not yet built
- Operator dashboard (`/dashboard`) — **this is the next priority**
- Authentication / protected routes
- Workshop management (create, edit, publish)
- Multi-tenancy (organization + workspace layer)
- Communications
- Certificates
- Intelligence / reporting

---

## What to build next — in order

**1. CLAUDE.md** ← you are reading it
**2. Operator dashboard** — auth-protected route showing participant data from existing workshops
**3. Multi-tenancy audit** — verify all existing migrations carry `organization_id` + `workspace_id`
**4. Workshop management** — create/edit workshops, generate `/r/[slug]` URLs
**5. Phase 1 foundation** — full org + workspace + role model

---

## Coding standards

### TypeScript
- Strict mode. No `any`. No type assertions unless unavoidable and commented.
- Zod schemas are the source of truth for all data shapes entering or leaving the system.
- Infer types from Zod schemas. Do not duplicate type definitions.

### Server Actions
- All mutations are Server Actions. No API routes for internal use.
- Every Server Action validates with Zod before touching the database.
- Every Server Action returns a typed result: `{ success: true, data } | { success: false, error: string }`.
- Never return raw Supabase errors to the client.

### Components
- Use shadcn/ui primitives from `components/ui/`.
- No inline styles. Tailwind classes only.
- No business logic in components. If you find yourself writing a database call inside a component, stop and move it to a Server Action or a server-side data-fetching function in the page.

### Database
- UUID primary keys on all tables.
- `created_at`, `updated_at`, `deleted_at` on all tables.
- `organization_id uuid NOT NULL REFERENCES organizations(id)` on all tables except `organizations`.
- `workspace_id uuid NOT NULL REFERENCES workspaces(id)` on all tables except `organizations` and `workspaces`.
- Soft deletes only via `deleted_at`. Never `DELETE` from the database.
- Migrations are additive. Never drop a column or table in a migration without explicit approval.
- Always add indexes on foreign keys and columns used in `WHERE` clauses.

### Naming
- Files: `kebab-case`
- Components: `PascalCase`
- Functions and variables: `camelCase`
- Database tables: `snake_case`, plural
- Database columns: `snake_case`
- Constants: `UPPER_SNAKE_CASE` in `config/constants.ts`
- No magic strings anywhere in the codebase

### Error handling
- All errors are caught and handled. No unhandled promise rejections.
- User-facing errors are human-readable. Never expose stack traces or Supabase error codes to the UI.
- Log errors server-side with enough context to debug without PII.

---

## Multi-tenancy — how it works

Every request flows through:
```
Request → Auth middleware → Resolve organization + workspace → RLS enforces isolation
```

- The Supabase client used in Server Actions always operates within the authenticated user's RLS context.
- Never use the service role key in application code except in trusted server-only infrastructure (e.g., migration scripts, admin operations with explicit audit logging).
- A query that can return rows from multiple workspaces is a defect, not a feature.

---

## AI principles — locked

1. AI recommends. It does not decide.
2. AI never fabricates participant data. If data is absent, say so.
3. Every AI-generated output is clearly marked as a draft or suggestion.
4. Every AI action is auditable — logged with input, output, and the user who acted on it.
5. No AI feature ships that takes a participant-affecting action without human confirmation.

---

## Intelligence Layer Rules

**Period comparison integrity:** Never compare a partial year against a full year without explicitly identifying the difference. When the current year is in progress, all year-over-year comparisons must use the equivalent elapsed period from the comparison year (e.g. Jan 1–Jul 25, 2026 vs Jan 1–Jul 25, 2024). Every comparison metric must show the period being compared. This rule applies to every intelligence query, insight, dashboard card, and trend indicator in the platform.

**Intelligence Assistant Rule:** The AI may interpret and synthesize evidence, but it must never invent operational facts. Every factual claim in an AI response must be grounded in CapabilityOS data provided in the context. The assistant must distinguish between stating a fact (grounded in data) and making an inference (reasoned from patterns). When uncertain, the assistant says so.

This rule governs the Intelligence Assistant (Layer 3 of the intelligence architecture, `features/intelligence/assistant-*`). The assistant never queries the database directly — it only reasons over a pre-built context object assembled from the deterministic Layer 1 (analytics) and Layer 2 (insights) functions in `features/intelligence/data.ts` and `features/intelligence/insights.ts`. This keeps every fact the assistant can cite traceable back to a verified query.

---

## Before writing any code — checklist

- [ ] Does this belong in a feature folder or shared infrastructure?
- [ ] Is business logic in a Server Action, not a component?
- [ ] Does every new table have `organization_id`, `workspace_id`, `created_at`, `updated_at`, `deleted_at`?
- [ ] Is input validated with Zod before hitting the database?
- [ ] Does this work correctly for any organization, not just the current one?
- [ ] Is the return type of every Server Action explicitly typed?
- [ ] Are there indexes on new foreign keys?
- [ ] Which lifecycle stage does this feature serve? (Need → Design → Promotion → Registration → Preparation → Delivery → Participation → Assessment → Reflection → Follow-up → Impact → Improvement)

---

## Definition of Done

A feature is done when:
1. All acceptance criteria are met
2. It has been validated against real or realistic data
3. A real user scenario exists where operational effort is demonstrably reduced
4. Multi-tenancy isolation has been verified
5. No critical defects exist
6. The lifecycle stage it serves is documented

---

## Key files to read before touching related areas

| Area | Read first |
|---|---|
| Any new DB table | `migrations/` — understand existing schema before adding |
| Auth or middleware | `infrastructure/` — understand session handling |
| Any new page | `app/` layout files — understand shell and auth guards |
| Permissions or roles | `config/permissions.ts`, `config/roles.ts` |
| UI components | `components/ui/` — use what exists before building new |

---

## Next.js version warning

⚠️ This project runs Next.js 16 with React 19.
APIs, conventions, and file structure differ from your training data.
Read `node_modules/next/dist/docs/` before writing routing, middleware, or rendering code.
Heed all deprecation notices.

---

*CapabilityOS Engineering Constitution v1.0 — Enable My Growth — July 2026*
*Full reference: `docs/Engineering_Constitution_v1.md`*
