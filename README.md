# product-overlord

An autonomous AI product manager desktop app. product-overlord monitors your Jira board, analyses ticket quality against your Definition of Ready, invokes LLMs to suggest improvements, and surfaces actionable insights — all running locally on your machine with no cloud dependency.

Built with **Tauri 2 + Rust** backend and a **SvelteKit + TypeScript** frontend styled in an LCARS aesthetic.

---

## What it does

- **Credential management** — stores API keys for Jira, GitHub, and LLM providers in the OS keychain (never on disk in plaintext)
- **Ticket scaffolding** — generates structured review scaffolds for Jira tickets including Definition of Ready checklist, acceptance criteria, and effort estimates
- **LLM integration** — routes prompts to OpenAI, Anthropic, Google Gemini, Ollama (local), or Atlassian Rovo
- **Repository index** — bootstraps a local LanceDB vector store for semantic repository search
- **Audit log** — append-only tamper-evident log of every privileged action with SHA-256 hash chain verification
- **Session-based auth** — role-gated access (ReadOnly / Operator / Admin) with TTL-bounded sessions; all protected commands fail-closed when the session is locked or expired
- **Input validation** — server-side JQL, cron expression, and base URL validators exposed as Tauri commands

---

## Getting started

### Prerequisites

| Tool | Version |
|---|---|
| [Rust](https://rustup.rs/) | 1.77+ |
| [Node.js](https://nodejs.org/) | 20+ |
| [pnpm](https://pnpm.io/) | 9+ |
| [Tauri CLI prerequisites](https://v2.tauri.app/start/prerequisites/) | system libs for your OS |

### Install and run

```bash
# Install frontend dependencies
pnpm install

# Run in development mode (hot-reload frontend, auto-recompile Rust)
pnpm tauri dev
```

### Build for production

```bash
pnpm tauri build
```

---

## Supported LLM providers

| Provider | Type | Notes |
|---|---|---|
| **OpenAI** | Cloud | Requires API key stored in OS keychain |
| **Anthropic** | Cloud | Requires API key stored in OS keychain |
| **Google Gemini** | Cloud | Requires API key stored in OS keychain |
| **Ollama** | Local | No key required; configure base URL (default `http://localhost:11434`) |
| **Atlassian Rovo** | Cloud | Requires Rovo API credential |

Configure a provider via `cmd_configure_llm_provider`. Each provider configuration stores:
- Target model name
- Optional custom base URL (validated server-side before persistence)
- Optional credential reference (OS keychain entry, never serialized to disk)

> **Phase 1 note:** LLM invocations return stub responses. Live model inference is wired in Phase 2.

---

## Directory structure

```
product-overlord/
├── src/                        # SvelteKit frontend
│   └── routes/                 # Page components (LCARS UI)
├── src-tauri/                  # Rust/Tauri backend
│   ├── src/
│   │   ├── lib.rs              # Tauri app entry, command registration (26 commands)
│   │   ├── state.rs            # Shared AppState (all stores + session manager)
│   │   ├── errors.rs           # Typed AppError enum (PermissionDenied, Validation, Storage, …)
│   │   ├── sync_utils.rs       # lock_or_internal — poison-safe mutex helper (SEC-206)
│   │   ├── commands/           # Tauri command handlers
│   │   │   ├── audit.rs        # append_user_audit helper + cmd_verify_audit_integrity
│   │   │   ├── authz.rs        # effective_role(), require_permission() — session-aware
│   │   │   ├── credential.rs   # add / delete / list / health-check credentials
│   │   │   ├── index.rs        # initialize / health-check LanceDB index store
│   │   │   ├── llm.rs          # configure / list / invoke LLM providers
│   │   │   ├── permission.rs   # get / set active session role
│   │   │   ├── scaffolding.rs  # create / get / list ticket scaffolds
│   │   │   ├── session.rs      # unlock / lock / status session lifecycle
│   │   │   └── validation.rs   # JQL / cron / URL validation commands
│   │   ├── domain/             # Pure domain types (no I/O)
│   │   │   ├── audit.rs        # AuditLogEntry (with SEC-204 hash chain fields), AuditIntegrityReport
│   │   │   ├── credential.rs   # IntegrationCredential, Provider enum
│   │   │   ├── llm.rs          # LlmProvider, LlmProviderConfig, LlmInvocationRequest/Response
│   │   │   ├── notification.rs # NotificationRule domain type
│   │   │   ├── permission.rs   # Role (ReadOnly/Operator/Admin), Permission enum, role→permission mapping
│   │   │   ├── repository.rs   # Repository domain type
│   │   │   ├── scaffolding.rs  # TicketScaffold, EffortEstimate, DoR checklist
│   │   │   └── ticket.rs       # Jira ticket domain type
│   │   ├── llm/
│   │   │   └── mod.rs          # LlmGateway — routes invocations to provider clients
│   │   ├── security/
│   │   │   └── command_policy.rs  # Authoritative command policy table (SEC-205); completeness guard
│   │   ├── session/
│   │   │   └── mod.rs          # SessionManager, SessionState, TTL enforcement (SEC-201)
│   │   ├── storage/
│   │   │   ├── audit_store.rs  # Append-only JSONL audit log with SHA-256 hash chain (SEC-204)
│   │   │   ├── credential_store.rs  # In-memory metadata + OS keychain secret storage
│   │   │   ├── index_store.rs  # LanceDB local vector store bootstrap
│   │   │   ├── path_policy.rs  # Path sandboxing: confine all writes to ~/.product-overlord/ (SEC-203)
│   │   │   └── scaffold_store.rs    # In-memory ticket scaffold store
│   │   └── validation/         # JQL, cron, and URL validators (pure Rust, no I/O)
│   └── Cargo.toml
├── tests/                      # Frontend test suite (Vitest)
├── openspec/                   # OpenAPI specs and change records
├── static/                     # Static assets
├── svelte.config.js
└── vite.config.js
```

---

## Testing

### Run all tests

```bash
# Full validation (frontend typecheck → Vitest → build → Rust check → Rust tests)
pnpm check && pnpm test && pnpm build && cd src-tauri && cargo check && cargo test

# Rust tests only
cd src-tauri && cargo test

# Frontend typecheck only
pnpm check

# Frontend unit tests only
pnpm test
```

### Test coverage (149 Rust unit tests)

| Module | Tests | What's covered |
|---|---|---|
| `validation::cron` | 15 | Valid/invalid cron expressions, field ranges, aliases |
| `validation::url` | 14 | Scheme whitelist, localhost gating, traversal rejection, length cap |
| `validation::jql` | 12 | JQL keyword detection, injection chars, length limit |
| `storage::credential_store` | 12 | Add/delete/list, keychain stub, duplicate handling |
| `commands::authz` | 12 | Locked/expired/role-denied sessions, poisoned lock resilience |
| `storage::audit_store` | 10 | Append, read-all, hash chain linkage, tamper detection |
| `security::command_policy` | 9 | Policy completeness, no duplicates, PublicLocalOnly assertions |
| `domain::permission` | 9 | Role ordering, permission→role mapping, grant checks |
| `storage::path_policy` | 7 | In-root acceptance, traversal rejection, symlink escape, sibling rejection |
| `storage::scaffold_store` | 5 | CRUD, DoR status update, effort estimate |
| `storage::index_store` | 5 | Init, health check, URI validation, path confinement |
| `llm` | 4 | Provider config, stub invocation, disabled provider rejection |
| `errors` | 4 | Frontend-safe message masking, `Internal` variant |
| `domain::ticket` | 4 | Ticket domain type construction |
| `domain::repository` | 4 | Repository domain type |
| `domain::notification` | 4 | Notification rule domain type |
| `commands::session` | 4 | Unlock/lock lifecycle, TTL clamping, blank principal rejection |
| `domain::scaffolding` | 3 | Scaffold construction, DoR item defaults |
| `domain::credential` | 3 | Credential metadata, provider enum |
| `domain::audit` | 3 | Unique IDs, timestamp presence, correlation ID |

Frontend: 1 Vitest smoke test (build artifact validation).

---

## Security model

All protected commands require an active, non-expired session. The session is unlocked via `cmd_unlock_session` with a principal ID, role, and optional TTL (1–480 minutes, default 60). Every command is mapped to a policy in `security/command_policy.rs` — a compile-time completeness guard fails if any registered command is missing a policy entry.

Key controls implemented:

| Control | Location |
|---|---|
| Session-gated authorization | `commands/authz.rs` |
| Role-based permission table | `domain/permission.rs` |
| Command policy registry | `security/command_policy.rs` |
| Path sandboxing (all writes confined to `~/.product-overlord/`) | `storage/path_policy.rs` |
| Tamper-evident audit chain (SHA-256 HMAC chain) | `storage/audit_store.rs` |
| Poisoned-lock resilience (no `unwrap` on mutex in command paths) | `sync_utils.rs` |

---

## Recommended IDE setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
