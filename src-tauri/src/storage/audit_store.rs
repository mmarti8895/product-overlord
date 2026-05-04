use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use crate::domain::audit::AuditLogEntry;
use crate::errors::AppError;

const AUDIT_FILE_NAME: &str = "audit-log.jsonl";

/// Append-only audit log store backed by a local JSONL file.
///
/// Each line in the file is one serialized `AuditLogEntry`.
/// Entries are never mutated or deleted in-place.
pub struct AuditStore {
    path: PathBuf,
    write_lock: Mutex<()>,
}

impl AuditStore {
    pub fn new() -> Self {
        Self {
            path: default_audit_path(),
            write_lock: Mutex::new(()),
        }
    }

    #[cfg(test)]
    pub fn with_path(path: PathBuf) -> Self {
        Self {
            path,
            write_lock: Mutex::new(()),
        }
    }

    pub fn append(&self, entry: &AuditLogEntry) -> Result<(), AppError> {
        let _guard = self.write_lock.lock().unwrap();

        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|err| {
                AppError::Storage(format!("failed to create audit directory: {err}"))
            })?;
        }

        let serialized = serde_json::to_string(entry)
            .map_err(|err| AppError::Serialization(format!("failed to serialize audit entry: {err}")))?;

        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)
            .map_err(|err| AppError::Storage(format!("failed to open audit log file: {err}")))?;

        writeln!(file, "{serialized}")
            .map_err(|err| AppError::Storage(format!("failed to append audit entry: {err}")))
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
}

fn default_audit_path() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home)
            .join(".product-overlord")
            .join(AUDIT_FILE_NAME);
    }

    PathBuf::from(".product-overlord").join(AUDIT_FILE_NAME)
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
}
