import { get, writable } from 'svelte/store';
import { navigation } from '$lib/stores/navigation';
import { ticketQueue } from '$lib/stores/ticketQueue';
import { dorStore, type ScaffoldView } from '$lib/stores/dor';
import { credentials, type CredentialView } from '$lib/stores/credentials';
import type { UIState } from '$lib/tauri/invoke';

type StepStatus = 'success' | 'degraded' | 'error' | 'permission_denied';
type RunStatus = StepStatus;
export type RoutineName = 'daily_review' | 'planning_readiness';

export interface RoutineStep {
  name: string;
  status: StepStatus;
  message: string;
}

export interface RoutineRun {
  routine: RoutineName;
  startedAt: string;
  completedAt: string;
  status: RunStatus;
  steps: RoutineStep[];
}

export interface RoutineDeps {
  activate: typeof navigation.activate;
  getActiveTicket: () => string | null;
  loadScaffold: (ticketKey: string) => Promise<void>;
  getScaffoldState: () => UIState<ScaffoldView>;
  createScaffold: (ticketKey: string) => Promise<UIState<unknown>>;
  listScaffolds: () => Promise<void>;
  refreshCredentials: () => Promise<void>;
  getCredentialsState: () => UIState<CredentialView[]>;
  checkCredentialHealth: (id: string) => Promise<void>;
}

function defaultDeps(): RoutineDeps {
  return {
    activate: navigation.activate,
    getActiveTicket: () => get(ticketQueue.activeKey),
    loadScaffold: dorStore.load,
    getScaffoldState: () => get(dorStore.scaffold),
    createScaffold: async (ticketKey: string) => dorStore.create(ticketKey),
    listScaffolds: dorStore.list,
    refreshCredentials: credentials.refresh,
    getCredentialsState: () => get(credentials),
    checkCredentialHealth: credentials.checkHealth,
  };
}

function finalStatus(steps: RoutineStep[]): RunStatus {
  if (steps.some((s) => s.status === 'error')) return 'error';
  if (steps.some((s) => s.status === 'permission_denied')) return 'permission_denied';
  if (steps.some((s) => s.status === 'degraded')) return 'degraded';
  return 'success';
}

function createRoutineStore(deps: RoutineDeps = defaultDeps()) {
  const runs = writable<RoutineRun[]>([]);
  const activeRoutine = writable<RoutineName | null>(null);

  function pushRun(run: RoutineRun) {
    runs.update((items) => [run, ...items].slice(0, 20));
  }

  async function runDailyReview(): Promise<RoutineRun> {
    activeRoutine.set('daily_review');
    const steps: RoutineStep[] = [];
    const startedAt = new Date().toISOString();

    const navTickets = await deps.activate('tickets');
    steps.push({ name: 'open_ticket_queue', status: navTickets.status, message: navTickets.message });

    const activeTicket = deps.getActiveTicket();
    if (activeTicket) {
      await deps.loadScaffold(activeTicket);
      const scaffoldState = deps.getScaffoldState();
      if (scaffoldState.status === 'empty') {
        const created = await deps.createScaffold(activeTicket);
        steps.push({
          name: 'ensure_scaffold_exists',
          status: created.status === 'success'
            ? 'success'
            : created.status === 'permission_denied'
              ? 'permission_denied'
              : 'error',
          message: created.status === 'success'
            ? `Scaffold created for ${activeTicket}.`
            : created.status === 'permission_denied' || created.status === 'error'
              ? created.message
              : 'Unable to create scaffold.',
        });
      } else {
        steps.push({ name: 'ensure_scaffold_exists', status: 'success', message: `Scaffold available for ${activeTicket}.` });
      }

      await deps.listScaffolds();
      steps.push({ name: 'refresh_scaffold_index', status: 'success', message: 'Scaffold index refreshed.' });
    } else {
      steps.push({ name: 'ensure_scaffold_exists', status: 'degraded', message: 'No active ticket selected.' });
    }

    await deps.refreshCredentials();
    const credentialState = deps.getCredentialsState();
    if (credentialState.status === 'success') {
      for (const item of credentialState.data) {
        await deps.checkCredentialHealth(item.credential.id);
      }
      steps.push({
        name: 'integration_health_snapshot',
        status: 'success',
        message: `Checked ${credentialState.data.length} credential health entries.`,
      });
    } else if (credentialState.status === 'permission_denied') {
      steps.push({
        name: 'integration_health_snapshot',
        status: 'permission_denied',
        message: credentialState.message,
      });
    } else {
      steps.push({
        name: 'integration_health_snapshot',
        status: 'degraded',
        message: 'Credential state unavailable for health snapshot.',
      });
    }

    const navCommand = await deps.activate('command');
    steps.push({ name: 'return_to_command_deck', status: navCommand.status, message: navCommand.message });

    const completedAt = new Date().toISOString();
    const run: RoutineRun = {
      routine: 'daily_review',
      startedAt,
      completedAt,
      status: finalStatus(steps),
      steps,
    };
    pushRun(run);
    activeRoutine.set(null);
    return run;
  }

  async function runPlanningReadiness(): Promise<RoutineRun> {
    activeRoutine.set('planning_readiness');
    const steps: RoutineStep[] = [];
    const startedAt = new Date().toISOString();

    const navTickets = await deps.activate('tickets');
    steps.push({ name: 'open_ticket_queue', status: navTickets.status, message: navTickets.message });

    await deps.listScaffolds();
    steps.push({ name: 'refresh_scaffold_index', status: 'success', message: 'Scaffold index refreshed.' });

    const activeTicket = deps.getActiveTicket();
    if (activeTicket) {
      await deps.loadScaffold(activeTicket);
      const scaffoldState = deps.getScaffoldState();
      if (scaffoldState.status === 'empty') {
        const created = await deps.createScaffold(activeTicket);
        steps.push({
          name: 'remediate_missing_scaffold',
          status: created.status === 'success'
            ? 'success'
            : created.status === 'permission_denied'
              ? 'permission_denied'
              : 'error',
          message: created.status === 'success'
            ? `Scaffold created for ${activeTicket}.`
            : created.status === 'permission_denied' || created.status === 'error'
              ? created.message
              : 'Unable to remediate missing scaffold.',
        });
      } else {
        steps.push({ name: 'remediate_missing_scaffold', status: 'success', message: 'Scaffold already exists.' });
      }
    } else {
      steps.push({ name: 'remediate_missing_scaffold', status: 'degraded', message: 'No active ticket selected.' });
    }

    const navAudit = await deps.activate('audit');
    steps.push({ name: 'audit_checkpoint', status: navAudit.status, message: navAudit.message });

    const navCommand = await deps.activate('command');
    steps.push({ name: 'return_to_command_deck', status: navCommand.status, message: navCommand.message });

    const completedAt = new Date().toISOString();
    const run: RoutineRun = {
      routine: 'planning_readiness',
      startedAt,
      completedAt,
      status: finalStatus(steps),
      steps,
    };
    pushRun(run);
    activeRoutine.set(null);
    return run;
  }

  return { runs, activeRoutine, runDailyReview, runPlanningReadiness };
}

export { createRoutineStore };
export const routines = createRoutineStore();
