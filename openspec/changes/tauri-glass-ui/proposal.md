# OpenSpec Change Proposal: tauri-glass-ui

**Rollout stage:** 7 — Desktop UI Shell

---

## Why

Every capability in `product-overlord` — adapters, eval, evidence, forge, knowledge, LLM, normaliser, output, planning, RAG, readiness, repo, server, logging, testing, types, and utils — is currently headless. Operators interact via raw HTTP calls, `npm test`, and log tailing. This creates friction for PMs, engineers, and QA who want to:

- Trigger ticket analysis without memorising curl commands
- Watch live readiness scores and pipeline traces
- Manage the knowledge base (upload docs, crawl URLs, delete stale sources)
- Browse the eval gold-set and replay results
- Inspect the evidence bundle for any run
- Approve or discard Jira comment drafts from a clean UI
- Tune server config and toggle degraded-mode flags

A **Tauri 2** desktop application with a macOS liquid-glass aesthetic (frosted panels, layered blur, accent glow, smooth spring animations) solves this for macOS, Linux, and Windows from a single codebase. Tauri is chosen over Electron for its tiny binary size (~5 MB vs ~80 MB), Rust-backed security model, and native OS integration — all without sacrificing the React/TypeScript front-end stack already used for tests.

---

## What Changes

### New top-level workspace: `ui/`

A Tauri 2 + React 18 + TypeScript + Vite app lives at `ui/` alongside `src/`. It communicates with the existing Hono server (`src/server/`) over `localhost` HTTP — no new IPC protocol needed.

### Modules exposed in the UI

| Module | UI surface |
|---|---|
| **Server / Config** | Settings panel — env var editor, degraded-mode toggles, port config, start/stop server |
| **Adapters** | Ingestion panel — trigger ingest by issue key / JQL / board; live adapter trace viewer |
| **Readiness** | Analysis panel — readiness score gauge, dimension breakdown, verdict badge, clarification questions by persona |
| **Normaliser** | Raw ticket inspector — shows canonical ticket fields and AC alias resolution |
| **Evidence** | Evidence browser — searchable run history, full bundle drill-down per run_id |
| **Output** | Draft panel — rendered Jira comment draft, approve / discard buttons |
| **Planning** | Plan viewer — action package, candidate components/files/tests, OpenSpec diff preview |
| **Repo** | Repo panel — component index browser, mapper confidence bars, Teamwork Graph enrichment status |
| **Knowledge** | KB panel — file upload dropzone, URL crawl form, sources list with delete, per-project filter |
| **LLM** | LLM panel — adapter status (live/degraded), trace log, rate-limit gauge |
| **RAG** | RAG panel — retrieved chunks viewer, context block preview, latency histogram |
| **Eval** | Eval panel — gold-set browser, run eval button, classification agreement + precision@3 metrics, diff view |
| **Forge** | Forge panel — endpoint health, payload size monitor, CSRF token status |
| **Logging** | Log console — structured JSON log stream with level filter and search |
| **Testing** | Test runner panel — run `npm test`, live output, pass/fail summary, re-run single suite |
| **Types / Utils** | Dev tools panel — TypeScript type explorer, retry/latency/histogram live stats |

### New capabilities

- `ui-shell`: Tauri window management, global hotkeys, system tray, auto-update (Tauri updater).
- `ui-theme`: macOS glass design system — CSS custom properties for blur, translucency, accent colours, dark/light adaptive, cross-platform fallback.
- `ui-api-client`: Typed fetch wrapper over the existing Hono REST API; React Query cache layer.

### Modified capabilities

- `src/server/app.ts` — add `GET /api/status` and `GET /api/config` endpoints consumed by the settings panel (read-only; no new write paths).
- `src/forge/instrumentation.ts` — expose metrics via `GET /api/metrics` SSE stream for live log console.

---

## Assumptions & Non-Goals

**Assumptions:**
- The Hono server is already running locally on a configurable port (default `3000`) when the desktop app launches.
- The app starts the server as a Tauri sidecar if not already running.
- All existing human-approval invariants (no autonomous Jira writes, CSRF gate) are enforced by the server; the UI only presents what the server returns.

**Non-Goals:**
- Mobile / web deployment — desktop only in this change.
- Replacing the existing REST API or test suite.
- New backend business logic — UI is a thin client over existing endpoints.
- SSO / multi-user auth — single-user local desktop app only.
- Offline mode (the server must be reachable on localhost).

---

## Human Approval Points

1. **Design review** — Glass theme tokens, layout wireframes, and component hierarchy reviewed before implementation begins.
2. **Security review** — Tauri `allowlist` / capability config reviewed before any sidecar or shell command permissions are granted.
3. **Pre-merge** — All existing 299 backend tests still pass; no `src/` business logic changed; UI tests pass.

---

## Rollback Strategy

The `ui/` directory is entirely additive. Removing it has zero impact on the existing server or test suite. The two new server endpoints (`/api/status`, `/api/config`, `/api/metrics`) can be feature-flagged with `UI_DEV_ENDPOINTS=true` and are read-only; removing them is non-breaking.

---

## Impact

- **New packages:** `ui/` workspace — `@tauri-apps/api`, `@tauri-apps/cli`, `react`, `react-dom`, `@tanstack/react-query`, `vite`, `framer-motion`, `zustand`, `tailwindcss`, `clsx`.
- **Existing `src/` changes:** minimal — two read-only endpoints and one SSE stream.
- **CI:** Add `ui:build` and `ui:test` scripts to GitHub Actions; Tauri build matrix for macOS, Linux, Windows.
- **Binary size:** ~5–8 MB installer per platform.
