# Phase 2 Security Implementation Plan

This plan converts the Phase 1K threat-model findings into ticket-ready implementation slices.

## Scope

- Product: Product Overlord desktop app (Tauri + Rust + Svelte)
- Goal: Close high/medium security gaps found in command-surface review
- Non-goals: external SSO/OIDC, cloud IAM integration, full HSM-backed key management

## Execution Order

1. P0 identity/authorization hardening
2. P0 abuse controls for expensive commands
3. P1 path sandboxing for local storage
4. P1 tamper-evident audit integrity
5. P1 command-surface authz policy completion
6. P2 panic/poisoning resilience improvements
7. P2 security regression suite + telemetry

---

## SEC-201: Session Identity + Role Bootstrap Hardening (P0)

### Problem
Current runtime role is process-local and defaults to Admin at startup.

### Outcome
All privileged command access derives from an authenticated local session; startup no longer grants Admin implicitly.

### Implementation
- Add `session` module with:
  - `SessionState { principal_id, role, issued_at, expires_at, unlocked }`
  - `SessionManager` in `AppState`
- Replace `current_role: Mutex<Role>` usage in authorization path with session-derived role.
- Add commands:
  - `cmd_unlock_session(passphrase_or_os_biometric_stub)`
  - `cmd_lock_session()`
  - `cmd_get_session_status()`
- Change default role from Admin to locked/no-role state.
- Update `require_permission` to reject when session is locked/expired.

### Acceptance Criteria
- App starts with no effective role for protected operations.
- Protected commands fail with explicit auth error when locked.
- Unlock grants configured role for bounded session lifetime.
- Lock clears effective role immediately.

### Tests
- Unit: locked session denies every protected permission.
- Unit: unlocked Operator can invoke Operator commands but not Admin-only commands.
- Integration: session expiry causes subsequent command denial.

### Estimate
- 2-3 days

### Dependencies
- None

---

## SEC-202: Rate Limiting + Concurrency Guards for High-Cost Commands (P0)

### Problem
High-cost commands (`cmd_invoke_llm`, index init/check) can be spammed.

### Outcome
Command abuse is throttled and visible in audit.

### Implementation
- Add `security/rate_limit.rs` token-bucket (in-memory per command + global).
- Add per-command limit policies:
  - `cmd_invoke_llm`: e.g. 10/min burst 5
  - `cmd_initialize_index_store`: e.g. 3/min burst 1
  - `cmd_check_index_store_health`: e.g. 20/min burst 5
- Add single-flight guard for index initialization.
- On throttle deny, append audit event with command + counters.

### Acceptance Criteria
- Exceeding policy returns deterministic `AppError::Validation` or dedicated rate-limit error.
- Concurrent index initialization attempts collapse to one active job.
- Throttle events appear in audit log.

### Tests
- Unit: token bucket refill/deny behavior.
- Integration: repeated invoke requests throttle predictably.
- Integration: concurrent index init only allows one execution.

### Estimate
- 1-2 days

### Dependencies
- SEC-201 (recommended but not required)

---

## SEC-203: Local Storage Path Sandboxing (P1)

### Problem
Index path accepts arbitrary local directory paths.

### Outcome
All persistent writes are constrained to app-owned roots.

### Implementation
- Add `storage/path_policy.rs`:
  - canonicalize + enforce under allowed roots only
  - deny path traversal and symlink escape
- Allowed roots:
  - `$HOME/.product-overlord/` (or platform equivalent)
- Apply policy to:
  - index store init URI
  - audit store path
  - any future persistent store paths
- Emit audit on path-policy deny.

### Acceptance Criteria
- Paths outside policy root are rejected.
- Symlink escape attempts are rejected.
- Existing valid default paths continue to work.

### Tests
- Unit: canonicalization and root checks.
- Unit: `..` and symlink escape denied.
- Integration: valid in-root directory initializes successfully.

### Estimate
- 1-2 days

### Dependencies
- None

---

## SEC-204: Tamper-Evident Audit Chain (P1)

### Problem
Audit log is append-only but not tamper-evident.

### Outcome
Any post-write modification/deletion is detectable.

### Implementation
- Extend audit record with chain fields:
  - `prev_hash`, `entry_hash`, `chain_version`
- Compute `entry_hash = H(prev_hash || canonical_json(entry_without_hash))`.
- Persist periodic signed checkpoints (local key material; Phase 2 local-only).
- Add verification command:
  - `cmd_verify_audit_integrity() -> { ok, first_invalid_line, reason }`

### Acceptance Criteria
- Normal append path produces valid chain.
- Modified/deleted line causes verification failure.
- Verification result exposed to telemetry panel.

### Tests
- Unit: deterministic hash generation.
- Unit: tampered file detection.
- Integration: end-to-end append then verify passes.

### Estimate
- 2-3 days

### Dependencies
- SEC-203 (recommended for path guarantees)

---

## SEC-205: Complete Command Authorization Policy (P1)

### Problem
Validation commands are currently callable without explicit permission checks.

### Outcome
Every exposed command has explicit and documented authz posture.

### Implementation
- Add policy table mapping every Tauri command to required permission (or explicit `public_local_only`).
- Enforce authz in `commands/validation.rs` (likely `ViewSystemConfig` or `RequestTicketReview`, choose policy and document).
- Add startup assertion/test to ensure every command is present in policy table.

### Acceptance Criteria
- No command exists without declared policy classification.
- Validation commands follow chosen policy and tests reflect behavior.

### Tests
- Unit: policy completeness test fails when new command added without policy entry.
- Integration: validation command permission checks enforced.

### Estimate
- 0.5-1 day

### Dependencies
- SEC-201 (for role/session-driven enforcement)

---

## SEC-206: Poisoned Lock/Panic Resilience (P2)

### Problem
Some command paths use lock `unwrap`, risking panic-on-poison availability issues.

### Outcome
Poisoned lock conditions return controlled errors, not panics.

### Implementation
- Replace lock `unwrap()` in command/runtime paths with mapped errors.
- Introduce helper wrappers for lock acquisition (`lock_or_internal("component")`).
- Keep `unwrap` in tests where acceptable.

### Acceptance Criteria
- Command paths return safe `AppError` on lock poisoning.
- No panic in command handlers from lock acquisition.

### Tests
- Unit: simulated poisoned mutex returns error.
- Integration: command survives poisoned state with safe message.

### Estimate
- 1 day

### Dependencies
- None

---

## SEC-207: Security Regression Suite + Telemetry (P2)

### Problem
Security controls can regress without dedicated tests/observability.

### Outcome
Security behavior is test-guarded and observable.

### Implementation
- Add `tests/security/` for regression scenarios:
  - authz bypass attempts
  - rate-limit abuse
  - path sandbox violations
  - audit chain tampering
- Add counters/state in telemetry for:
  - denied permissions
  - throttled requests
  - audit integrity status
- Add CI job `cargo test security::`.

### Acceptance Criteria
- Security test suite runs in CI and fails on known bypass patterns.
- Runtime exposes security health summary (at least backend command output).

### Tests
- Security integration tests for each control class.

### Estimate
- 1-2 days

### Dependencies
- SEC-202/203/204/205

---

## Suggested Milestone Split

### Milestone A (Week 1)
- SEC-201
- SEC-202
- SEC-205

### Milestone B (Week 2)
- SEC-203
- SEC-204

### Milestone C (Week 3)
- SEC-206
- SEC-207

## Definition of Done (Phase 2 Security)

- No implicit Admin bootstrap.
- All commands have explicit policy and tests.
- High-cost commands are throttled and audited.
- Storage paths are sandboxed.
- Audit log integrity is verifiable and tamper-evident.
- Security regression tests run in CI.

---

## Task Breakdown

This section breaks each SEC ticket into implementation-sized tasks that can be completed independently.

### SEC-201 Task List

- [ ] SEC-201.1 Add session domain types and manager
  - Create session module with SessionState and SessionManager.
  - Include issued_at, expires_at, unlocked state, and role.
  - Add serde support for status DTOs returned to frontend.
- [ ] SEC-201.2 Wire SessionManager into AppState
  - Add session manager to global state.
  - Remove default implicit admin role behavior from startup path.
- [ ] SEC-201.3 Add session commands
  - Implement unlock, lock, and status commands.
  - Return explicit locked or expired errors.
- [ ] SEC-201.4 Refactor authorization path to use session role
  - Update permission checks to read role from active session.
  - Deny all protected actions when session is locked or expired.
- [ ] SEC-201.5 Add tests for locked, unlocked, and expired paths
  - Unit tests for role enforcement by session state.
  - Integration test for session expiry denial.

### SEC-202 Task List

- [ ] SEC-202.1 Add generic in-memory token bucket limiter
  - Implement refill math, burst handling, and deterministic clock abstraction for tests.
- [ ] SEC-202.2 Define command policies and defaults
  - Configure limits for invoke LLM, index initialize, and index health check.
  - Add global fallback policy.
- [ ] SEC-202.3 Add index single-flight guard
  - Ensure only one initialization is running at a time.
  - Return conflict or in-progress response for concurrent calls.
- [ ] SEC-202.4 Integrate limiter into command handlers
  - Apply before expensive work begins.
  - Return stable application error on throttle.
- [ ] SEC-202.5 Add throttling audit events
  - Include command name, policy, and current counters.
- [ ] SEC-202.6 Add limiter and concurrency tests
  - Unit tests for throttle and refill behavior.
  - Integration tests for abuse bursts and concurrent index init.

### SEC-203 Task List

- [ ] SEC-203.1 Build path policy helper module
  - Canonicalize paths and validate against allowed root list.
  - Reject traversal and invalid encodings.
- [ ] SEC-203.2 Add symlink escape protection
  - Resolve canonical path and ensure final target remains inside root.
- [ ] SEC-203.3 Apply policy to index store path ingress
  - Validate before directory creation and before connection probe.
- [ ] SEC-203.4 Apply policy to audit and future storage roots
  - Route store path construction through the same policy helper.
- [ ] SEC-203.5 Add deny-path audit records
  - Write explicit path-policy denied events with sanitized context.
- [ ] SEC-203.6 Add path policy test suite
  - Unit tests for in-root and out-of-root checks.
  - Tests for traversal and symlink escape attempts.

### SEC-204 Task List

- [ ] SEC-204.1 Extend audit record schema for hash chain
  - Add chain_version, prev_hash, and entry_hash fields.
  - Preserve backward compatibility for old records when reading.
- [ ] SEC-204.2 Implement canonical serialization for hashing
  - Ensure deterministic field order and stable bytes across runs.
- [ ] SEC-204.3 Implement chain append logic
  - Read previous hash and compute next hash during append.
  - Persist atomically with existing append-only file semantics.
- [ ] SEC-204.4 Add integrity verification service
  - Scan log, verify chain continuity, and return first failure index.
- [ ] SEC-204.5 Add integrity command surface
  - Expose verify command for UI and operational checks.
- [ ] SEC-204.6 Add tamper detection tests
  - Positive chain test and corruption tests for modified or deleted lines.

### SEC-205 Task List

- [ ] SEC-205.1 Add centralized command policy table
  - Map every exported command to required permission or explicit public classification.
- [ ] SEC-205.2 Enforce validation command authorization
  - Apply chosen permission policy to validation commands.
- [ ] SEC-205.3 Add policy completeness guard
  - Add startup or test-time assertion that all commands are represented in policy table.
- [ ] SEC-205.4 Document policy decisions
  - Add rationale for each public and protected command class.
- [ ] SEC-205.5 Add authz coverage tests
  - Ensure policy table additions are required when new commands are introduced.

### SEC-206 Task List

- [ ] SEC-206.1 Add lock helper wrappers
  - Implement lock_or_internal helper returning AppError instead of panic.
- [ ] SEC-206.2 Replace lock unwrap in runtime command paths
  - Apply helper to state and store mutex access in non-test code.
- [ ] SEC-206.3 Normalize poisoned lock error messages
  - Keep frontend-safe message while preserving useful backend context.
- [ ] SEC-206.4 Add poisoned lock tests
  - Simulate lock poisoning and verify controlled error handling.

### SEC-207 Task List

- [ ] SEC-207.1 Create security integration test folder
  - Add baseline harness and shared fixtures in tests/security.
- [ ] SEC-207.2 Add authz bypass regression tests
  - Locked session and low-role denial scenarios.
- [ ] SEC-207.3 Add rate-limit regression tests
  - Burst and sustained abuse scenarios for expensive commands.
- [ ] SEC-207.4 Add path sandbox regression tests
  - Out-of-root and traversal attempts remain denied.
- [ ] SEC-207.5 Add audit tamper regression tests
  - Verify chain check fails for modified and removed records.
- [ ] SEC-207.6 Add security telemetry output path
  - Expose denied, throttled, and integrity state via backend command.
- [ ] SEC-207.7 Add CI security test job
  - Add dedicated cargo test target for security suite.

---

## First Three Tasks To Start Immediately

- [ ] Start SEC-201.1 Session module scaffold
- [ ] Start SEC-201.2 AppState session wiring
- [ ] Start SEC-205.1 Central command policy table
