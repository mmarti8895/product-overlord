#!/usr/bin/env bash
# Publishes UI Wiring Phase 1 issues to GitHub in dependency order.
# Run `gh auth login` first, then: bash docs/publish-issues.sh
set -euo pipefail

REPO="mmarti8895/product-overlord"
LABEL="needs-triage"

echo "Creating issues in dependency order..."

# ─── SLICE 1 (no blockers) ───────────────────────────────────────────────────
ISSUE_1=$(gh issue create \
  --repo "$REPO" \
  --title "Global UI State Envelope + Tauri Invocation Helper" \
  --body "## What to build

Establish the shared foundation every other UI slice depends on:

1. Define a typed state-shape union (loading / empty / error / permission-denied / success / disabled) used by every panel to represent its current condition.
2. Implement a single typed \`invoke()\` wrapper around \`@tauri-apps/api\` that all Tauri command calls must use. The wrapper applies the global error handler (once wired in Slice 3), enforces suggest-only mode checks for write commands, and returns a typed \`Result\`-shaped object to the caller.
3. Implement Svelte component utilities that map each state-shape variant to the correct LCARS-styled render (spinner for loading, labelled empty card, error card with message, lock icon for permission-denied, dimmed control for disabled).

No panel or component may manage its own ad-hoc loading flag outside this envelope.

## Acceptance criteria

- [ ] A state-shape type covers all six variants and each variant is structurally distinct (no variant is assignable to another)
- [ ] The \`invoke()\` helper is the only site in the codebase that calls \`@tauri-apps/api\` directly
- [ ] Unit tests confirm each state-shape variant is distinct and non-overlapping
- [ ] Unit tests confirm composing multiple panel states does not cause state to leak between them
- [ ] LCARS-styled render utilities exist for each variant and are used by at least one panel (can be a placeholder panel for now)
- [ ] No external Tauri calls are made; the wrapper can be tested with a mock backend

## Blocked by

None — can start immediately" \
  | awk -F'/' '{print $NF}')
echo "Created Slice 1 → issue #$ISSUE_1"

# ─── SLICE 6 (parallel, needs Slice 1 only) ──────────────────────────────────
ISSUE_6=$(gh issue create \
  --repo "$REPO" \
  --title "Index Store Health Panel" \
  --body "## What to build

Wire the Index Store telemetry card in the sidebar to the real index store health command. The panel must surface three distinct states — Reachable, Not reachable, and Not configured — and must treat \"not yet initialised\" as a distinct state, not an error. The panel uses the Global UI State Envelope introduced in Slice 1 for its loading and error conditions.

## Acceptance criteria

- [ ] The telemetry card displays the configured path, reachability status, and last-initialized timestamp from the backend command response
- [ ] Reachable, Not reachable, and Not configured are rendered as visually distinct states
- [ ] \"Not yet initialised\" (LanceDB path set but DB not yet created) renders as Not configured, not as an error
- [ ] Loading and error states are handled through the Global UI State Envelope
- [ ] Tests confirm each reachability state is reflected correctly from various backend command outputs

## Blocked by

- #$ISSUE_1 (Global UI State Envelope + Tauri Invocation Helper)" \
  | awk -F'/' '{print $NF}')
echo "Created Slice 6 → issue #$ISSUE_6"

# ─── SLICE 2 (needs Slice 1) ─────────────────────────────────────────────────
ISSUE_2=$(gh issue create \
  --repo "$REPO" \
  --title "Session Store + Header Wiring" \
  --body "## What to build

Implement a typed Svelte store that is the single source of truth for session state across the entire app. Wire it to the session lifecycle commands (\`cmd_get_session_status\`, \`cmd_unlock_session\`, \`cmd_lock_session\`). Replace the hardcoded \"Role: Admin\" header badge and absent TTL display with live reactive values from the store. Handle session expiry by triggering re-lock and displaying a recovery prompt.

This store is the dependency of every other module that gates behavior on role or session state.

## Acceptance criteria

- [ ] The header role badge reflects the real session role returned by the backend
- [ ] A TTL countdown is visible in the header and updates live (counts down to zero)
- [ ] When the session expires, the UI re-locks and displays a recovery prompt without crashing or entering broken state
- [ ] Attempting a protected action while the session is locked shows a prompt to unlock rather than silently failing
- [ ] All other stores and components read role/permission state from this store only — no component queries session commands directly
- [ ] Tests cover: unlock/lock state transitions emit correct shapes; TTL expiry triggers re-lock; permission checks derived from the store match the role-to-permission mapping

## Blocked by

- #$ISSUE_1 (Global UI State Envelope + Tauri Invocation Helper)" \
  | awk -F'/' '{print $NF}')
echo "Created Slice 2 → issue #$ISSUE_2"

# ─── SLICE 4 (needs Slice 2) ─────────────────────────────────────────────────
ISSUE_4=$(gh issue create \
  --repo "$REPO" \
  --title "Policy Panel Binding" \
  --body "## What to build

Replace the hardcoded Policy Status card in the sidebar with a live query to the role/permission command layer. The card must reflect real RBAC enforcement state from the backend. All write-action controls app-wide must be rendered in their disabled state when the session role does not have the required permission.

## Acceptance criteria

- [ ] The Policy Status card reads enforcement state from \`cmd_get_current_role\` on mount — no hardcoded values remain
- [ ] The card re-queries when the session store emits a role change
- [ ] Write-action controls (add credential, set DoR item, invoke LLM, assign role) are disabled when the current role lacks the required permission
- [ ] Disabled controls render using the Global UI State Envelope disabled variant
- [ ] Tests confirm that real role/permission state from the backend overwrites any prior hardcoded default
- [ ] Tests confirm disabled-state gating matches the role-to-permission mapping from the domain

## Blocked by

- #$ISSUE_2 (Session Store + Header Wiring)" \
  | awk -F'/' '{print $NF}')
echo "Created Slice 4 → issue #$ISSUE_4"

# ─── SLICE 3 (needs Slice 2) ─────────────────────────────────────────────────
ISSUE_3=$(gh issue create \
  --repo "$REPO" \
  --title "Permission Error Handler + Suggest-Only Enforcement" \
  --body "## What to build

Register a global error interceptor at the application shell level. All Tauri command calls flow through the \`invoke()\` wrapper from Slice 1. That wrapper must now catch \`PermissionDenied\`, \`SessionExpired\`, and a new \`SuggestOnly\` error variant and dispatch them to a notification queue — no individual component handles these cases. Suggest-only mode must be enforced structurally in the wrapper (not hidden in CSS), so any write command that would mutate Jira state is blocked before reaching the backend, returning \`SuggestOnly\` to the caller.

## Acceptance criteria

- [ ] \`PermissionDenied\` errors produce a dismissible notification with a clear message — never a silent failure
- [ ] \`SessionExpired\` errors trigger re-lock via the session store and surface an expiry notification
- [ ] \`SuggestOnly\` errors produce a distinct notification explaining that the action is not permitted in Phase 1
- [ ] Suggest-only enforcement lives in the \`invoke()\` wrapper, not in UI display logic
- [ ] Non-error responses pass through the wrapper unmodified
- [ ] Tests confirm each error variant produces the correct notification payload
- [ ] Tests confirm non-error responses are not modified by the interceptor

## Blocked by

- #$ISSUE_2 (Session Store + Header Wiring)" \
  | awk -F'/' '{print $NF}')
echo "Created Slice 3 → issue #$ISSUE_3"

# ─── SLICE 5 (needs Slice 3) ─────────────────────────────────────────────────
ISSUE_5=$(gh issue create \
  --repo "$REPO" \
  --title "Credential Health Panel" \
  --body "## What to build

Wire the Credential Health sidebar panel to the credential list and mutation commands (\`cmd_add_credential\`, \`cmd_delete_credential\`, and the credential list command). Display per-provider health status (Healthy / Invalid / Missing) with metadata only — no secret values may appear in any frontend state shape or rendered output. Mutation controls are disabled for ReadOnly sessions (enforced via the session store and Global UI State Envelope). All mutation actions must produce an audit log entry verified end-to-end.

## Acceptance criteria

- [ ] The panel displays the total count and per-provider status for all configured credentials
- [ ] Only metadata is displayed: provider name, label, status — no secret values in state or DOM
- [ ] Adding a credential updates the reactive list immediately on backend confirmation
- [ ] Deleting a credential removes the correct entry
- [ ] Add and delete controls are disabled when the session role is ReadOnly
- [ ] All add/delete actions produce an audit log entry (verified via \`cmd_verify_audit_integrity\` or audit list)
- [ ] Loading, empty, error, and permission-denied states use the Global UI State Envelope
- [ ] Tests confirm: reactive list updates on add/delete; no secret values in any emitted state shape; disabled state for ReadOnly role

## Blocked by

- #$ISSUE_3 (Permission Error Handler + Suggest-Only Enforcement)" \
  | awk -F'/' '{print $NF}')
echo "Created Slice 5 → issue #$ISSUE_5"

# ─── SLICE 7 (needs Slice 3) ─────────────────────────────────────────────────
ISSUE_7=$(gh issue create \
  --repo "$REPO" \
  --title "Ticket Queue Provider" \
  --body "## What to build

Replace the hardcoded ticket list in the Ticket Queue panel with a typed stub provider that implements a stable interface (swappable for a live Jira adapter in Phase 2). The provider returns typed ticket summaries with priority and DoR completion percentage. Selecting a ticket updates a shared active-ticket state that the DoR panel (Slice 8) reads. Suggest-only mode enforcement from Slice 3 ensures no write path to Jira is reachable.

## Acceptance criteria

- [ ] The Ticket Queue panel renders tickets from the stub provider, not hardcoded data
- [ ] Each ticket card shows a priority badge (Critical / High / Medium) and DoR completion percentage
- [ ] Selecting a ticket updates a shared active-ticket reference consumed by the DoR panel
- [ ] The provider implements a typed interface that does not expose stub internals (a future Jira adapter can satisfy the same interface)
- [ ] Any ticket write action (if present) is blocked by suggest-only enforcement from Slice 3
- [ ] Loading, empty, and error states use the Global UI State Envelope
- [ ] Tests confirm: well-typed summaries returned; active-ticket state updated on selection; priority and DoR percentage computed correctly

## Blocked by

- #$ISSUE_3 (Permission Error Handler + Suggest-Only Enforcement)" \
  | awk -F'/' '{print $NF}')
echo "Created Slice 7 → issue #$ISSUE_7"

# ─── SLICE 9 (needs Slice 3) ─────────────────────────────────────────────────
ISSUE_9=$(gh issue create \
  --repo "$REPO" \
  --title "LLM Console Module" \
  --body "## What to build

Wire the LLM Console panel to \`cmd_invoke_llm\`. All responses must be tagged \`SIMULATED\` at the adapter boundary before reaching any rendering code — this is a structural rule, not a UI decoration. The LLM Console must validate the provider base URL using \`cmd_validate_base_url\` before dispatching. Prompt text is ephemeral (component state only, not persisted to any store or storage). All rendered LLM output is sanitised before display. Invocations are audit-logged end-to-end.

## Acceptance criteria

- [ ] Submitting a prompt via the Run button calls \`cmd_invoke_llm\` and displays the response
- [ ] Every response is tagged \`SIMULATED\` before rendering — the tag is applied in the adapter, not in a template
- [ ] Provider base URL is validated with \`cmd_validate_base_url\` before the command is dispatched; invalid URLs show an inline error
- [ ] Prompt text is not present in any store, storage, or audit log payload after the invocation completes
- [ ] LLM output is sanitised before insertion into the DOM
- [ ] Each invocation produces an audit log entry
- [ ] Loading and error states during invocation use the Global UI State Envelope
- [ ] Tests confirm: all responses tagged \`SIMULATED\`; loading/error states; prompt not persisted; URL validation called before dispatch

## Blocked by

- #$ISSUE_3 (Permission Error Handler + Suggest-Only Enforcement)" \
  | awk -F'/' '{print $NF}')
echo "Created Slice 9 → issue #$ISSUE_9"

# ─── SLICE 8 (needs Slice 7) ─────────────────────────────────────────────────
ISSUE_8=$(gh issue create \
  --repo "$REPO" \
  --title "DoR Evaluation Adapter + Checklist Panel" \
  --body "## What to build

Implement the DoR Evaluation Adapter — a module that maps raw ticket scaffold data from \`cmd_get_ticket_scaffold\` to a structured checklist model with explicit tri-state per item: Complete, Incomplete, or Unknown. Missing or empty fields must map to Unknown, never to Complete or Incomplete. This is a domain invariant. Item status mutations dispatch \`cmd_set_dor_item_status\` and the UI updates only on backend confirmation. All scaffold content (ticket summaries, AC text) is sanitised before rendering.

## Acceptance criteria

- [ ] Selecting a ticket in the Ticket Queue (Slice 7) triggers the adapter and populates the DoR checklist
- [ ] Each checklist item displays one of three explicit states: Complete, Incomplete, or Unknown — no item is unlabelled
- [ ] A missing or empty field produces Unknown — never Complete or Incomplete
- [ ] Updating an item's status calls \`cmd_set_dor_item_status\` and reflects the confirmed backend state (not optimistic)
- [ ] All ticket and scaffold content is sanitised before insertion into the DOM
- [ ] Loading, empty (no scaffold), error, and permission-denied states use the Global UI State Envelope
- [ ] Tests confirm: all three item states produced from varied payloads; missing field → Unknown invariant holds; mutations dispatch correct command arguments; no optimistic update on backend failure

## Blocked by

- #$ISSUE_7 (Ticket Queue Provider)" \
  | awk -F'/' '{print $NF}')
echo "Created Slice 8 → issue #$ISSUE_8"

echo ""
echo "✓ All 9 issues created."
echo ""
echo "Dependency graph:"
echo "  #$ISSUE_1  (Slice 1: Global UI State Envelope)"
echo "  ├── #$ISSUE_6  (Slice 6: Index Store Health Panel)"
echo "  └── #$ISSUE_2  (Slice 2: Session Store + Header)"
echo "      ├── #$ISSUE_4  (Slice 4: Policy Panel Binding)"
echo "      └── #$ISSUE_3  (Slice 3: Permission Error Handler)"
echo "          ├── #$ISSUE_5  (Slice 5: Credential Health Panel)"
echo "          ├── #$ISSUE_7  (Slice 7: Ticket Queue Provider)"
echo "          │   └── #$ISSUE_8  (Slice 8: DoR Evaluation Adapter)"
echo "          └── #$ISSUE_9  (Slice 9: LLM Console Module)"
