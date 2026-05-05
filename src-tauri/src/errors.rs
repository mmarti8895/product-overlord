use thiserror::Error;

use crate::domain::permission::Role;

/// Typed application error used across all Rust modules.
/// All variants carry enough context for structured logging and
/// frontend-safe display (no raw secrets or internal paths).
#[derive(Debug, Error)]
pub enum AppError {
    /// A credential operation failed (create, read, delete).
    #[error("credential error: {0}")]
    Credential(String),

    /// The caller lacks the required role for the requested action.
    #[error("permission denied: '{action}' requires role {required_role:?}")]
    PermissionDenied {
        action: String,
        required_role: Role,
    },

    /// Input failed validation (JQL, cron expression, URL format, etc.).
    #[error("validation error: {0}")]
    Validation(String),

    /// A storage-layer operation failed (audit log, LanceDB, etc.).
    #[error("storage error: {0}")]
    Storage(String),

    /// A rate-limit policy was exceeded for the requested command.
    #[error("rate limit exceeded: {0}")]
    RateLimitExceeded(String),

    /// A provider or integration is referenced but not yet configured.
    #[error("not configured: {0}")]
    NotConfigured(String),

    /// A serialization / deserialization failure.
    #[error("serialization error: {0}")]
    Serialization(String),

    /// Catch-all for unexpected internal errors (wraps anyhow::Error).
    /// Must NOT leak sensitive details when surfaced to the frontend.
    #[error("internal error: {0}")]
    Internal(#[from] anyhow::Error),
}

impl AppError {
    /// Returns a frontend-safe display string that never leaks internal paths
    /// or credential material.  Used when serializing errors to Tauri commands.
    pub fn frontend_message(&self) -> String {
        match self {
            AppError::Internal(_) => "An unexpected internal error occurred.".to_string(),
            other => other.to_string(),
        }
    }
}

// Allow Tauri commands to return AppError as a serializable string.
impl serde::Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.frontend_message())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn credential_error_formats() {
        let e = AppError::Credential("keychain unavailable".to_string());
        assert_eq!(e.to_string(), "credential error: keychain unavailable");
    }

    #[test]
    fn permission_denied_formats() {
        let e = AppError::PermissionDenied {
            action: "delete_credential".to_string(),
            required_role: Role::Admin,
        };
        assert!(e.to_string().contains("permission denied"));
        assert!(e.to_string().contains("Admin"));
    }

    #[test]
    fn internal_error_frontend_message_is_safe() {
        let e = AppError::Internal(anyhow::anyhow!("secret path /etc/passwd"));
        // Must not expose internal detail
        assert_eq!(e.frontend_message(), "An unexpected internal error occurred.");
    }

    #[test]
    fn serialization_error_formats() {
        let e = AppError::Serialization("unexpected eof".to_string());
        assert!(e.to_string().contains("serialization error"));
    }
}
