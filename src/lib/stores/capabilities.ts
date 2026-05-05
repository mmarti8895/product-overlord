import { derived } from 'svelte/store';
import { effectiveRole, type Role } from '$lib/stores/session';

export type Permission =
  | 'view_credential_list'
  | 'add_credential'
  | 'delete_credential'
  | 'check_credential_health'
  | 'view_notification_rules'
  | 'manage_notification_rules'
  | 'view_repository_index'
  | 'trigger_repository_index'
  | 'view_jira_tickets'
  | 'request_ticket_review'
  | 'configure_llm_provider'
  | 'invoke_llm'
  | 'view_audit_log'
  | 'export_audit_log'
  | 'assign_roles'
  | 'view_system_config'
  | 'change_system_config';

const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Permission>> = {
  read_only: new Set<Permission>([
    'view_credential_list',
    'view_notification_rules',
    'view_repository_index',
    'view_jira_tickets',
    'view_audit_log',
    'view_system_config',
  ]),
  operator: new Set<Permission>([
    'view_credential_list',
    'add_credential',
    'delete_credential',
    'check_credential_health',
    'view_notification_rules',
    'manage_notification_rules',
    'view_repository_index',
    'trigger_repository_index',
    'view_jira_tickets',
    'request_ticket_review',
    'configure_llm_provider',
    'invoke_llm',
    'view_audit_log',
    'export_audit_log',
    'view_system_config',
    'change_system_config',
  ]),
  admin: new Set<Permission>([
    'view_credential_list',
    'add_credential',
    'delete_credential',
    'check_credential_health',
    'view_notification_rules',
    'manage_notification_rules',
    'view_repository_index',
    'trigger_repository_index',
    'view_jira_tickets',
    'request_ticket_review',
    'configure_llm_provider',
    'invoke_llm',
    'view_audit_log',
    'export_audit_log',
    'assign_roles',
    'view_system_config',
    'change_system_config',
  ]),
};

function assertSuperset(higher: Role, lower: Role) {
  for (const permission of ROLE_CAPABILITIES[lower]) {
    if (!ROLE_CAPABILITIES[higher].has(permission)) {
      throw new Error(`${higher} must include ${lower} permission ${permission}`);
    }
  }
}

assertSuperset('operator', 'read_only');
assertSuperset('admin', 'operator');

export function permissionsForRole(role: Role): ReadonlySet<Permission> {
  return ROLE_CAPABILITIES[role];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return permissionsForRole(role).has(permission);
}

export const capabilities = derived(
  effectiveRole,
  ($role): ReadonlySet<Permission> => permissionsForRole($role),
);
