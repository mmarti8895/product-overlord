use tauri::State;
use uuid::Uuid;

use crate::commands::authz::require_permission;
use crate::domain::audit::{AuditAction, AuditActor, AuditLogEntry};
use crate::domain::permission::Permission;
use crate::domain::scaffolding::{EffortEstimate, TicketScaffold};
use crate::errors::AppError;
use crate::state::AppState;

fn audit(state: &AppState, action: AuditAction, details: Option<String>) {
    let entry = AuditLogEntry::new(
        action,
        AuditActor::User {
            name: "desktop".to_string(),
        },
        details,
    );
    let _ = state.audit_store.append(&entry);
}

#[tauri::command]
pub fn cmd_create_ticket_scaffold(
    state: State<'_, AppState>,
    ticket_key: String,
) -> Result<TicketScaffold, AppError> {
    require_permission(
        &state,
        Permission::RequestTicketReview,
        "create_ticket_scaffold",
    )?;

    let scaffold = state.scaffold_store.create(ticket_key)?;

    audit(
        &state,
        AuditAction::ConfigurationChanged,
        Some(format!("ticket scaffold created for {}", scaffold.ticket_key)),
    );

    Ok(scaffold)
}

#[tauri::command]
pub fn cmd_get_ticket_scaffold(
    state: State<'_, AppState>,
    ticket_key: String,
) -> Result<Option<TicketScaffold>, AppError> {
    require_permission(&state, Permission::ViewJiraTickets, "get_ticket_scaffold")?;
    state.scaffold_store.get(ticket_key)
}

#[tauri::command]
pub fn cmd_list_ticket_scaffolds(
    state: State<'_, AppState>,
) -> Result<Vec<TicketScaffold>, AppError> {
    require_permission(&state, Permission::ViewJiraTickets, "list_ticket_scaffolds")?;
    Ok(state.scaffold_store.list())
}

#[tauri::command]
pub fn cmd_set_dor_item_status(
    state: State<'_, AppState>,
    ticket_key: String,
    item_id: String,
    done: bool,
) -> Result<TicketScaffold, AppError> {
    require_permission(
        &state,
        Permission::RequestTicketReview,
        "set_dor_item_status",
    )?;

    let id = Uuid::parse_str(&item_id)
        .map_err(|_| AppError::Validation(format!("invalid dor item id: {item_id}")))?;

    let scaffold = state.scaffold_store.set_dor_item_status(ticket_key, id, done)?;

    audit(
        &state,
        AuditAction::ConfigurationChanged,
        Some(format!(
            "ticket scaffold DoR updated for {}, item={}, done={done}",
            scaffold.ticket_key, id
        )),
    );

    Ok(scaffold)
}

#[tauri::command]
pub fn cmd_set_acceptance_criteria(
    state: State<'_, AppState>,
    ticket_key: String,
    criteria: Vec<String>,
) -> Result<TicketScaffold, AppError> {
    require_permission(
        &state,
        Permission::RequestTicketReview,
        "set_acceptance_criteria",
    )?;

    let scaffold = state
        .scaffold_store
        .set_acceptance_criteria(ticket_key, criteria)?;

    audit(
        &state,
        AuditAction::ConfigurationChanged,
        Some(format!(
            "ticket scaffold acceptance criteria updated for {}",
            scaffold.ticket_key
        )),
    );

    Ok(scaffold)
}

#[tauri::command]
pub fn cmd_set_effort_estimate(
    state: State<'_, AppState>,
    ticket_key: String,
    estimate: EffortEstimate,
) -> Result<TicketScaffold, AppError> {
    require_permission(
        &state,
        Permission::RequestTicketReview,
        "set_effort_estimate",
    )?;

    let scaffold = state.scaffold_store.set_effort_estimate(ticket_key, estimate)?;

    audit(
        &state,
        AuditAction::ConfigurationChanged,
        Some(format!(
            "ticket scaffold effort estimate updated for {}",
            scaffold.ticket_key
        )),
    );

    Ok(scaffold)
}
