use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use sha2::{Digest, Sha256};

use crate::domain::audit::{AuditIntegrityReport, AuditLogEntry};
use crate::errors::AppError;
use crate::storage::path_policy::{app_storage_root, enforce_storage_root};

const AUDIT_FILE_NAME: &str = "audit-log.jsonl";
const CHAIN_VERSION: u8 = 1;

/// Append-only audit log store backed by a local JSONL file.
///
/// Each line in the file is one serialized `AuditLogEntry`.
/// Entries are never mutated or deleted in-place.
pub struct AuditStore {
    path: PathBuf,
    /// SEC-203.4: all writes must be confined to this root.
    allowed_root: PathBuf,
    write_lock: Mutex<()>,
}

impl AuditStore {
    pub fn new() -> Self {
        Self {
            path: default_audit_path(),
            allowed_root: app_storage_root(),
            write_lock: Mutex::new(()),
        }
    }

    #[cfg(test)]
    pub fn with_path(path: PathBuf) -> Self {
        // In tests the file lives under a temp directory; use its parent as the
        // allowed root so path-policy enforcement does not reject it.
        let allowed_root = path
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(std::env::temp_dir);
        Self {
            path,
            allowed_root,
            write_lock: Mutex::new(()),
        }
    }

    pub fn append(&self, entry: &AuditLogEntry) -> Result<(), AppError> {
        let _guard = self.write_lock.lock().unwrap();

        // SEC-203.4: confine the audit file to the app storage root.
        enforce_storage_root(&self.path, &self.allowed_root)?;

        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|err| {
                AppError::Storage(format!("failed to create audit directory: {err}"))
            })?;
        }

        // SEC-204.3: read previous entry hash to build chain link.
        let prev_hash = self.last_entry_hash_unlocked()?;
        let mut chained = entry.clone();
        let hash = compute_entry_hash(&prev_hash, &chained);
        chained.chain_version = Some(CHAIN_VERSION);
        chained.prev_hash = Some(prev_hash);
        chained.entry_hash = Some(hash);

        let serialized = serde_json::to_string(&chained)
            .map_err(|err| AppError::Serialization(format!("failed to serialize audit entry: {err}")))?;

        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)
            .map_err(|err| AppError::Storage(format!("failed to open audit log file: {err}")))?;

        writeln!(file, "{serialized}")
            .map_err(|err| AppError::Storage(format!("failed to append audit entry: {err}")))
    }

    /// Scan the entire log and verify the hash chain is unbroken.
    ///
    /// Legacy entries without chain fields are counted but not validated.
    /// The first broken link is reported with a 1-based line number.
    pub fn verify_integrity(&self) -> Result<AuditIntegrityReport, AppError> {
        let entries = self.read_all()?;
        let total = entries.len();
        let mut chained = 0usize;
        let mut expected_prev = String::new(); // empty string before entry #0

        for (idx, entry) in entries.iter().enumerate() {
            let line = idx + 1;

            // Legacy entry — skip chain check but note it.
            let Some(version) = entry.chain_version else {
                continue;
            };

            if version != CHAIN_VERSION {
                return Ok(AuditIntegrityReport {
                    ok: false,
                    total_entries: total,
                    chained_entries: chained,
                    first_invalid_line: Some(line),
                    reason: Some(format!(
                        "unknown chain_version {version} at line {line}"
                    )),
                });
            }

            let Some(prev_hash) = &entry.prev_hash else {
                return Ok(AuditIntegrityReport {
                    ok: false,
                    total_entries: total,
                    chained_entries: chained,
                    first_invalid_line: Some(line),
                    reason: Some(format!("missing prev_hash at line {line}")),
                });
            };

            let Some(recorded_hash) = &entry.entry_hash else {
                return Ok(AuditIntegrityReport {
                    ok: false,
                    total_entries: total,
                    chained_entries: chained,
                    first_invalid_line: Some(line),
                    reason: Some(format!("missing entry_hash at line {line}")),
                });
            };

            // Verify prev_hash matches expected.
            if prev_hash != &expected_prev {
                return Ok(AuditIntegrityReport {
                    ok: false,
                    total_entries: total,
                    chained_entries: chained,
                    first_invalid_line: Some(line),
                    reason: Some(format!(
                        "prev_hash mismatch at line {line}: chain broken or entry deleted"
                    )),
                });
            }

            // Recompute and verify entry_hash.
            let recomputed = compute_entry_hash(prev_hash, entry);
            if &recomputed != recorded_hash {
                return Ok(AuditIntegrityReport {
                    ok: false,
                    total_entries: total,
                    chained_entries: chained,
                    first_invalid_line: Some(line),
                    reason: Some(format!(
                        "entry_hash mismatch at line {line}: entry content was modified"
                    )),
                });
            }

            chained += 1;
            expected_prev = recorded_hash.clone();
        }

        Ok(AuditIntegrityReport {
            ok: true,
            total_entries: total,
            chained_entries: chained,
            first_invalid_line: None,
            reason: None,
        })
    }

    pub fn read_all(&self) -> Result<Vec<AuditLogEntry>, AppError> {
        if !self.path.exists() {
            return Ok(Vec::new());
        }

        let file = OpenOptions::new()
            .read(true)
            .open(&self.path)
            .map_err(|err| AppError::Storage(format!("failed to open audit log file: {err}")))?;

        let reader = BufReader::new(file);
        let mut entries = Vec::new();

        for line in reader.lines() {
            let raw = line.map_err(|err| {
                AppError::Storage(format!("failed to read audit log line: {err}"))
            })?;

            if raw.trim().is_empty() {
                continue;
            }

            let entry: AuditLogEntry = serde_json::from_str(&raw)
                .map_err(|err| AppError::Serialization(format!("invalid audit log entry: {err}")))?;
            entries.push(entry);
        }

        Ok(entries)
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Read the `entry_hash` of the last entry in the log without re-acquiring
    /// the write lock (caller must already hold it).
    fn last_entry_hash_unlocked(&self) -> Result<String, AppError> {
        if !self.path.exists() {
            return Ok(String::new());
        }
        // Read the final non-empty line efficiently without loading the whole file.
        let file = OpenOptions::new()
            .read(true)
            .open(&self.path)
            .map_err(|err| AppError::Storage(format!("failed to open audit log: {err}")))?;
        let reader = BufReader::new(file);
        let mut last_hash = String::new();
        for line in reader.lines() {
            let raw = line.map_err(|err| {
                AppError::Storage(format!("failed to read audit log line: {err}"))
            })?;
            if raw.trim().is_empty() {
                continue;
            }
            // Parse just enough to extract entry_hash.
            let parsed: serde_json::Value = serde_json::from_str(&raw).map_err(|err| {
                AppError::Serialization(format!("invalid audit log entry: {err}"))
            })?;
            if let Some(h) = parsed.get("entry_hash").and_then(|v| v.as_str()) {
                last_hash = h.to_string();
            }
        }
        Ok(last_hash)
    }
}

fn default_audit_path() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home)
            .join(".product-overlord")
            .join(AUDIT_FILE_NAME);
    }

    PathBuf::from(".product-overlord").join(AUDIT_FILE_NAME)
}

/// Produce a canonical JSON blob for hashing that omits the three chain fields.
///
/// We serialize to a `serde_json::Value`, strip the chain fields, sort keys,
/// then serialize to a compact string. Key sorting ensures field insertion order
/// (which varies across serde derives) never changes the hash.
fn canonical_json_for_hash(entry: &AuditLogEntry) -> Result<String, AppError> {
    let mut v = serde_json::to_value(entry)
        .map_err(|e| AppError::Serialization(format!("hash serialization failed: {e}")))?;

    if let Some(obj) = v.as_object_mut() {
        obj.remove("chain_version");
        obj.remove("prev_hash");
        obj.remove("entry_hash");
    }

    // Sort keys for deterministic output.
    let sorted = sort_json_keys(v);
    serde_json::to_string(&sorted)
        .map_err(|e| AppError::Serialization(format!("hash serialization failed: {e}")))
}

/// Recursively sort object keys so the canonical form is stable.
fn sort_json_keys(v: serde_json::Value) -> serde_json::Value {
    match v {
        serde_json::Value::Object(map) => {
            let mut sorted: serde_json::Map<String, serde_json::Value> =
                serde_json::Map::new();
            let mut keys: Vec<String> = map.keys().cloned().collect();
            keys.sort();
            for k in keys {
                let val = map[&k].clone();
                sorted.insert(k, sort_json_keys(val));
            }
            serde_json::Value::Object(sorted)
        }
        serde_json::Value::Array(arr) => {
            serde_json::Value::Array(arr.into_iter().map(sort_json_keys).collect())
        }
        other => other,
    }
}

/// Compute `SHA-256(prev_hash_bytes || canonical_json_bytes)` and return hex.
fn compute_entry_hash(prev_hash: &str, entry: &AuditLogEntry) -> String {
    let canonical = canonical_json_for_hash(entry)
        .unwrap_or_else(|_| format!("fallback:{}", entry.id));
    let mut hasher = Sha256::new();
    hasher.update(prev_hash.as_bytes());
    hasher.update(canonical.as_bytes());
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::audit::{AuditAction, AuditActor, AuditLogEntry};
    use uuid::Uuid;

    fn temp_audit_path() -> PathBuf {
        std::env::temp_dir().join(format!("product-overlord-audit-{}.jsonl", Uuid::new_v4()))
    }

    #[test]
    fn append_creates_file_and_persists_entry() {
        let path = temp_audit_path();
        let store = AuditStore::with_path(path.clone());

        let entry = AuditLogEntry::new(
            AuditAction::AppStarted,
            AuditActor::System,
            Some("boot".to_string()),
        );

        store.append(&entry).unwrap();

        assert!(path.exists());
        let entries = store.read_all().unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].id, entry.id);
    }

    #[test]
    fn append_is_strictly_additive() {
        let path = temp_audit_path();
        let store = AuditStore::with_path(path.clone());

        let a = AuditLogEntry::new(AuditAction::AppStarted, AuditActor::System, None);
        let b = AuditLogEntry::new(AuditAction::AppShutdown, AuditActor::System, None);

        store.append(&a).unwrap();
        store.append(&b).unwrap();

        let entries = store.read_all().unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].id, a.id);
        assert_eq!(entries[1].id, b.id);
    }

    #[test]
    fn read_all_returns_empty_when_file_missing() {
        let path = temp_audit_path();
        let store = AuditStore::with_path(path);
        assert!(store.read_all().unwrap().is_empty());
    }

    // ── SEC-204 chain tests ───────────────────────────────────────────────────

    #[test]
    fn append_sets_chain_fields_on_written_entries() {
        let path = temp_audit_path();
        let store = AuditStore::with_path(path.clone());

        let entry = AuditLogEntry::new(AuditAction::AppStarted, AuditActor::System, None);
        store.append(&entry).unwrap();

        let entries = store.read_all().unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].chain_version, Some(1));
        assert_eq!(entries[0].prev_hash, Some(String::new())); // first entry
        assert!(entries[0].entry_hash.is_some());
    }

    #[test]
    fn second_entry_prev_hash_matches_first_entry_hash() {
        let path = temp_audit_path();
        let store = AuditStore::with_path(path.clone());

        let a = AuditLogEntry::new(AuditAction::AppStarted, AuditActor::System, None);
        let b = AuditLogEntry::new(AuditAction::AppShutdown, AuditActor::System, None);
        store.append(&a).unwrap();
        store.append(&b).unwrap();

        let entries = store.read_all().unwrap();
        let hash_a = entries[0].entry_hash.as_deref().unwrap();
        let prev_b = entries[1].prev_hash.as_deref().unwrap();
        assert_eq!(hash_a, prev_b, "b's prev_hash must equal a's entry_hash");
    }

    #[test]
    fn hash_is_deterministic_for_same_entry() {
        let mut entry = AuditLogEntry::new(AuditAction::AppStarted, AuditActor::System, None);
        // Fix timestamp to make it deterministic.
        entry.timestamp = chrono::DateTime::from_timestamp(0, 0).unwrap();

        let h1 = compute_entry_hash("", &entry);
        let h2 = compute_entry_hash("", &entry);
        assert_eq!(h1, h2);
    }

    #[test]
    fn verify_integrity_passes_on_clean_log() {
        let path = temp_audit_path();
        let store = AuditStore::with_path(path.clone());

        store.append(&AuditLogEntry::new(AuditAction::AppStarted, AuditActor::System, None)).unwrap();
        store.append(&AuditLogEntry::new(AuditAction::AppShutdown, AuditActor::System, None)).unwrap();

        let report = store.verify_integrity().unwrap();
        assert!(report.ok, "expected clean chain, got: {:?}", report.reason);
        assert_eq!(report.total_entries, 2);
        assert_eq!(report.chained_entries, 2);
        assert!(report.first_invalid_line.is_none());
    }

    #[test]
    fn verify_integrity_detects_modified_entry() {
        let path = temp_audit_path();
        let store = AuditStore::with_path(path.clone());

        store.append(&AuditLogEntry::new(AuditAction::AppStarted, AuditActor::System, None)).unwrap();
        store.append(&AuditLogEntry::new(AuditAction::AppShutdown, AuditActor::System, None)).unwrap();

        // Tamper: load, mutate first entry, rewrite the file.
        let raw = std::fs::read_to_string(&path).unwrap();
        let lines: Vec<&str> = raw.lines().collect();
        let mut first: serde_json::Value = serde_json::from_str(lines[0]).unwrap();
        first["details"] = serde_json::json!("TAMPERED");
        let tampered = format!("{}\n{}\n", serde_json::to_string(&first).unwrap(), lines[1]);
        std::fs::write(&path, tampered).unwrap();

        let report = store.verify_integrity().unwrap();
        assert!(!report.ok);
        assert_eq!(report.first_invalid_line, Some(1));
        assert!(report.reason.as_deref().unwrap_or("").contains("modified"));
    }

    #[test]
    fn verify_integrity_detects_deleted_middle_entry() {
        let path = temp_audit_path();
        let store = AuditStore::with_path(path.clone());

        store.append(&AuditLogEntry::new(AuditAction::AppStarted, AuditActor::System, None)).unwrap();
        store.append(&AuditLogEntry::new(AuditAction::LlmInvoked, AuditActor::System, None)).unwrap();
        store.append(&AuditLogEntry::new(AuditAction::AppShutdown, AuditActor::System, None)).unwrap();

        // Delete the second (middle) line.
        let raw = std::fs::read_to_string(&path).unwrap();
        let mut lines: Vec<&str> = raw.lines().collect();
        lines.remove(1);
        std::fs::write(&path, lines.join("\n") + "\n").unwrap();

        let report = store.verify_integrity().unwrap();
        assert!(!report.ok);
        assert!(report.reason.as_deref().unwrap_or("").contains("chain broken"));
    }

    #[test]
    fn verify_integrity_empty_log_is_ok() {
        let path = temp_audit_path();
        let store = AuditStore::with_path(path.clone());
        let report = store.verify_integrity().unwrap();
        assert!(report.ok);
        assert_eq!(report.total_entries, 0);
    }
}
