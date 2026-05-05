#!/usr/bin/env bash
# Publishes execution-ready operations issues for PRD #25 in dependency order.
# Run `gh auth login` first, then: bash docs/publish-ops-issues.sh
set -euo pipefail

REPO="mmarti8895/product-overlord"
LABEL="needs-triage"

# Ensure triage label exists.
gh label create "$LABEL" --repo "$REPO" --color F9D0C4 --description "Needs triage" >/dev/null 2>&1 || true

echo "Creating operations execution stack for PRD #25..."

# 1) Foundation: admin superset and capability resolver
ISSUE_1=$(gh issue create \
  --repo "$REPO" \
  --label "$LABEL" \
  --title "OPS-1: Role Capability Resolver + Admin Superset Enforcement" \
  --body "## What to build

Implement a single capability resolver that derives all UI/command capabilities from session role + command policy and guarantees Admin is a strict superset of Operator and ReadOnly.

## Tasks

- Add a role capability resolver module used by all UI gating and command-surface checks
- Remove scattered ad-hoc permission checks where resolver output should be consumed
- Add explicit admin superset invariant checks for all currently exposed capabilities
- Standardize disabled-with-reason behavior for non-permitted actions

## Acceptance criteria

- [ ] Admin can perform all currently available Operator and ReadOnly actions
- [ ] No action is incorrectly blocked for Admin by UI gating
- [ ] Resolver output is the single source for capability checks in UI interaction surfaces
- [ ] Permission-denied and disabled states are deterministic and explainable
- [ ] Tests cover admin superset invariants and non-admin boundaries

## Blocked by

None — can start immediately" \
  | awk -F'/' '{print $NF}')
echo "Created OPS-1 → issue #$ISSUE_1"

# 2) Navigation orchestration
ISSUE_2=$(gh issue create \
  --repo "$REPO" \
  --label "$LABEL" \
  --title "OPS-2: Operations Navigation Coordinator" \
  --body "## What to build

Create a navigation coordinator that maps top-level shell actions (Command, Tickets, Scaffolds, Audit) to concrete workflow intents, default sub-views, and context initialization.

## Tasks

- Introduce coordinator API for top-level action dispatch
- Define default target context per action
- Preserve/recover active context when session unlock/refresh occurs
- Route top-level rail/button interactions through coordinator only

## Acceptance criteria

- [ ] Command/Tickets/Scaffolds/Audit actions all dispatch via coordinator
- [ ] Each action opens a deterministic default workflow context
- [ ] Context restoration works after unlock where applicable
- [ ] Tests cover dispatch mapping and context initialization behavior

## Blocked by

- #$ISSUE_1 (OPS-1: Role Capability Resolver + Admin Superset Enforcement)" \
  | awk -F'/' '{print $NF}')
echo "Created OPS-2 → issue #$ISSUE_2"

# 3) Command workflow
ISSUE_3=$(gh issue create \
  --repo "$REPO" \
  --label "$LABEL" \
  --title "OPS-3: Activate Command Workflow Surface" \
  --body "## What to build

Activate the Command surface as a real operational console (system/session/index/integration status) with actionable defaults for autonomous PM/Project Manager daily use.

## Tasks

- Wire Command action to command console default view
- Surface session status, role, index health, and integration health in one operational context
- Add deterministic empty/loading/error/degraded handling
- Add notifications for operational failures and permission-denied outcomes

## Acceptance criteria

- [ ] Command action opens a non-placeholder operational console
- [ ] Operational summary includes session + index + integration state
- [ ] Status transitions are reflected without page reload
- [ ] Tests validate default command workflow behavior and degraded/error paths

## Blocked by

- #$ISSUE_2 (OPS-2: Operations Navigation Coordinator)" \
  | awk -F'/' '{print $NF}')
echo "Created OPS-3 → issue #$ISSUE_3"

# 4) Tickets workflow
ISSUE_4=$(gh issue create \
  --repo "$REPO" \
  --label "$LABEL" \
  --title "OPS-4: Activate Tickets Workflow Surface" \
  --body "## What to build

Activate Tickets as a deterministic triage workflow entrypoint with queue hydration, active-ticket context, and readiness-oriented transitions to DoR/scaffold actions.

## Tasks

- Wire Tickets action to queue-first default context
- Ensure active-ticket selection propagates to downstream DoR/scaffold contexts
- Preserve ticket context through section navigation
- Expose permission-safe actions for PM/Project Manager workflows

## Acceptance criteria

- [ ] Tickets action opens queue-first context immediately
- [ ] Active ticket context is shared to downstream readiness/scaffold workflows
- [ ] Context persists when navigating away and back
- [ ] Tests cover selection, context propagation, and permission gating

## Blocked by

- #$ISSUE_2 (OPS-2: Operations Navigation Coordinator)" \
  | awk -F'/' '{print $NF}')
echo "Created OPS-4 → issue #$ISSUE_4"

# 5) Scaffolds workflow
ISSUE_5=$(gh issue create \
  --repo "$REPO" \
  --label "$LABEL" \
  --title "OPS-5: Activate Scaffolds Workflow Surface" \
  --body "## What to build

Activate Scaffolds as an execution workspace for scaffold create/read/update flows with recent-first context and readiness feedback.

## Tasks

- Wire Scaffolds action to recent scaffold workspace
- Ensure scaffold mutations update readiness views deterministically
- Add role-safe mutation handling and clear disabled states
- Provide deterministic success/error feedback for scaffold operations

## Acceptance criteria

- [ ] Scaffolds action opens recent scaffold workspace
- [ ] Scaffold updates reflect in readiness indicators immediately after confirmation
- [ ] Unauthorized users see disabled-with-reason controls
- [ ] Tests cover scaffold mutations and readiness synchronization behavior

## Blocked by

- #$ISSUE_2 (OPS-2: Operations Navigation Coordinator)" \
  | awk -F'/' '{print $NF}')
echo "Created OPS-5 → issue #$ISSUE_5"

# 6) Audit workflow
ISSUE_6=$(gh issue create \
  --repo "$REPO" \
  --label "$LABEL" \
  --title "OPS-6: Activate Audit Workflow Surface" \
  --body "## What to build

Activate Audit as an operational compliance surface with one-click integrity verification and privileged-action timeline defaults.

## Tasks

- Wire Audit action to integrity-first default view
- Expose verification command results in a clear pass/fail summary
- Surface recent privileged actions with correlation context
- Add deterministic handling for verification errors

## Acceptance criteria

- [ ] Audit action opens integrity verification summary by default
- [ ] Users can trigger integrity checks directly from Audit
- [ ] Verification results and errors are clearly represented
- [ ] Tests validate integrity check invocation and result rendering behavior

## Blocked by

- #$ISSUE_2 (OPS-2: Operations Navigation Coordinator)" \
  | awk -F'/' '{print $NF}')
echo "Created OPS-6 → issue #$ISSUE_6"

# 7) LLM credential lifecycle
ISSUE_7=$(gh issue create \
  --repo "$REPO" \
  --label "$LABEL" \
  --title "OPS-7: LLM Credential Lifecycle Hardening" \
  --body "## What to build

Deliver a production-safe LLM credential lifecycle (add/list/health/delete) optimized for autonomous operations, with strict secret hygiene and role-safe controls.

## Tasks

- Consolidate LLM credential onboarding path with provider-aware validation
- Ensure per-credential health states are refreshed and visible in workflow surfaces
- Ensure secret values remain ephemeral and never persisted in frontend state
- Align tray/app degraded indicators with aggregate credential health states

## Acceptance criteria

- [ ] Users can add/manage LLM credentials through a single reliable flow
- [ ] Credential health status is visible and refreshed predictably
- [ ] Secret hygiene guarantees are preserved in UI and command payload handling
- [ ] Degraded credential state contributes to operational health indicators
- [ ] Tests cover lifecycle transitions and no-secret-leak guarantees

## Blocked by

- #$ISSUE_1 (OPS-1: Role Capability Resolver + Admin Superset Enforcement)" \
  | awk -F'/' '{print $NF}')
echo "Created OPS-7 → issue #$ISSUE_7"

# 8) Autonomous routines
ISSUE_8=$(gh issue create \
  --repo "$REPO" \
  --label "$LABEL" \
  --title "OPS-8: Autonomous PM/Project Manager Routine Orchestration" \
  --body "## What to build

Implement deterministic routines that chain existing surfaces into repeatable operations:
- Daily Review
- Planning Readiness

## Tasks

- Add routine orchestrator that sequences Command/Tickets/Scaffolds/Audit actions
- Implement Daily Review flow: queue refresh -> DoR/scaffold checks -> integration health snapshot
- Implement Planning Readiness flow: readiness gap scan -> role-safe remediation actions -> audit checkpoint
- Emit notifications and audit entries for privileged routine steps

## Acceptance criteria

- [ ] Daily Review routine executes the expected sequence deterministically
- [ ] Planning Readiness routine executes expected sequence deterministically
- [ ] Routine outcomes are visible via status notifications
- [ ] Privileged steps are auditable
- [ ] Tests validate step ordering and failure/permission handling

## Blocked by

- #$ISSUE_3 (OPS-3: Activate Command Workflow Surface)
- #$ISSUE_4 (OPS-4: Activate Tickets Workflow Surface)
- #$ISSUE_5 (OPS-5: Activate Scaffolds Workflow Surface)
- #$ISSUE_6 (OPS-6: Activate Audit Workflow Surface)
- #$ISSUE_7 (OPS-7: LLM Credential Lifecycle Hardening)" \
  | awk -F'/' '{print $NF}')
echo "Created OPS-8 → issue #$ISSUE_8"

# 9) Final integration verification
ISSUE_9=$(gh issue create \
  --repo "$REPO" \
  --label "$LABEL" \
  --title "OPS-9: End-to-End Operations Loop Verification" \
  --body "## What to build

Perform end-to-end integration hardening for the autonomous operations loop and close any cross-surface gaps before release.

## Tasks

- Validate cross-surface context consistency (Command/Tickets/Scaffolds/Audit)
- Validate Admin superset behavior across every actionable control
- Validate degraded-state operational behavior and notifications
- Add regression tests for full routine execution paths

## Acceptance criteria

- [ ] End-to-end operations loop works without dead-end top-level actions
- [ ] Admin can execute all supported operational flows
- [ ] Degraded/error handling remains observable and actionable
- [ ] Regression tests cover routine happy path and critical failure paths

## Blocked by

- #$ISSUE_8 (OPS-8: Autonomous PM/Project Manager Routine Orchestration)" \
  | awk -F'/' '{print $NF}')
echo "Created OPS-9 → issue #$ISSUE_9"

echo ""
echo "✓ Operations stack created from PRD #25."
echo ""
echo "Dependency graph:"
echo "  #$ISSUE_1  (OPS-1: Role Capability Resolver + Admin Superset Enforcement)"
echo "  ├── #$ISSUE_2  (OPS-2: Operations Navigation Coordinator)"
echo "  │   ├── #$ISSUE_3  (OPS-3: Command Surface)"
echo "  │   ├── #$ISSUE_4  (OPS-4: Tickets Surface)"
echo "  │   ├── #$ISSUE_5  (OPS-5: Scaffolds Surface)"
echo "  │   └── #$ISSUE_6  (OPS-6: Audit Surface)"
echo "  └── #$ISSUE_7  (OPS-7: LLM Credential Lifecycle)"
echo "      └── #$ISSUE_8  (OPS-8: Autonomous Routines)"
echo "           └── #$ISSUE_9  (OPS-9: End-to-End Verification)"