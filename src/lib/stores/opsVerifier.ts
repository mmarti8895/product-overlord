import { get, writable } from 'svelte/store';
import { navigation, type ShellSurface } from '$lib/stores/navigation';
import { routines, type RoutineRun } from '$lib/stores/routines';
import { hasPermission, permissionsForRole, type Permission } from '$lib/stores/capabilities';

type VerificationStatus = 'success' | 'degraded' | 'error';

export interface VerificationStep {
  name: string;
  status: VerificationStatus;
  message: string;
}

export interface OpsVerificationRun {
  checkedAt: string;
  status: VerificationStatus;
  steps: VerificationStep[];
}

export interface OpsVerifierDeps {
  activate: (surface: ShellSurface) => Promise<{ status: 'success' | 'error' | 'permission_denied'; message: string }>;
  runDailyReview: () => Promise<RoutineRun>;
  runPlanningReadiness: () => Promise<RoutineRun>;
  adminHasPermission: (permission: Permission) => boolean;
  operatorPermissions: () => ReadonlySet<Permission>;
}

function finalStatus(steps: VerificationStep[]): VerificationStatus {
  if (steps.some((s) => s.status === 'error')) return 'error';
  if (steps.some((s) => s.status === 'degraded')) return 'degraded';
  return 'success';
}

function defaultDeps(): OpsVerifierDeps {
  return {
    activate: navigation.activate,
    runDailyReview: routines.runDailyReview,
    runPlanningReadiness: routines.runPlanningReadiness,
    adminHasPermission: (permission) => hasPermission('admin', permission),
    operatorPermissions: () => permissionsForRole('operator'),
  };
}

function createOpsVerifierStore(deps: OpsVerifierDeps = defaultDeps()) {
  const runs = writable<OpsVerificationRun[]>([]);
  const running = writable(false);

  function pushRun(run: OpsVerificationRun) {
    runs.update((items) => [run, ...items].slice(0, 10));
  }

  async function runVerification(): Promise<OpsVerificationRun> {
    running.set(true);
    const steps: VerificationStep[] = [];

    const surfaceOrder: ShellSurface[] = ['command', 'tickets', 'scaffolds', 'audit', 'integrations', 'command'];
    for (const surface of surfaceOrder) {
      const result = await deps.activate(surface);
      steps.push({
        name: `surface:${surface}`,
        status: result.status === 'success' ? 'success' : result.status === 'permission_denied' ? 'degraded' : 'error',
        message: result.message,
      });
    }

    const daily = await deps.runDailyReview();
    steps.push({
      name: 'routine:daily_review',
      status: daily.status === 'success' ? 'success' : daily.status === 'degraded' || daily.status === 'permission_denied' ? 'degraded' : 'error',
      message: `Daily review finished with ${daily.status}`,
    });

    const planning = await deps.runPlanningReadiness();
    steps.push({
      name: 'routine:planning_readiness',
      status: planning.status === 'success' ? 'success' : planning.status === 'degraded' || planning.status === 'permission_denied' ? 'degraded' : 'error',
      message: `Planning readiness finished with ${planning.status}`,
    });

    const missingAdminPermissions = Array.from(deps.operatorPermissions()).filter((p) => !deps.adminHasPermission(p));
    steps.push({
      name: 'admin_superset',
      status: missingAdminPermissions.length === 0 ? 'success' : 'error',
      message: missingAdminPermissions.length === 0
        ? 'Admin includes all operator capabilities.'
        : `Admin missing ${missingAdminPermissions.length} operator capability entries.`,
    });

    const run: OpsVerificationRun = {
      checkedAt: new Date().toISOString(),
      status: finalStatus(steps),
      steps,
    };
    pushRun(run);
    running.set(false);
    return run;
  }

  return { runs, running, runVerification };
}

export { createOpsVerifierStore };
export const opsVerifier = createOpsVerifierStore();
