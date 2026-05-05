import { describe, expect, it } from 'vitest';
import { hasPermission, permissionsForRole, type Permission } from './capabilities';

const ALL_PERMISSIONS: Permission[] = [
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
];

describe('capabilities', () => {
  it('admin is a superset of operator', () => {
    for (const permission of permissionsForRole('operator')) {
      expect(hasPermission('admin', permission)).toBe(true);
    }
  });

  it('operator is a superset of read_only', () => {
    for (const permission of permissionsForRole('read_only')) {
      expect(hasPermission('operator', permission)).toBe(true);
    }
  });

  it('only admin can assign roles', () => {
    expect(hasPermission('admin', 'assign_roles')).toBe(true);
    expect(hasPermission('operator', 'assign_roles')).toBe(false);
    expect(hasPermission('read_only', 'assign_roles')).toBe(false);
  });

  it('read_only permissions match backend policy posture', () => {
    for (const permission of ALL_PERMISSIONS) {
      const allowed = hasPermission('read_only', permission);
      const expected = [
        'view_credential_list',
        'view_notification_rules',
        'view_repository_index',
        'view_jira_tickets',
        'view_audit_log',
        'view_system_config',
      ].includes(permission);
      expect(allowed).toBe(expected);
    }
  });
});
