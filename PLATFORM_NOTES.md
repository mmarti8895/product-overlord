# PLATFORM_NOTES.md — product-overlord

Platform-specific behaviour notes for maintainers and contributors.

---

## Credential Store — Stronghold vs. File-Based Selection

The Desktop UI (`ui/`) stores connection credentials (Jira tokens, OpenAI API keys, GitHub PATs) via the `SecretStore` module (`src/connections/SecretStore.ts`). The store backend is chosen at runtime based on platform support:

### Selection Logic

```
Is tauri-plugin-stronghold available AND vault file is initialise-able?
  YES → use Stronghold (hardware-backed, encrypted vault)
  NO  → use EncryptedFileStore (AES-256-GCM, key derived from machine-id via PBKDF2)
```

The selection is made once at startup inside `SecretStore.init()`. The result is logged at `info` level (never the key material).

### Stronghold Path (preferred on macOS and Windows)

- **Plugin**: `tauri-plugin-stronghold` (registered in `ui/src-tauri/src/lib.rs`).
- **Vault file location**: `$CREDENTIAL_STORE_PATH` (default: `~/.product-overlord/credentials`). The file has a `.stronghold` extension and is encrypted by the Stronghold library using the app's signing key as the vault password.
- **When available**: macOS (Keychain-backed entropy), Windows (DPAPI-backed entropy), Linux with a D-Bus secret service daemon.
- **Failure mode**: If Stronghold initialisation fails (e.g. missing signing key in dev builds), `SecretStore` falls back to the file-based store automatically and emits a `warn` log.

### File-Based Store (fallback)

- **Format**: A single AES-256-GCM encrypted JSON file at `$CREDENTIAL_STORE_PATH/secrets.enc`.
- **Key derivation**: PBKDF2-SHA256, 200 000 iterations, salt = first 16 bytes of the machine-id (read from `/etc/machine-id` on Linux, `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid` on Windows, `IOPlatformUUID` on macOS). The derived key is **never** written to disk.
- **When used**: CI environments, Linux systems without a D-Bus secret service, and any environment where Stronghold initialisation throws.
- **Security posture**: Weaker than Stronghold because the encryption key is derived deterministically from the machine-id. Do not use this store on shared machines or in containerised environments without additional file-system access controls.

### Environment Variables

| Variable | Default | Notes |
|---|---|---|
| `CREDENTIAL_STORE_PATH` | `~/.product-overlord/credentials` | Directory for the vault/encrypted file |
| `CREDENTIAL_STORE_BACKEND` | `auto` | Set to `stronghold` or `file` to override auto-detection |

### Guidance for CI / Testing

- Set `CREDENTIAL_STORE_BACKEND=file` and point `CREDENTIAL_STORE_PATH` to a temp directory.
- The `ConnectionManager` unit tests (`src/tests/unit/connection-manager.test.ts`) stub `SecretStore` entirely; no real credential file is written during tests.

### Guidance for Production Deployments

- Always prefer Stronghold on end-user machines (macOS, Windows).
- On Linux servers/CI use the file-based store with a directory that has `chmod 700` permissions.
- Never commit a real `.stronghold` vault file or `secrets.enc` file to the repository.
- Rotate credentials by calling `ConnectionManager.save(provider, newConfig)` — this overwrites the stored entry in place.

---

## Tauri Plugin Registration

Stronghold is registered in `ui/src-tauri/src/lib.rs` via:

```rust
tauri_plugin_stronghold::Builder::new(|password| { … }).build()
```

The password callback is called with the Tauri app's signing key material. In debug builds (unsigned), a fixed dev password is used; this is why Stronghold gracefully degrades to the file store in development.

---

## macOS Notarisation

Stronghold requires the `com.apple.security.cs.allow-unsigned-executable-memory` entitlement on macOS. This is already present in `ui/src-tauri/entitlements.plist`. Removing it will cause Stronghold vault initialisation to fail at runtime and the app will silently fall back to the file-based store.
