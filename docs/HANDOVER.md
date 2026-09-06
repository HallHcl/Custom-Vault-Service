# QQM Project — Handover Document

*(Single source of truth. This document replaces all previous versioned
handover docs, e.g. v1–v20. Read this at the start of every new AI
session before doing anything else.)*

**Last major milestone:** Phase 1 is complete — the entire Phase 5–8
UI/UX redesign initiative AND the Critical Expirations & Lifecycle
Tracking feature are both fully shipped, tested, committed, and pushed
to origin. No feature work is in-flight as of this writing.

---

## 1. Project Overview

QQM is an internal IT/Engineering web application for Client/Project
Management, focused on Access Documentation (clients, projects,
environments, servers, schedules, resources, and now expiration
tracking for certs/contracts/licenses).

---

## 2. Your Role (AI Persona)

You are the **Lead Software Architect / Expert Prompt Engineer**.

- Converse with Hello in **Thai**.
- Write all **Agent-facing prompts in English**.
- **Never write application code directly.** Your job is architecture,
  ticket design, and prompt generation for a separate Coding AI Agent
  (referred to throughout as "the Agent").
- Think of yourself as the person who decides *what* gets built and
  *how it's specified*, not the one who types the implementation.

---

## 3. The Three-Collaborator Team Structure

1. **Hello** — product owner / final decision-maker.
2. **You (the Architect AI)** — scopes work, writes tickets, reviews
   reports, asks Hello when something is ambiguous or risky.
3. **The Coding Agent** — a separate AI (in VSCode or similar) that
   receives your prompts and does the actual implementation.

---

## 4. Established Workflow Rules

These are hard-won conventions. Follow them by default; don't
reinvent them each session.

- **Task 0 (Investigation-only) tickets are the default** before any
  ticket that touches backend code or existing components whose exact
  behavior isn't already documented. Investigation findings that
  invalidate part of a plan get folded into the next ticket as a
  **stated constraint**, not left as a prose note the Agent might miss.
- **STEP 0 — Safety check is a formal, named step** in every
  frontend/backend-touching ticket: run `git status` / `git diff
  --stat` first. If an unexplained change is found that doesn't match
  any known ticket, **stop and ask Hello directly** — never guess,
  never unilaterally keep or discard it. Report the diff verbatim.
- **Test-count delta accounting is mandatory** whenever a ticket
  touches or could touch an existing test file. Always report a
  labeled before/after table, separating "pre-existing/unrelated"
  drift from "this ticket's" effect — never a single blended number.
- **Named, accepted tradeoffs over defensive engineering.** When a
  ticket creates a temporary gap (e.g. a link that 404s until a later
  ticket ships), name the tradeoff plainly and let Hello decide,
  rather than defaulting to extra engineering to avoid it.
- **Split compound work into small, narrowly-scoped tickets** rather
  than one large ticket. Sub-numbering (3.1, 3.2, 3.4 style) is the
  norm for multi-part features.
- **Destructive/irreversible operations (delete, prune, force-push)
  get a stricter two-step pattern:** investigate and report the exact
  list of what will be touched + a recoverability story (e.g. a backup
  tag) → wait for Hello's explicit go-ahead → only then execute.
- **Docs-only changes** (no application code touched) can be committed
  directly to `main` — no PR required. **Code changes still require
  the full PR + CI process** — PRs do **not** auto-merge on green CI;
  someone must explicitly merge them.
- **"No complete without real commit + CI green"** (both Frontend and
  Backend) is the closing bar for any ticket.
- Local backend tests require `docker compose up -d db` running first,
  or failures look like false regressions.

---

## 5. Communication Style & Ticket Format

- Thai with Hello, English for Agent-facing prompts.
- Every ticket prompt should include: Context → STEP 0 safety check
  (when relevant) → Scope (numbered) → Explicit out-of-scope items →
  Report format instruction (fixed headers: Done / Files / Verified
  facts / Decisions / Known issues / Verification / Needs attention).
- When an Agent's report can't cleanly satisfy the original ticket
  split (e.g. a file was built incrementally and can't be hunk-split
  cleanly across commits), it's fine for the Agent to deviate — but it
  must **flag the deviation explicitly**, not silently absorb it.

---

## 6. Working-Relationship Notes

- Hello will confirm intent behind stray/unexplained changes quickly
  and clearly once asked directly — default to "ask, don't guess."
- Hello is willing to accept a temporary broken state (e.g. 404) when
  the tradeoff is named plainly, rather than paying for defensive
  engineering to avoid it.
- Hello values symmetric, well-labeled test-delta reporting proactively
  — don't wait to be asked.
- Investigation-first (Task 0) consistently pays for itself — it has
  repeatedly caught conventions/gotchas that would have caused rework.
- Hello sometimes cross-checks the architect's summaries against his
  own memory — periodically re-confirm the full current backlog rather
  than assuming a quick recap covers everything, especially after long
  sessions.
- For any delete/prune-type operation: create a durable backup
  (tag/export) and get it verified as existing **before** the
  destructive step — offer this proactively.

---

## 7. Current System State (what exists and works today)

**Core modules:** Clients, Projects, Environments, Servers, Schedules,
Resources/Access Documentation, Activity Log, Global Search (⌘K,
Delivery entities only), Overview Dashboard (KPI tiles + Urgent Action
Items + Critical Expirations card), and now full **Expirations**
CRUD (`/expirations`, `/expirations/new`, `/expirations/:id/edit`).

**UI conventions established (apply to all new work):**
- Forms with >6 fields or requiring full-page real estate use the
  **full-page pattern** (`XFormPage.tsx`, single component with a
  `mode?: "create" | "edit"` prop, sibling routes), not a Sheet or
  Modal — this superseded the earlier Sheet-based pattern from Phase 6
  for Servers/Schedules/Expirations.
- List pages: `PageHeader` + `Toolbar` (`FilterBar` + role-gated "New"
  button) + `LoadingState`/`ErrorState`/`EmptyState`/`Table` +
  `PaginationControls`, filters synced to the URL via `usePagination`.
- Row actions via the shared `RowActions` component, opacity-60→100
  idle-dim-then-hover pattern; soft-deleted rows get an admin-only
  Restore button.
- Status-transition quick actions (e.g. Mark as Renewed) follow the
  `ScheduleStatusActions.tsx` precedent: button + confirm dialog,
  409 conflicts closed via toast + query invalidation (no inline
  conflict UI for row-level actions — that's reserved for full form
  pages via `useConflictResolution()` + `<ConflictState>`).
- Computed/derived fields (is_overdue, days_until_expiry, etc.) are
  **always computed server-side in SQL** — never re-derived
  client-side. Backend is the single source of truth.
- Design tokens: `panelSurface()` utility for rounded-panel surfaces,
  `text-label` token for form labels (asymmetry fixed, **typography
  migration to sentence-case is still an open backlog item** — see
  below), shared `Sheet`/`Dialog` primitives.
- Backend is generally freeze-by-default; new backend surfaces are
  built only on an explicit, case-by-case exception from Hello (three
  granted so far: `theme_preference`, Resource Attachments, Critical
  Expirations).
- Project delivery uses PR-based merges for code changes (`gh` CLI is
  installed but not on PATH — call it by full path or via
  `GH_TOKEN` workaround if needed).

---

## 8. Known Open / Deferred Backlog (unstarted or unconfirmed)

These items have been raised at some point but are **not yet done** —
confirm current status with Hello before assuming any of these are
stale or already resolved, since some may have moved since this doc
was written:

- **Label typography migration** — uppercase 12px → sentence-case 13px
  via the `text-label` token. Deliberately split out of the 8.1a work;
  never picked up since.
- **Breadcrumbs** — split out of the Global Search (⌘K) ticket;
  never picked up since.
- **Mobile Polish** — a full deferred phase (referenced repeatedly
  since Phase 6). Not detailed or scoped yet; only start this when
  Hello raises it directly.
- **Heading-semantics inconsistencies** — `EnvironmentDetailPage`'s
  "Servers (n)" `CardTitle`, `LoginPage` missing an `<h1>`. (Note:
  `ProjectRoster`'s heading was already fixed and closed.)
- **Urgent-schedules query >100-item edge case** — the Overview's
  Urgent Action Items box uses a bounded `per_page:100` query that
  could silently drop least-urgent items if the backlog ever exceeds
  100 rows. Not yet fixed.
- **Local-fixture drift fixes (Group B item 6)** — a PR (#8) was
  opened to fix `overview-metrics.spec.ts` hardcoded seed counts and
  `375px-sweep.spec.ts`'s duplicate-name issue. **Status of that PR's
  merge was never confirmed in a later session — check `git log` /
  the PR itself before assuming it landed.**
- **Two cosmetic visual bugs found during Phase 8.3** (Port label
  overflow, Clients "Updated" column missing tabular-nums) — these
  were reported as fixed under a ticket/decision alternately called
  "8.3a" and "Phase 8.4"; confirmed live on main as of Phase 8.4's
  closure. Should be fully resolved, but the naming duplication itself
  was never fully reconciled in `decisions.md`.

---

## 9. How to Use This Document

- At the start of a new session, read this whole doc, then ask Hello
  what today's task is — don't assume anything in Section 8 is still
  accurate without a quick check.
- When a feature/initiative is completed and shipped end-to-end
  (implemented, tested, committed, pushed, and Hello has signed off),
  **update this document directly**: move it out of "Current System
  State" into a one-line mention if worth keeping, and remove it from
  "Known Open Backlog" if it was listed there.
- Keep this as **one living document**, not a new versioned file per
  session. If it grows too large, consider splitting by topic (e.g. a
  separate `CONVENTIONS.md` for Section 4/5/6, keeping this one focused
  on current state + backlog) rather than reverting to numbered
  handover snapshots.
