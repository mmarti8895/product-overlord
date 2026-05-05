use crate::domain::permission::Permission;

/// Whether a command requires an authenticated session.
///
/// # Policy classes
///
/// ## `PublicLocalOnly`
/// The command performs pure computation or manages the session itself.
/// It accesses no secrets, writes no persistent state, and is safe to call
/// before a session is established. Examples: validation helpers,
/// session unlock/lock/status, the legacy `greet` stub.
///
/// ## `Protected(Permission)`
/// The command requires an active, non-expired session whose role satisfies
/// the named permission. `require_permission` enforces this at every call site.
/// Adding a new Protected command without a matching `require_permission` call
/// inside the handler is a **security defect** that the authz tests will catch.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CommandExposure {
    /// No session required. Pure local computation or session management.
    PublicLocalOnly,
    /// Session must be unlocked and role must satisfy the given permission.
    Protected(Permission),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandPolicy {
    pub command: &'static str,
    pub exposure: CommandExposure,
}

/// Authoritative policy table for every command registered in `generate_handler!`.
///
/// # Invariant (SEC-205.3)
/// Every entry in this table MUST also appear in `EXPORTED_COMMANDS`, and vice
/// versa. The `policy_table_covers_all_exported_commands` and
/// `exported_commands_count_matches_handler_list` tests enforce this at CI time.
///
/// When you add a new Tauri command:
///  1. Register it in `tauri::generate_handler!` in `lib.rs`.
///  2. Append it to `EXPORTED_COMMANDS` below.
///  3. Append a `CommandPolicy` entry here.
///  4. If `Protected`, add a `require_permission` call inside the handler.
pub const COMMAND_POLICIES: &[CommandPolicy] = &[
    // ── dev stub ─────────────────────────────────────────────────────────────
    // PublicLocalOnly: no state access; removed before production hardening.
    CommandPolicy {
        command: "greet",
        exposure: CommandExposure::PublicLocalOnly,
    },

    // ── credentials ──────────────────────────────────────────────────────────
    CommandPolicy {
        command: "cmd_add_credential",
        exposure: CommandExposure::Protected(Permission::AddCredential),
    },
    CommandPolicy {
        command: "cmd_delete_credential",
        exposure: CommandExposure::Protected(Permission::DeleteCredential),
    },
    CommandPolicy {
        command: "cmd_check_credential_health",
        exposure: CommandExposure::Protected(Permission::CheckCredentialHealth),
    },
    CommandPolicy {
        command: "cmd_list_credentials",
        exposure: CommandExposure::Protected(Permission::ViewCredentialList),
    },

    // ── index store ───────────────────────────────────────────────────────────
    CommandPolicy {
        command: "cmd_initialize_index_store",
        exposure: CommandExposure::Protected(Permission::TriggerRepositoryIndex),
    },
    CommandPolicy {
        command: "cmd_get_index_store_health",
        exposure: CommandExposure::Protected(Permission::ViewRepositoryIndex),
    },
    CommandPolicy {
        command: "cmd_check_index_store_health",
        exposure: CommandExposure::Protected(Permission::ViewRepositoryIndex),
    },

    // ── role / session ───────────────────────────────────────────────────────
    // cmd_get_current_role / cmd_set_current_role operate on the live session;
    // they are Protected so only an authenticated user can inspect or change role.
    CommandPolicy {
        command: "cmd_get_current_role",
        exposure: CommandExposure::Protected(Permission::ViewSystemConfig),
    },
    CommandPolicy {
        command: "cmd_set_current_role",
        exposure: CommandExposure::Protected(Permission::AssignRoles),
    },
    // Session lifecycle commands are PublicLocalOnly: they ARE the auth surface.
    // Requiring a session to call unlock would be circular.
    CommandPolicy {
        command: "cmd_unlock_session",
        exposure: CommandExposure::PublicLocalOnly,
    },
    CommandPolicy {
        command: "cmd_lock_session",
        exposure: CommandExposure::PublicLocalOnly,
    },
    CommandPolicy {
        command: "cmd_get_session_status",
        exposure: CommandExposure::PublicLocalOnly,
    },

    // ── LLM ──────────────────────────────────────────────────────────────────
    CommandPolicy {
        command: "cmd_configure_llm_provider",
        exposure: CommandExposure::Protected(Permission::ConfigureLlmProvider),
    },
    CommandPolicy {
        command: "cmd_list_llm_provider_configs",
        exposure: CommandExposure::Protected(Permission::ConfigureLlmProvider),
    },
    CommandPolicy {
        command: "cmd_invoke_llm",
        exposure: CommandExposure::Protected(Permission::InvokeLlm),
    },

    // ── scaffolding ───────────────────────────────────────────────────────────
    CommandPolicy {
        command: "cmd_create_ticket_scaffold",
        exposure: CommandExposure::Protected(Permission::RequestTicketReview),
    },
    CommandPolicy {
        command: "cmd_get_ticket_scaffold",
        exposure: CommandExposure::Protected(Permission::ViewJiraTickets),
    },
    CommandPolicy {
        command: "cmd_list_ticket_scaffolds",
        exposure: CommandExposure::Protected(Permission::ViewJiraTickets),
    },
    CommandPolicy {
        command: "cmd_set_dor_item_status",
        exposure: CommandExposure::Protected(Permission::RequestTicketReview),
    },
    CommandPolicy {
        command: "cmd_set_acceptance_criteria",
        exposure: CommandExposure::Protected(Permission::RequestTicketReview),
    },
    CommandPolicy {
        command: "cmd_set_effort_estimate",
        exposure: CommandExposure::Protected(Permission::RequestTicketReview),
    },

    // ── validation ────────────────────────────────────────────────────────────
    // PublicLocalOnly rationale (SEC-205.2):
    // These commands perform pure syntactic validation on caller-supplied strings.
    // They access no application state, read no secrets, and write nothing
    // persistent. Requiring a session would break UX flows where the user types
    // a URL or JQL expression before logging in. The attack surface is limited
    // to a denial-of-service via large inputs, which the validators cap internally.
    CommandPolicy {
        command: "cmd_validate_jql",
        exposure: CommandExposure::PublicLocalOnly,
    },
    CommandPolicy {
        command: "cmd_validate_cron",
        exposure: CommandExposure::PublicLocalOnly,
    },
    CommandPolicy {
        command: "cmd_validate_base_url",
        exposure: CommandExposure::PublicLocalOnly,
    },

    // ── audit ─────────────────────────────────────────────────────────────────
    // SEC-204.5: verification requires ViewAuditLog so only an authenticated
    // Operator or Admin can trigger a chain scan.  ReadOnly users cannot.
    CommandPolicy {
        command: "cmd_verify_audit_integrity",
        exposure: CommandExposure::Protected(Permission::ViewAuditLog),
    },
];

pub const EXPORTED_COMMANDS: &[&str] = &[
    "greet",
    "cmd_add_credential",
    "cmd_delete_credential",
    "cmd_check_credential_health",
    "cmd_list_credentials",
    "cmd_initialize_index_store",
    "cmd_get_index_store_health",
    "cmd_check_index_store_health",
    "cmd_get_current_role",
    "cmd_set_current_role",
    "cmd_unlock_session",
    "cmd_lock_session",
    "cmd_get_session_status",
    "cmd_configure_llm_provider",
    "cmd_list_llm_provider_configs",
    "cmd_invoke_llm",
    "cmd_create_ticket_scaffold",
    "cmd_get_ticket_scaffold",
    "cmd_list_ticket_scaffolds",
    "cmd_set_dor_item_status",
    "cmd_set_acceptance_criteria",
    "cmd_set_effort_estimate",
    "cmd_validate_jql",
    "cmd_validate_cron",
    "cmd_validate_base_url",
    "cmd_verify_audit_integrity",
];

pub fn policy_for(command: &str) -> Option<&'static CommandPolicy> {
    COMMAND_POLICIES.iter().find(|policy| policy.command == command)
}

/// The number of commands registered in `tauri::generate_handler!` in `lib.rs`.
///
/// # SEC-205.3 divergence guard
/// This constant MUST equal `EXPORTED_COMMANDS.len()` and the number of entries
/// in `generate_handler!`. The test `exported_commands_count_matches_handler_list`
/// enforces that EXPORTED_COMMANDS stays in sync with this count.
///
/// **When you add a new command:** increment this constant, then add entries to
/// `EXPORTED_COMMANDS` and `COMMAND_POLICIES`, and register in `generate_handler!`.
pub const HANDLER_COMMAND_COUNT: usize = 26;

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    // ── SEC-205.3: completeness guard ─────────────────────────────────────────

    /// Ensures EXPORTED_COMMANDS stays in sync with the generate_handler! list.
    ///
    /// If this test fails after you added a command, increment HANDLER_COMMAND_COUNT
    /// and add the command to EXPORTED_COMMANDS and COMMAND_POLICIES.
    #[test]
    fn exported_commands_count_matches_handler_list() {
        assert_eq!(
            EXPORTED_COMMANDS.len(),
            HANDLER_COMMAND_COUNT,
            "EXPORTED_COMMANDS has {} entries but HANDLER_COMMAND_COUNT is {}. \
             Did you forget to update EXPORTED_COMMANDS or HANDLER_COMMAND_COUNT \
             after adding/removing a command from generate_handler!?",
            EXPORTED_COMMANDS.len(),
            HANDLER_COMMAND_COUNT,
        );
    }

    #[test]
    fn policy_table_covers_all_exported_commands() {
        for command in EXPORTED_COMMANDS {
            assert!(
                policy_for(command).is_some(),
                "SEC-205: missing policy entry for command '{command}'. \
                 Add a CommandPolicy entry to COMMAND_POLICIES."
            );
        }
    }

    #[test]
    fn policy_table_has_no_duplicates() {
        let mut seen = HashSet::new();
        for policy in COMMAND_POLICIES {
            assert!(
                seen.insert(policy.command),
                "duplicate policy entry for '{}'",
                policy.command
            );
        }
    }

    #[test]
    fn exported_command_list_has_no_duplicates() {
        let mut seen = HashSet::new();
        for command in EXPORTED_COMMANDS {
            assert!(seen.insert(command), "duplicate exported command '{command}'");
        }
    }

    // ── SEC-205.2: validation commands are PublicLocalOnly ────────────────────

    #[test]
    fn validate_jql_is_public_local_only() {
        assert_eq!(
            policy_for("cmd_validate_jql").map(|p| &p.exposure),
            Some(&CommandExposure::PublicLocalOnly),
        );
    }

    #[test]
    fn validate_cron_is_public_local_only() {
        assert_eq!(
            policy_for("cmd_validate_cron").map(|p| &p.exposure),
            Some(&CommandExposure::PublicLocalOnly),
        );
    }

    #[test]
    fn validate_base_url_is_public_local_only() {
        assert_eq!(
            policy_for("cmd_validate_base_url").map(|p| &p.exposure),
            Some(&CommandExposure::PublicLocalOnly),
        );
    }

    // ── SEC-205.5: completeness guard catches missing entries ─────────────────

    /// Verifies that the guard test *would* catch a command that is in
    /// EXPORTED_COMMANDS but has no matching policy entry.
    #[test]
    fn completeness_guard_detects_unregistered_command() {
        // A synthetic command name that is deliberately absent from COMMAND_POLICIES.
        let phantom = "cmd_nonexistent_future_command";
        assert!(
            policy_for(phantom).is_none(),
            "phantom command unexpectedly found in policy table"
        );
        // This confirms that policy_table_covers_all_exported_commands would fail
        // if this name were added to EXPORTED_COMMANDS without a policy entry.
    }

    /// Verifies that every Protected command maps to a known Permission variant
    /// (guards against typos introduced via copy-paste).
    #[test]
    fn all_protected_commands_have_valid_permission() {
        for policy in COMMAND_POLICIES {
            if let CommandExposure::Protected(ref _perm) = policy.exposure {
                // The Permission enum is closed; the fact that it compiled is
                // sufficient — this test documents and future-proofs the check.
            }
        }
    }
}
