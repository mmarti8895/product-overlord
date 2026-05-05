use crate::domain::audit::{AuditAction, AuditActor, AuditIntegrityReport, AuditLogEntry};
use crate::errors::AppError;
use crate::state::AppState;

const AUDIT_DETAILS_MAX_LEN: usize = 1_024;

/// Append an audit entry and fail the caller if persistence fails.
///
/// Phase 1K hardening: commands no longer ignore audit write failures.
pub fn append_user_audit(
    state: &AppState,
    action: AuditAction,
    details: Option<String>,
) -> Result<(), AppError> {
    let sanitized = details.map(|d| sanitize_audit_details(&d));
    let entry = AuditLogEntry::new(
        action,
        AuditActor::User {
            name: "desktop".to_string(),
        },
        sanitized,
    );

    state.audit_store.append(&entry)
}

/// Return a full integrity report for the audit log hash chain.
///
/// SEC-204.5: This command is `Protected(ViewAuditLog)` per the policy table.
/// It does not modify state and carries no side effects.
#[tauri::command]
pub fn cmd_verify_audit_integrity(
    state: tauri::State<'_, AppState>,
) -> Result<AuditIntegrityReport, AppError> {
    use crate::commands::authz::require_permission;
    use crate::domain::permission::Permission;
    require_permission(&state, Permission::ViewAuditLog, "verify_audit_integrity")?;
    state.audit_store.verify_integrity()
}

fn sanitize_audit_details(raw: &str) -> String {
    let mut sanitized = raw
        .chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\t')
        .collect::<String>();

    if sanitized.len() > AUDIT_DETAILS_MAX_LEN {
        sanitized.truncate(AUDIT_DETAILS_MAX_LEN);
    }

    sanitized
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_strips_control_chars() {
        let out = sanitize_audit_details("ok\u{0000}\u{0008}line\n");
        assert_eq!(out, "okline\n");
    }

    #[test]
    fn sanitize_truncates_long_details() {
        let out = sanitize_audit_details(&"x".repeat(AUDIT_DETAILS_MAX_LEN + 20));
        assert_eq!(out.len(), AUDIT_DETAILS_MAX_LEN);
    }
}
