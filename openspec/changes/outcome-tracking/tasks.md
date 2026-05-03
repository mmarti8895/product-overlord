# Tasks: outcome-tracking

## 1. Types

- [ ] 1.1 Create `src/types/outcomes.ts` with `OKR`, `KeyResult`, `MetricEvent`, `OutcomeSnapshot`, `OKRDelta`, `FlagAdoption` interfaces

## 2. Stores

- [ ] 2.1 Implement `OKRStore` (`src/stores/okr-store.ts`):
  - [ ] 2.1a LanceDB non-vector table `okrs` — create, get, list, update, delete
  - [ ] 2.1b `linkToEpic(okrId, epicKey)` — append to `linked_epic_keys`
  - [ ] 2.1c `updateKeyResult(okrId, krId, current)` — updates `current` value and `updated_at`

## 3. Adapters

- [ ] 3.1 Define `MetricsIngestionAdapter` interface in `src/adapters/metrics/index.ts`
- [ ] 3.2 Implement `LaunchDarklyAdapter` (`src/adapters/metrics/launch-darkly.ts`):
  - [ ] 3.2a Fetch flags by tag `epic:{epicKey}` via LaunchDarkly REST API
  - [ ] 3.2b Return `FlagAdoption[]` with `evaluations_7d`, `on_percentage`, and `trend` (7-day daily array)
  - [ ] 3.2c Graceful failure — return empty array + warning on API error
- [ ] 3.3 Implement `WebhookAdapter` (`src/adapters/metrics/webhook.ts`):
  - [ ] 3.3a Register `POST /api/outcomes/metrics/ingest` — Bearer token auth vs `ConnectionManager.webhookSecret`
  - [ ] 3.3b Persist `MetricEvent` to LanceDB table `metric_events`
  - [ ] 3.3c Auto-update `KeyResult.current` when `dimensions.epic_key` + `metric_name` match an OKR key result with `source: 'webhook'`

## 4. Services

- [ ] 4.1 Implement `OutcomeSnapshotBuilder` (`src/services/outcome-snapshot-builder.ts`):
  - [ ] 4.1a Subscribe to `SprintMonitor` `ticket:done` events; check if all epic children are done
  - [ ] 4.1b Call `LaunchDarklyAdapter.fetchMetrics(epicKey)` for `FlagAdoption[]`
  - [ ] 4.1c Compute `OKRDelta[]` — compare `KeyResult.current` before vs. after ship date for linked OKRs
  - [ ] 4.1d Call `ReflectionAgent.draft(epic, snapshot)` → store `reflection_draft`
  - [ ] 4.1e Persist `OutcomeSnapshot` to LanceDB table `outcome_snapshots`
  - [ ] 4.1f Emit confidence delta to `PrioritisationEngine` (positive deltas → boost ≤ 10 pp; negative → decay ≤ 15 pp)
- [ ] 4.2 Implement `ReflectionAgent` (`src/services/reflection-agent.ts`) — LLM prompt construction from AC + OKR deltas + flag adoption; return Markdown string; return `null` on LLM failure without throwing

## 5. API Routes

- [ ] 5.1 Create `src/server/routes/outcomes.ts` with 9 routes (see design.md)
- [ ] 5.2 Register outcomes router in `src/server/app.ts`
- [ ] 5.3 `PATCH /api/outcomes/:epicKey/snapshot/notes` — validate body, update `reflection_notes`, set `status = 'reviewed'`

## 6. UI

- [ ] 6.1 Create `outcomeStore` (Zustand) in `ui/src/stores/outcomeStore.ts`
- [ ] 6.2 Add React Query hooks: `useOKRs()`, `useOKR(id)`, `useOutcomeSnapshot(epicKey)`
- [ ] 6.3 Implement `OutcomePanel` (`ui/src/panels/OutcomePanel.tsx`):
  - [ ] 6.3a **OKR Tab** — list with progress bars, quarter filter, "Add OKR" inline form, "Link to Epic" multi-select
  - [ ] 6.3b **Outcome Snapshot Tab** — epic selector, OKR delta cards (before/after/delta), flag adoption sparklines (7-day), reflection card with edit toggle; Save calls `PATCH .../snapshot/notes`
  - [ ] 6.3c "Unmatched Metrics" expandable section for ingest events with no matching OKR
- [ ] 6.4 Register `OutcomePanel` route in app shell sidebar and router

## 7. Tests

- [ ] 7.1 Unit: `OKRStore` — CRUD, link to epic, key result current update
- [ ] 7.2 Unit: `LaunchDarklyAdapter` — mocked HTTP, tag filtering, 7-day trend array, failure path
- [ ] 7.3 Unit: `WebhookAdapter` — auth validation (valid/invalid token), event parsing, OKR KR update on match, unmatched event stored
- [ ] 7.4 Unit: `OutcomeSnapshotBuilder` — epic completion detection (all done / partial), OKR delta calculation, confidence delta emission (positive/negative/neutral)
- [ ] 7.5 Unit: `ReflectionAgent` — prompt construction, Markdown output, null on LLM failure
- [ ] 7.6 Integration: full snapshot pipeline — `SprintMonitor` event → builder → reflection → LanceDB persistence
- [ ] 7.7 Contract: all 9 API routes — happy path, OKR CRUD, unauthenticated ingest 401, snapshot notes update
- [ ] 7.8 UI: `OutcomePanel` — OKR tab (add, link, progress bars), snapshot tab (reflection edit flow), empty states
