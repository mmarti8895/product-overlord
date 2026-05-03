# product-overlord — Desktop UI

Tauri 2 + React 18 + TypeScript desktop application providing a native GUI for the `product-overlord` agent orchestration backend.

---

## Quick Start

```bash
# From the repo root
cd ui
npm install
npm run tauri dev      # hot-reload dev build
npm run tauri build    # production app bundle
npm test               # vitest unit tests (jsdom)
```

---

## Panels

| Panel | Sidebar Route | Description |
|---|---|---|
| **ConnectionsPanel** | Connections → Jira / OpenAI / GitHub | Save and test provider credentials. Uses Tauri Stronghold for secret storage (falls back to an encrypted file). |
| **DecisionReviewPanel** | Decisions | Approve, reject, or patch pending agent decisions. Shows a ring-buffered queue with JSON diff view. |
| **WorkflowPanel** | Workflows | Configure and run the `crawl → normalise → embed → LanceDB` pipeline. Includes plan-mode dry-run, cost estimation, run history, and cron scheduling. |
| **AgentActivityPanel** | Agents | Live SSE feed of agent and sub-agent events. Launch the **AgentBuilderModal** (4-step wizard) to create a new custom agent. |
| **OrchestratorFindingsPanel** | Orchestrators | View findings from the OrchestratorTeam watchdog (thrash / stall / runaway detections). Acknowledge or escalate each finding. |

---

## Stores (`src/stores/`)

All stores use [Zustand](https://github.com/pmndrs/zustand).

| Store | File | State held |
|---|---|---|
| `connectionsStore` | `connectionsStore.ts` | Per-provider config form state and live test results |
| `decisionsStore` | `decisionsStore.ts` | Decision ring buffer, active filter, selected decision |
| `workflowStore` | `workflowStore.ts` | Selected pipeline stages, plan result, run history, saved schedules |
| `agentActivityStore` | `agentActivityStore.ts` | Active run IDs, SSE event log, per-agent status |
| `orchestratorStore` | `orchestratorStore.ts` | OrchestratorTeam findings list |

---

## API Hooks (`src/api/queries/agentHooks.ts`)

React Query + custom SSE hooks for every backend endpoint.

| Hook | Type | Description |
|---|---|---|
| `useConnections()` | query | List saved provider connection names |
| `useSaveConnection()` | mutation | Save/update credentials for a provider |
| `useTestConnection()` | mutation | Trigger live connectivity test |
| `useDecisions(filter?)` | query | Fetch pending/all decisions |
| `useApproveDecision()` | mutation | Approve a decision |
| `useRejectDecision()` | mutation | Reject a decision |
| `useModifyDecision()` | mutation | Patch a decision payload |
| `useWorkflowRuns()` | query | List workflow run history |
| `useRunWorkflow()` | mutation | Start a pipeline run |
| `usePlanWorkflow()` | mutation | Dry-run cost estimation |
| `useStopWorkflow()` | mutation | Abort a running workflow |
| `useWorkflowSchedules()` | query | List saved cron schedules |
| `useUpsertSchedule()` | mutation | Create or update a schedule |
| `useDeleteSchedule()` | mutation | Remove a schedule |
| `useAgents()` | query | List registered agents |
| `useCreateAgent()` | mutation | Create a new custom agent (writes AGENTS.md / SOUL.md / SKILLS.md) |
| `useStopAgent()` | mutation | Stop a specific agent run |
| `useStopAllAgents()` | mutation | Stop all active runs (used by TitleBar "Stop All") |
| `useAgentEvents(runId?)` | SSE hook | Subscribe to live `AgentEventBus` stream |
| `useOrchestratorFindings()` | query | List OrchestratorTeam findings |
| `useAckFinding()` | mutation | Acknowledge a finding |
| `useEscalateFinding()` | mutation | Escalate a finding to critical severity |
| `useOrchestratorEvents()` | SSE hook | Subscribe to live orchestrator event stream |

---

## AgentBuilderModal

Four-step wizard launched from **AgentActivityPanel** via the "+ New Agent" button.

| Step | Content |
|---|---|
| 1 — Identity | Name, description, role tag (planner / executor / reviewer / orchestrator) |
| 2 — Persona | Free-text SOUL.md scaffold (personality, tone, ambiguity handling) |
| 3 — Skills | Multi-select from the capability registry + free-text custom skills |
| 4 — Config | Max concurrency slider, RPM/TPM caps, retry policy |

A live file-tree preview on the right shows the generated `AGENTS.md`, `SOUL.md`, and `SKILLS.md` content as the user types.

---

## SSE Hooks

`useAgentEvents` and `useOrchestratorEvents` open an `EventSource` connection to the backend. On mount they replay buffered events (backend ring buffer, default 500 entries). They automatically close on component unmount and reconnect with `Last-Event-ID`.

---

## TitleBar — Stop All

When `agentActivityStore` has one or more active runs, the TitleBar renders a red **Stop All** button. Clicking it calls `useStopAllAgents()`, which issues a `POST /api/agents/stop-all` and clears the active run list.

---

## Test Infrastructure

- **Vitest** (`vitest.config.ts`) — jsdom environment, `@testing-library/react`, `@testing-library/jest-dom`
- `npm test` runs all UI unit tests from `src/tests/`

### Test files

| File | Coverage |
|---|---|
| `src/tests/connections-panel.test.tsx` | Tab navigation, headings |
| `src/tests/decision-review-panel.test.tsx` | Approve / reject / modify flows, JSON view |
| `src/tests/agent-builder-modal.test.tsx` | Step navigation, validation, submit |
| `src/tests/workflow-panel.test.tsx` | Plan-mode toggle, Run/Estimate Cost, Select All / Clear |

---

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

---

## Theme Token Reference

All CSS custom properties are defined in `src/theme/tokens.css` and override-able via `[data-theme="dark"]`.

| Token | Light | Dark |
|---|---|---|
| `--glass-bg` | `rgba(255,255,255,0.55)` | `rgba(20,20,28,0.60)` |
| `--glass-border` | `rgba(255,255,255,0.35)` | `rgba(255,255,255,0.10)` |
| `--glass-blur` | `blur(24px) saturate(180%)` | same |
| `--glass-shadow` | `0 8px 32px rgba(0,0,0,0.12)` | same |
| `--accent` | `#0A84FF` | same |
| `--accent-glow` | `0 0 16px rgba(10,132,255,0.35)` | same |
| `--surface-1` | `rgba(255,255,255,0.70)` | `rgba(30,30,40,0.70)` |
| `--surface-2` | `rgba(255,255,255,0.40)` | `rgba(40,40,55,0.50)` |
| `--radius-panel` | `16px` | same |
| `--radius-card` | `12px` | same |
| `--radius-pill` | `9999px` | same |

---

## Platform Notes

See [`../PLATFORM_NOTES.md`](../PLATFORM_NOTES.md) for known visual differences across macOS 14, Ubuntu 22.04, and Windows 11.

`backdrop-filter` is supported in Tauri's Chromium-based WebView on all three platforms. Where unsupported, `@supports not (backdrop-filter)` falls back to a solid `--surface-1` background.

`prefers-reduced-motion` is respected — all spring/framer-motion animations are suppressed when the OS setting is enabled (see `src/theme/glass.css`).

---

## Sidecar Server

The Tauri app bundles the Hono backend as a sidecar binary (`ui/src-tauri/binaries/product-overlord-server-*`). Build it before running `tauri dev` or `tauri build`:

```bash
# from repo root
npm run build:server
```

Port `3000` is used by default. If it is occupied, the Rust host automatically finds the next free port and passes it to the sidecar via the `PORT` env var.
