# PRD: UI Wiring & Interaction Layer (Phase 1 Extension)

> **Label:** `needs-triage`
> **Tracker:** https://github.com/mmarti8895/product-overlord/issues

## Problem Statement

The Autonomous AI PM desktop app has a fully-implemented Rust backend with 20+ Tauri commands covering session management, credential lifecycle, LLM invocation, ticket scaffolding, audit logging, and RBAC enforcement. The Svelte frontend, however, is entirely disconnected — all state is hardcoded in component-local `$state()` variables, the role badge shows a hardcoded "Admin", and no Tauri commands are invoked from the UI. Users interacting with the app receive no real feedback about session status, credential health, DoR evaluation results, or permission denials. The UI looks like a command deck but behaves like a static mockup.

## Solution

Wire every major UI surface to the corresponding Tauri command layer through typed Svelte stores and a disciplined data flow architecture. Introduce a global permission-error handler, replace all hardcoded state with live backend queries, and ensure every panel and interactive flow handles loading, empty, error, permission-denied, and disabled states explicitly. All integrations remain stubbed (no live Jira calls, no real LLM inference) — this phase is strictly about connecting real backend logic to a reactive frontend in a way that is deterministic, testable, and secure.

## User Stories

1. As an Operator, I want the role badge in the header to reflect my actual session role, so that I always know what permissions I currently have.
2. As an Admin, I want to see a live TTL countdown for my session, so that I can re-authenticate before my session expires mid-task.
3. As any user, I want the UI to prompt me to unlock my session when I try to perform a protected action while locked, so that I understand why my action was blocked.
4. As any user, I want permission-denied errors to surface as clear, dismissible messages rather than silent failures, so that I understand what went wrong and what to do next.
5. As an Operator, I want the Credential Health panel to display the count and per-provider status of configured credentials, so that I can verify my integrations are set up correctly.
6. As an Admin, I want to add and delete credential entries from the Credential Health panel, so that I can manage integration access without leaving the app.
7. As any user, I want the Credential Health panel to show only metadata (provider, label, status), so that I can trust that no secret values are ever exposed in the UI.
8. As an Operator, I want to select a ticket from the Ticket Queue and have the DoR checklist populate automatically, so that I can begin a review immediately.
9. As an Operator, I want each DoR checklist item to show an explicit Complete, Incomplete, or Unknown state, so that I never mistake a missing field for a passing one.
10. As an Operator, I want to update individual DoR item statuses and have those changes persisted via the backend, so that my review progress is not lost on refresh.
11. As any user, I want the Ticket Queue to display priority badges and DoR completion percentages, so that I can triage which tickets need attention first.
12. As an Operator, I want to run a stub LLM prompt from the LLM Console and receive a clearly labelled "SIMULATED" response, so that I can prototype prompts without triggering real inference.
13. As any user, I want the LLM Console to show loading and error states during stub invocation, so that I always know the current status of a prompt run.
14. As any user, I want the system to enforce suggest-only mode in Phase 1, preventing any action that would write to Jira, so that accidental mutations are structurally impossible.
15. As an Operator, I want the Index Store telemetry card to show the configured path, reachability status, and last-initialized timestamp, so that I can diagnose vector index problems at a glance.
16. As an Admin, I want the Policy Status card to reflect live RBAC enforcement state from the backend rather than a hardcoded value, so that I can trust the displayed security posture.
17. As any user, I want every panel to display a meaningful empty state when no data is available, so that I can distinguish "nothing configured" from a loading failure.
18. As any user, I want every panel to display an actionable error state when a backend command fails, so that I know what went wrong and how to recover.
19. As any user, I want interactive controls to show a disabled state when I lack the required permission, so that I am not confused by non-responsive buttons.
20. As an Admin, I want all privileged actions (credential add/delete, role changes, LLM invocation) to be recorded in the audit log even in stub mode, so that every action is traceable.
21. As any user, I want the frontend to validate all inputs using the backend validation commands (JQL, cron, base URL) before submission, so that malformed data never reaches the domain layer.
22. As a ReadOnly user, I want write actions to be visually disabled in the UI, so that I understand my access level without having to attempt a blocked action.
23. As any user, I want rendered content (ticket summaries, LLM outputs, scaffold fields) to be sanitised before display, so that injection attacks are not possible through untrusted data.
24. As an Operator, I want the DoR Evaluation Adapter to map ticket scaffold data from the backend into structured checklist items without any field being silently assumed, so that my review is always based on real data.
25. As any user, I want the UI to recover gracefully if a session expires mid-use — showing an expiry message and re-lock prompt rather than broken state.

## Implementation Decisions

- **Session Store** — A typed Svelte store encapsulating all session state (role, principal, TTL, unlocked flag). Wraps the session lifecycle commands and exposes derived values (time-to-expiry, effective permissions). All other stores and components derive permission checks from this single source of truth.

- **Permission Error Handler** — A global interceptor registered at the application shell level. Every Tauri command invocation is routed through a common helper that catches `PermissionDenied` and `SessionExpired` error variants and dispatches them to a notification queue. No individual component handles these errors in isolation.

- **Credential Panel Store** — A Svelte store backed by the credential list and mutation commands. Holds credential metadata only — no secret values are ever held in frontend state. Exposes reactive arrays of per-provider health objects.

- **Ticket Queue Provider** — A typed stub data provider implementing a well-defined interface that can be replaced by a live Jira adapter in Phase 2. Returns typed ticket summaries with priority and DoR completion percentage. The interface is the stable boundary; the stub implementation is the first concrete value.

- **DoR Evaluation Adapter** — Maps raw ticket scaffold data from the backend to a structured checklist model with explicit tri-state per item (Complete / Incomplete / Unknown). No item is assumed complete if its data field is absent or empty. Mutation actions (set item status) are dispatched through the scaffold command layer and confirmed before UI update.

- **LLM Console Module** — Wires the LLM invocation command to the prompt textarea. All responses are tagged `SIMULATED` at the adapter boundary before reaching any rendering code. Prompt text is held in ephemeral component state only — not persisted to any store or storage layer.

- **Index Store Health Panel** — A lightweight read-only store that queries the index store health command on mount and exposes path, reachability status, and last-initialized timestamp as reactive state.

- **Policy Panel Binding** — Replaces hardcoded policy values with a reactive query to the role/permission command layer, reflecting real enforcement state.

- **Global UI State Envelope** — A shared set of state shape types and Svelte component utilities covering loading, empty, error, permission-denied, success, and disabled variants. Every panel composes its local state through this envelope — no panel invents its own ad-hoc loading flag pattern.

- All Tauri command invocations flow through a single typed invocation helper that applies the global error handler, enforces suggest-only mode checks for write commands, and returns typed `Result`-shaped objects to callers.

- No direct UI-to-storage access. All reads and writes go through the Tauri command boundary.

- Input validation (JQL, cron, base URL) is performed by calling the server-side validation commands, not by reimplementing logic on the frontend.

- All rendered content is sanitised before insertion into the DOM. LLM output and ticket data are treated as untrusted.

- The suggest-only posture must be enforced structurally at the invocation helper layer, returning a `SuggestOnly` error variant for any command that would mutate Jira state.

## Testing Decisions

Good tests for this layer test the **external behavior** of each module — what state it exposes and how it responds to backend command results and errors — not internal implementation details (store internals, private methods, class structure).

**Modules and what to cover:**

- **Session Store** — Unlock/lock transitions emit correct state shapes; TTL expiry triggers re-lock; permission checks derived from store state match role-to-permission mapping.
- **Permission Error Handler** — `PermissionDenied` and `SessionExpired` errors from any command invocation produce the correct notification payload; non-error responses pass through unmodified.
- **Credential Panel Store** — Adding a credential updates the reactive list; delete removes the correct entry; no secret values appear in any emitted state shape.
- **Ticket Queue Provider** — Stub provider returns well-typed ticket summaries; selecting a ticket updates the active ticket reference; priority and DoR percentage are computed correctly.
- **DoR Evaluation Adapter** — All three item states (Complete / Incomplete / Unknown) are produced correctly from various scaffold payloads; missing fields produce Unknown (never Complete); item status mutations dispatch the correct command arguments.
- **LLM Console Module** — All responses are tagged `SIMULATED`; loading and error states during invocation; prompt text is not persisted after invocation.
- **Index Store Health Panel** — Each reachability state (Reachable / Not reachable / Not configured) is reflected correctly from backend health command output.
- **Policy Panel Binding** — Real role/permission state from the backend overwrites any hardcoded default.
- **Global UI State Envelope** — Each state variant (loading, empty, error, permission-denied, success, disabled) is a distinct, non-overlapping shape; composing multiple panels does not leak state between them.

Prior art: `tests/frontend-smoke.test.ts` provides a pattern for integration-style tests against the compiled frontend. Rust-side unit tests in the commands and domain modules show the pattern for testing command return shapes.

## Out of Scope

- Live Jira API calls or any outbound HTTP to external services
- Real LLM model inference (all invocations remain stubbed)
- Background job execution or polling daemons
- Repository indexing or embedding execution
- Slack, Teams, or email notification dispatch
- Persisting LLM prompt history
- Audit log viewer UI (deferred to a later phase)
- SEC-201 through SEC-207 security hardening items (tracked separately in `SECURITY_PHASE2_PLAN.md`)
- DoR scoring weight configuration
- Suggested acceptance criteria persistence
- Phase 2 RBAC granularity decisions

## Further Notes

- The Session Store is the single most critical module — all permission checks and UI gating downstream depend on it. Implement and test it first.
- The DoR tri-state (Complete / Incomplete / Unknown) is a domain invariant: Unknown is not equal to Incomplete, and neither equals Complete. This distinction must be preserved through every layer from backend response to rendered UI.
- The LanceDB index store is initialised lazily; the health panel must treat "not yet initialised" as a distinct state, not an error.
- All five global UI state variants (loading, empty, error, permission-denied, disabled) must be exercised for each panel in tests — the absence of error handling is a defect, not a TODO.
- Suggest-only enforcement must be structural (blocked at invocation helper, not just hidden in CSS) so that no future UI change can accidentally expose a write path.
