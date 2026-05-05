use serde::{Deserialize, Serialize};

/// User role within the application.
/// Roles are ordered: Admin > Operator > ReadOnly.
/// Permission checks use this ordering — a higher role satisfies lower-role requirements.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    ReadOnly,
    Operator,
    Admin,
}

impl Role {
    /// Human-readable display name.
    pub fn display_name(&self) -> &'static str {
        match self {
            Role::ReadOnly => "Read Only",
            Role::Operator => "Operator",
            Role::Admin => "Admin",
        }
    }
}

/// Fine-grained permissions checked server-side before any sensitive operation.
/// Default is deny — every permission must be explicitly granted.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Permission {
    // Credentials
    ViewCredentialList,
    AddCredential,
    DeleteCredential,
    CheckCredentialHealth,

    // Notification rules
    ViewNotificationRules,
    ManageNotificationRules,

    // Repository index
    ViewRepositoryIndex,
    TriggerRepositoryIndex,

    // Jira (suggest-only — no write permissions exist in Phase 1)
    ViewJiraTickets,
    RequestTicketReview,

    // LLM
    ConfigureLlmProvider,
    InvokeLlm,

    // Audit log
    ViewAuditLog,
    ExportAuditLog,

    // Administration
    AssignRoles,
    ViewSystemConfig,
    ChangeSystemConfig,
}

/// Maps a role to its permitted set of permissions.
/// Returns a `&'static [Permission]` for zero-allocation hot-path checks.
pub fn permissions_for_role(role: &Role) -> Vec<Permission> {
    match role {
        Role::ReadOnly => vec![
            Permission::ViewCredentialList,
            Permission::ViewNotificationRules,
            Permission::ViewRepositoryIndex,
            Permission::ViewJiraTickets,
            Permission::ViewAuditLog,
            Permission::ViewSystemConfig,
        ],
        Role::Operator => {
            let mut perms = permissions_for_role(&Role::ReadOnly);
            perms.extend([
                Permission::AddCredential,
                Permission::DeleteCredential,
                Permission::CheckCredentialHealth,
                Permission::ManageNotificationRules,
                Permission::TriggerRepositoryIndex,
                Permission::RequestTicketReview,
                Permission::ConfigureLlmProvider,
                Permission::InvokeLlm,
                Permission::ExportAuditLog,
                Permission::ChangeSystemConfig,
            ]);
            perms
        }
        Role::Admin => {
            let mut perms = permissions_for_role(&Role::Operator);
            perms.extend([Permission::AssignRoles]);
            perms
        }
    }
}

/// Returns `true` if the given role has the specified permission.
pub fn role_has_permission(role: &Role, permission: &Permission) -> bool {
    permissions_for_role(role).contains(permission)
}

/// Returns the minimum role required to satisfy a permission.
pub fn minimum_role_for_permission(permission: &Permission) -> Role {
    match permission {
        Permission::AssignRoles => Role::Admin,

        Permission::AddCredential
        | Permission::DeleteCredential
        | Permission::CheckCredentialHealth
        | Permission::ManageNotificationRules
        | Permission::TriggerRepositoryIndex
        | Permission::RequestTicketReview
        | Permission::ConfigureLlmProvider
        | Permission::InvokeLlm
        | Permission::ExportAuditLog
        | Permission::ChangeSystemConfig => Role::Operator,

        Permission::ViewCredentialList
        | Permission::ViewNotificationRules
        | Permission::ViewRepositoryIndex
        | Permission::ViewJiraTickets
        | Permission::ViewAuditLog
        | Permission::ViewSystemConfig => Role::ReadOnly,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn admin_has_all_operator_permissions() {
        let op_perms = permissions_for_role(&Role::Operator);
        for p in &op_perms {
            assert!(
                role_has_permission(&Role::Admin, p),
                "Admin missing operator permission: {p:?}"
            );
        }
    }

    #[test]
    fn readonly_cannot_add_credential() {
        assert!(!role_has_permission(&Role::ReadOnly, &Permission::AddCredential));
    }

    #[test]
    fn operator_can_add_credential() {
        assert!(role_has_permission(&Role::Operator, &Permission::AddCredential));
    }

    #[test]
    fn only_admin_can_assign_roles() {
        assert!(role_has_permission(&Role::Admin, &Permission::AssignRoles));
        assert!(!role_has_permission(&Role::Operator, &Permission::AssignRoles));
        assert!(!role_has_permission(&Role::ReadOnly, &Permission::AssignRoles));
    }

    #[test]
    fn role_ordering_is_correct() {
        assert!(Role::Admin > Role::Operator);
        assert!(Role::Operator > Role::ReadOnly);
    }

    #[test]
    fn role_serde_round_trip() {
        let role = Role::Operator;
        let json = serde_json::to_string(&role).unwrap();
        let decoded: Role = serde_json::from_str(&json).unwrap();
        assert_eq!(role, decoded);
    }

    #[test]
    fn minimum_role_is_admin_for_assign_roles() {
        assert_eq!(minimum_role_for_permission(&Permission::AssignRoles), Role::Admin);
    }

    #[test]
    fn minimum_role_is_operator_for_trigger_index() {
        assert_eq!(
            minimum_role_for_permission(&Permission::TriggerRepositoryIndex),
            Role::Operator
        );
    }

    #[test]
    fn minimum_role_is_readonly_for_view_index() {
        assert_eq!(
            minimum_role_for_permission(&Permission::ViewRepositoryIndex),
            Role::ReadOnly
        );
    }
}
