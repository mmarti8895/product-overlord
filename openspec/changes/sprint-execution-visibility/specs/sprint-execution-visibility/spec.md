## ADDED Requirements

### Requirement: Sprint health snapshot
The system SHALL maintain a `SprintSnapshot` for every configured board ID, refreshed on a configurable poll interval (default 5 minutes). Each snapshot SHALL include: committed story points, completed story points, days remaining, blockers list, scope additions since sprint start, scope creep delta in points, a derived health score (0–100), and a health label (`on-track` | `at-risk` | `off-track`). When `story_points` is unavailable the system SHALL fall back to `original_estimate` in hours using a 1-point = 8-hours conversion and SHALL set `points_estimated_from_time: true` on the snapshot.

#### Scenario: Healthy sprint snapshot
- **WHEN** a board has an active sprint with 40 committed points, 30 completed, 3 days remaining, 0 blockers, and 0 scope additions
- **THEN** the snapshot SHALL have `health_score >= 75` and `health_label = 'on-track'`

#### Scenario: At-risk sprint — blockers present
- **WHEN** an active sprint has 2 tickets that are blocked (dependencies unresolved) past the sprint midpoint
- **THEN** the snapshot SHALL list both tickets in `blockers` and SHALL have `health_label = 'at-risk'` or `'off-track'`

#### Scenario: Scope creep detected
- **WHEN** a ticket is added to the active sprint after `sprint.startDate` and has 5 story points
- **THEN** the snapshot SHALL include that ticket in `scope_additions` and `scope_creep_delta` SHALL be `5`

#### Scenario: Story-points fallback
- **WHEN** a ticket has no `story_points` custom field but has `original_estimate = 28800` seconds (8 hours)
- **THEN** the ticket SHALL be counted as `1` story point and `points_estimated_from_time` SHALL be `true` on the snapshot

#### Scenario: Stale snapshot on adapter error
- **WHEN** the Jira Agile REST adapter returns a 5xx error during a poll cycle
- **THEN** the system SHALL return the last cached snapshot with `stale: true` and `stale_since` set to the timestamp of the last successful fetch

---

### Requirement: Velocity trend tracking
The system SHALL compute a rolling velocity trend for the last 6 closed sprints per board. Each `VelocityPoint` SHALL record committed and completed story points. If fewer than 6 closed sprints exist the system SHALL return however many are available without error.

#### Scenario: Six-sprint velocity trend
- **WHEN** a board has 6 or more closed sprints with story-point data
- **THEN** `GET /api/sprint/:boardId/velocity` SHALL return exactly 6 `VelocityPoint` records ordered oldest-first

#### Scenario: Fewer than 6 sprints available
- **WHEN** a board has only 2 closed sprints
- **THEN** the endpoint SHALL return 2 `VelocityPoint` records and SHALL NOT return an error

---

### Requirement: Sprint SSE event stream
The system SHALL expose a Server-Sent Events stream at `GET /api/sprint/stream` that emits a `sprint:snapshot-updated` event for every board whose snapshot changes between poll cycles. Clients SHALL be able to subscribe to all boards via a single connection. The stream SHALL emit a `sprint:heartbeat` event every 30 seconds to keep connections alive.

#### Scenario: Snapshot-change event emitted
- **WHEN** a poll cycle produces a snapshot whose `health_label` differs from the previous snapshot
- **THEN** a `sprint:snapshot-updated` SSE event SHALL be emitted containing the full new `SprintSnapshot`

#### Scenario: Heartbeat keeps connection open
- **WHEN** no snapshot changes occur for 30 seconds
- **THEN** the SSE stream SHALL emit a `sprint:heartbeat` event with `{ timestamp: ISO }` to prevent client timeout

---

### Requirement: No Jira writes
The `SprintMonitor` and all supporting services SHALL be strictly read-only with respect to Jira. The system SHALL NOT transition tickets, modify sprint contents, assign issues, or post comments as part of this capability.

#### Scenario: Read-only enforcement
- **WHEN** `SprintMonitor` detects a blocker
- **THEN** it SHALL emit a local alert event and update the snapshot; it SHALL NOT call any Jira write API

---

### Requirement: SprintHealthPanel UI
The desktop UI SHALL include a `SprintHealthPanel` that displays the current sprint health badge, velocity gauge, blocker list, and scope creep count for a selected board. The panel SHALL update in real time via the SSE stream without requiring a manual refresh. The board selector SHALL list all configured `sprint_board_ids`.

#### Scenario: Live update on snapshot change
- **WHEN** the backend emits a `sprint:snapshot-updated` SSE event for the selected board
- **THEN** the `SprintHealthPanel` SHALL update the health badge, velocity gauge, and blocker list without a full page reload

#### Scenario: Offline / degraded state display
- **WHEN** the SSE stream disconnects
- **THEN** the panel SHALL show a "Reconnecting…" indicator and display the last known snapshot data marked as stale
