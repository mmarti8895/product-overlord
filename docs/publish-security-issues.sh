#!/usr/bin/env bash
# Publishes Phase 2 Security issues to GitHub.
# SEC-201, SEC-203, SEC-205 are already implemented — skipped.
# Run `gh auth login` first, then: bash docs/publish-security-issues.sh
set -euo pipefail

REPO="mmarti8895/product-overlord"

echo "Creating Phase 2 Security issues..."
echo "(SEC-201, SEC-203, SEC-205 already implemented — skipped)"
echo ""

# ─── SEC-202 (no hard deps) ──────────────────────────────────────────────────
SEC202=$(gh issue create \
  --repo "$REPO" \
  --title "SEC-202: Rate Limiting + Concurrency Guards for High-Cost Commands" \
  --body "## Problem

High-cost commands (\`cmd_invoke_llm\`, index init/check) can be called in rapid succession with no throttle. An operator or a compromised session can abuse these to exhaust resources or rack up LLM API costs.

## Outcome

Command abuse is throttled and every throttle event is recorded in the audit log.

## Tasks

- [ ] **SEC-202.1** Add generic in-memory token-bucket limiter (\`security/rate_limit.rs\`)
  - Refill math, burst handling, deterministic clock abstraction for tests.
- [ ] **SEC-202.2** Define per-command limit policies
  - \`cmd_invoke_llm\`: 10/min, burst 5
  - \`cmd_initialize_index_store\`: 3/min, burst 1
  - \`cmd_check_index_store_health\`: 20/min, burst 5
  - Global fallback policy.
- [ ] **SEC-202.3** Add single-flight guard for index initialization
  - Only one initialization may run at a time; concurrent calls return an in-progress error.
- [ ] **SEC-202.4** Integrate limiter into command handlers
  - Apply before expensive work begins; return stable \`AppError\` on throttle.
- [ ] **SEC-202.5** Emit throttling audit events
  - Include command name, policy limits, and current counters.
- [ ] **SEC-202.6** Add unit + integration tests
  - Unit: token bucket refill and deny behaviour.
  - Integration: burst abuse throttles predictably; concurrent index init collapses to one job.

## Acceptance Criteria

- [ ] Exceeding policy returns a deterministic \`AppError\` (not a panic or silent drop)
- [ ] Concurrent index initialization attempts collapse to one active job
- [ ] Throttle events appear in the audit log with command name and counters
- [ ] Unit tests for refill and deny; integration tests for abuse and concurrency

## Blocked by

SEC-201 (session/auth) — already implemented. No hard blockers." \
  | awk -F'/' '{print $NF}')
echo "Created SEC-202 → issue #$SEC202"

# ─── SEC-204 (soft dep on SEC-203, already done) ─────────────────────────────
SEC204=$(gh issue create \
  --repo "$REPO" \
  --title "SEC-204: Tamper-Evident Audit Chain" \
  --body "## Problem

The audit log is append-only but not tamper-evident. A modified or deleted line is currently undetectable.

## Outcome

Any post-write modification or deletion of an audit record is detectable via a hash-chain verification command.

## Tasks

- [ ] **SEC-204.1** Extend audit record schema for hash chain
  - Add \`chain_version\`, \`prev_hash\`, \`entry_hash\` fields to the record struct.
  - Preserve backward-compatibility for old records when reading.
- [ ] **SEC-204.2** Implement canonical serialization for hashing
  - Deterministic field order and stable bytes across runs (sorted JSON or equivalent).
- [ ] **SEC-204.3** Implement chain append logic
  - Read previous hash, compute \`entry_hash = H(prev_hash || canonical_json(entry_without_hash))\`.
  - Persist atomically with existing append-only file semantics.
- [ ] **SEC-204.4** Add integrity verification service
  - Scan log, verify chain continuity, return first failure index and reason.
- [ ] **SEC-204.5** Expose \`cmd_verify_audit_integrity\` command
  - Returns \`{ ok: bool, first_invalid_line: Option<usize>, reason: Option<String> }\`.
  - Protected by \`ViewAuditLog\` permission (already in command policy table).
- [ ] **SEC-204.6** Add tamper detection tests
  - Positive chain test: append then verify passes.
  - Corruption tests: modified line detected; deleted line detected.

## Acceptance Criteria

- [ ] Normal append path produces a valid, verifiable chain
- [ ] A modified or deleted audit line causes \`cmd_verify_audit_integrity\` to return \`ok: false\` with the first failing index
- [ ] Verification result is accessible from the UI via the existing telemetry panel
- [ ] All three test scenarios pass: clean chain, modified line, deleted line

## Blocked by

SEC-203 (path sandboxing) — already implemented. No hard blockers." \
  | awk -F'/' '{print $NF}')
echo "Created SEC-204 → issue #$SEC204"

# ─── SEC-206 (no deps) ───────────────────────────────────────────────────────
SEC206=$(gh issue create \
  --repo "$REPO" \
  --title "SEC-206: Poisoned Lock / Panic Resilience in Command Paths" \
  --body "## Problem

Several command handlers call \`.unwrap()\` when acquiring a \`Mutex\` lock. If a thread panics while holding the lock, all subsequent calls to that handler will panic, crashing the app rather than returning a controlled error.

## Outcome

Poisoned lock conditions in command handlers return a controlled \`AppError::Internal\` response. No command handler panics from a lock acquisition failure.

## Tasks

- [ ] **SEC-206.1** Add \`lock_or_internal\` helper wrapper
  - Implement a helper that maps a poisoned-lock error to \`AppError::Internal\` with a descriptive message.
- [ ] **SEC-206.2** Replace \`.unwrap()\` on mutex locks in all runtime command paths
  - Apply helper to every \`state.session_manager.lock()\`, \`state.credential_store.lock()\`, and similar in non-test code.
  - \`.unwrap()\` in \`#[cfg(test)]\` blocks is acceptable.
- [ ] **SEC-206.3** Normalise poisoned-lock error messages
  - Frontend-safe message (no internal stack path leakage); useful backend context in the \`AppError\` source.
- [ ] **SEC-206.4** Add poisoned-lock tests
  - Simulate a poisoned mutex and verify the command returns \`AppError::Internal\`, not a panic.

## Acceptance Criteria

- [ ] No command handler can panic from a lock acquisition failure
- [ ] Poisoned lock returns \`AppError::Internal\` with a safe, non-leaking message
- [ ] All existing tests continue to pass
- [ ] New unit test simulates poisoned mutex and asserts controlled error

## Blocked by

None — can start immediately." \
  | awk -F'/' '{print $NF}')
echo "Created SEC-206 → issue #$SEC206"

# ─── SEC-207 (needs SEC-202, SEC-204, SEC-206) ───────────────────────────────
SEC207=$(gh issue create \
  --repo "$REPO" \
  --title "SEC-207: Security Regression Suite + Telemetry" \
  --body "## Problem

Security controls (authz, rate limiting, path sandboxing, audit integrity) can regress silently without a dedicated test suite and observability layer. Currently there is no \`tests/security/\` harness and no CI job scoped to security scenarios.

## Outcome

Security behaviour is test-guarded in CI and observable from the telemetry panel at runtime.

## Tasks

- [ ] **SEC-207.1** Create \`tests/security/\` integration test folder
  - Add baseline harness and shared fixtures (test app state, seed audit log, etc.).
- [ ] **SEC-207.2** Add authz bypass regression tests
  - Locked session denied for every protected permission.
  - Low-role (ReadOnly) denied for Operator/Admin-only commands.
- [ ] **SEC-207.3** Add rate-limit regression tests
  - Burst abuse triggers throttle for \`cmd_invoke_llm\` and index commands.
  - Sustained abuse stays throttled until bucket refills.
- [ ] **SEC-207.4** Add path sandbox regression tests
  - Out-of-root paths rejected; traversal (\`../\`) rejected; symlink escape rejected.
- [ ] **SEC-207.5** Add audit tamper regression tests
  - Clean chain verifies; modified record detected; deleted record detected.
- [ ] **SEC-207.6** Add security telemetry command
  - Expose \`cmd_get_security_telemetry\` returning denied-permission count, throttled-request count, and last audit integrity status.
  - Protected by \`ViewSystemConfig\` permission.
- [ ] **SEC-207.7** Add CI security test job
  - \`cargo test security::\` target in CI config.

## Acceptance Criteria

- [ ] \`cargo test security::\` runs all scenarios and fails on any known bypass pattern
- [ ] Each security control class (authz, rate-limit, path, audit) has at least one regression test
- [ ] \`cmd_get_security_telemetry\` returns current denied/throttled/integrity state
- [ ] CI job exists and runs on every PR

## Blocked by

- #$SEC202 (SEC-202: Rate Limiting)
- #$SEC204 (SEC-204: Audit Chain)
- #$SEC206 (SEC-206: Lock Resilience)" \
  | awk -F'/' '{print $NF}')
echo "Created SEC-207 → issue #$SEC207"

echo ""
echo "✓ All 4 remaining Phase 2 Security issues created."
echo ""
echo "Dependency graph:"
echo "  #$SEC202  (SEC-202: Rate Limiting)          ← start immediately"
echo "  #$SEC204  (SEC-204: Audit Chain)             ← start immediately"
echo "  #$SEC206  (SEC-206: Lock Resilience)         ← start immediately"
echo "  #$SEC207  (SEC-207: Regression Suite)        ← needs all three above"
echo ""
echo "Already implemented (no issues needed):"
echo "  SEC-201  Session identity + role bootstrap"
echo "  SEC-203  Local storage path sandboxing"
echo "  SEC-205  Command authorization policy table"
