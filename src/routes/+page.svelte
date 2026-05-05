<script lang="ts">
  import { onMount } from 'svelte';
  import { ticketQueue } from '$lib/stores/ticketQueue';
  import { dorStore } from '$lib/stores/dor';
  import { llmConsole } from '$lib/stores/llmConsole';
  import { effectiveRole } from '$lib/stores/session';
  import { hasPermission } from '$lib/stores/capabilities';
  import { credentials, credentialSummary } from '$lib/stores/credentials';
  import { indexHealth } from '$lib/stores/indexHealth';
  import { policyState } from '$lib/stores/policy';
  import { auditStore } from '$lib/stores/audit';
  import { opsVerifier } from '$lib/stores/opsVerifier';
  import { routines } from '$lib/stores/routines';
  import { navigation, type ShellSurface } from '$lib/stores/navigation';
  import type { LlmProvider } from '$lib/stores/llmConsole';
  import type { DorItemState, EffortBand } from '$lib/stores/dor';

  // Ephemeral LLM prompt — never persisted to store or storage.
  let llmPrompt = $state('Draft a concise PM review summary for the selected ticket.');
  let selectedProvider = $state<LlmProvider>('open_ai');

  // Store subscriptions.
  const ticketList = ticketQueue.list;
  const activeTicketKey = ticketQueue.activeKey;
  const scaffold = dorStore.scaffold;
  const scaffoldList = dorStore.scaffolds;
  const auditReport = auditStore.report;
  const auditTimeline = auditStore.timeline;
  const routineRuns = routines.runs;
  const activeRoutine = routines.activeRoutine;
  const opsVerificationRuns = opsVerifier.runs;
  const opsVerificationRunning = opsVerifier.running;
  const llmResult = llmConsole.result;
  const activeSurface = navigation.activeSurface;

  let criteriaInput = $state('');
  let effortBand = $state<EffortBand>('medium');
  let effortPoints = $state('');
  let effortConfidence = $state('80');
  let effortRationale = $state('');

  const dorStateLabel: Record<DorItemState, string> = {
    complete: 'Complete',
    incomplete: 'Incomplete',
    unknown: 'Unknown',
  };

  function priorityClass(priority: string) {
    if (priority === 'critical') return 'priority-critical';
    if (priority === 'high') return 'priority-high';
    return 'priority-medium';
  }

  async function runPreview() {
    await llmConsole.invoke_llm(selectedProvider, llmPrompt);
  }

  async function toggleDorItem(itemId: string, currentState: DorItemState) {
    const activeKey = $activeTicketKey;
    if (!activeKey) return;
    const newDone = currentState !== 'complete';
    await dorStore.setItemStatus(activeKey, itemId, newDone);
  }

  async function openSurface(surface: ShellSurface) {
    await navigation.activate(surface);
  }

  async function refreshTicketsWorkflow() {
    await openSurface('tickets');
  }

  async function openSelectedScaffold() {
    if (!$activeTicketKey) return;
    await openSurface('scaffolds');
  }

  async function createScaffoldForActiveTicket() {
    if (!$activeTicketKey) return;
    await dorStore.create($activeTicketKey);
  }

  async function saveAcceptanceCriteria() {
    if (!$activeTicketKey) return;
    const parsed = criteriaInput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    await dorStore.setAcceptanceCriteria($activeTicketKey, parsed);
  }

  async function saveEffortEstimate() {
    if (!$activeTicketKey) return;
    const parsedPoints = effortPoints.trim() ? Number(effortPoints.trim()) : null;
    const parsedConfidence = Number(effortConfidence.trim());

    await dorStore.setEffortEstimate($activeTicketKey, {
      band: effortBand,
      story_points: Number.isFinite(parsedPoints as number) ? parsedPoints : null,
      confidence: Number.isFinite(parsedConfidence) ? Math.max(0, Math.min(100, parsedConfidence)) : 80,
      rationale: effortRationale.trim() ? effortRationale.trim() : null,
    });
  }

  async function refreshScaffoldsWorkflow() {
    await openSurface('scaffolds');
    await dorStore.list();
  }

  async function runAuditCheck() {
    await openSurface('audit');
  }

  async function runDailyReviewRoutine() {
    await routines.runDailyReview();
  }

  async function runPlanningReadinessRoutine() {
    await routines.runPlanningReadiness();
  }

  async function runOpsVerification() {
    await opsVerifier.runVerification();
  }

  const canOperateTickets = $derived(hasPermission($effectiveRole, 'request_ticket_review'));
  const canInvokeLlm = $derived(hasPermission($effectiveRole, 'invoke_llm'));
  const canViewAudit = $derived(hasPermission($effectiveRole, 'view_audit_log'));

  onMount(() => {
    ticketQueue.refresh();
    dorStore.init();
  });
</script>

<section class="command-deck">
  <!-- ── Command Workflow Panel ─────────────────────────────────────────── -->
  <article class="panel command-panel">
    <header class="panel-header">
      <p class="lcars-label">Command Workflow</p>
      <h2>Operations Console</h2>
    </header>

    <div class="command-status-grid">
      <div>
        <p class="lcars-label">Role</p>
        <p class="status-value">{$effectiveRole}</p>
      </div>
      <div>
        <p class="lcars-label">Navigation Context</p>
        <p class="status-value">{$activeSurface}</p>
      </div>
      <div>
        <p class="lcars-label">Credential Health</p>
        <p class="status-value">
          {#if $credentials.status === 'success'}
            {$credentialSummary.healthy} / {$credentialSummary.total}
          {:else if $credentials.status === 'loading'}
            loading
          {:else}
            unavailable
          {/if}
        </p>
      </div>
      <div>
        <p class="lcars-label">Index Reachability</p>
        <p class="status-value">
          {#if $indexHealth.status === 'success'}
            {$indexHealth.data.reachability}
          {:else if $indexHealth.status === 'loading'}
            loading
          {:else}
            unavailable
          {/if}
        </p>
      </div>
      <div>
        <p class="lcars-label">Policy</p>
        <p class="status-value">
          {#if $policyState.status === 'success'}
            rbac_enforced
          {:else if $policyState.status === 'loading'}
            loading
          {:else}
            unavailable
          {/if}
        </p>
      </div>
    </div>

    <div class="command-actions">
      <button type="button" onclick={() => openSurface('tickets')}>Open Ticket Queue</button>
      <button type="button" onclick={() => openSurface('scaffolds')}>Open Scaffolds</button>
      <button type="button" onclick={() => openSurface('integrations')}>Open Integrations</button>
      <button type="button" onclick={() => openSurface('audit')}>Run Audit Check</button>
      <button type="button" onclick={runDailyReviewRoutine} disabled={$activeRoutine !== null}>Run Daily Review</button>
      <button type="button" onclick={runPlanningReadinessRoutine} disabled={$activeRoutine !== null}>Run Planning Readiness</button>
      <button type="button" onclick={runOpsVerification} disabled={$opsVerificationRunning}>Run E2E Verification</button>
    </div>

    {#if $activeRoutine}
      <p class="lcars-label">Routine running: {$activeRoutine}</p>
    {/if}
    {#if $opsVerificationRunning}
      <p class="lcars-label">E2E verification running...</p>
    {/if}

    <p class="lcars-label">Routine History</p>
    {#if $routineRuns.length === 0}
      <p class="lcars-label">No routines executed yet.</p>
    {:else}
      <div class="audit-timeline">
        {#each $routineRuns as run}
          <div class="audit-timeline__item audit-timeline__item--{run.status}">
            <div>
              <strong>{run.routine} ({run.status})</strong>
              <p>{run.startedAt} -> {run.completedAt}</p>
              <ul>
                {#each run.steps as step}
                  <li>{step.name}: {step.status} - {step.message}</li>
                {/each}
              </ul>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <p class="lcars-label">E2E Verification</p>
    {#if $opsVerificationRuns.length === 0}
      <p class="lcars-label">No end-to-end verification run yet.</p>
    {:else}
      {@const latest = $opsVerificationRuns[0]}
      <div class="audit-summary {latest.status === 'success' ? 'audit-summary--ok' : latest.status === 'degraded' ? 'audit-summary--warn' : 'status-err'}">
        <p class="lcars-label">Latest verification: {latest.status}</p>
        <p>Checked at: {latest.checkedAt}</p>
        <ul>
          {#each latest.steps as step}
            <li>{step.name}: {step.status} - {step.message}</li>
          {/each}
        </ul>
      </div>
    {/if}
  </article>

  <!-- ── Audit Workflow Panel ───────────────────────────────────────────── -->
  <article class="panel audit-panel">
    <header class="panel-header">
      <p class="lcars-label">Audit Workflow</p>
      <h2>Integrity & Timeline</h2>
    </header>

    <div class="command-actions">
      <button type="button" onclick={runAuditCheck} disabled={!canViewAudit}>Run Integrity Check</button>
    </div>

    {#if !canViewAudit}
      <p class="lcars-label status-warn">Read-only audit verification is unavailable for current role.</p>
    {/if}

    {#if $auditReport.status === 'loading'}
      <p class="lcars-label">Verifying audit chain…</p>
    {:else if $auditReport.status === 'empty'}
      <p class="lcars-label">No audit verification run yet.</p>
    {:else if $auditReport.status === 'error'}
      <p class="lcars-label status-err">{$auditReport.message}</p>
    {:else if $auditReport.status === 'permission_denied'}
      <p class="lcars-label status-warn">{$auditReport.message}</p>
    {:else if $auditReport.status === 'success'}
      <div class="audit-summary {$auditReport.data.ok ? 'audit-summary--ok' : 'audit-summary--warn'}">
        <p class="lcars-label">
          {$auditReport.data.ok ? 'Integrity verified' : 'Integrity degraded'}
        </p>
        <p>Chained entries: {$auditReport.data.chained_entries} / {$auditReport.data.total_entries}</p>
        {#if !$auditReport.data.ok}
          <p>First invalid line: {$auditReport.data.first_invalid_line ?? 'unknown'}</p>
          <p>Reason: {$auditReport.data.reason ?? 'unknown reason'}</p>
        {/if}
      </div>
    {/if}

    <p class="lcars-label">Verification Timeline</p>
    {#if $auditTimeline.length === 0}
      <p class="lcars-label">No verification events yet.</p>
    {:else}
      <div class="audit-timeline">
        {#each $auditTimeline as event}
          <div class="audit-timeline__item audit-timeline__item--{event.status}">
            <div>
              <strong>{event.status}</strong>
              <p>{event.summary}</p>
            </div>
            <small>{event.checkedAt}</small>
          </div>
        {/each}
      </div>
    {/if}
  </article>

  <!-- ── Ticket Queue Panel ─────────────────────────────────────────────── -->
  <article class="panel ticket-panel">
    <header class="panel-header">
      <p class="lcars-label">Ticket Review Queue</p>
      <h2>Operational Focus</h2>
    </header>

    <div class="command-actions">
      <button type="button" onclick={refreshTicketsWorkflow}>Refresh Queue</button>
      <button type="button" onclick={openSelectedScaffold} disabled={!$activeTicketKey}>Open Selected Scaffold</button>
    </div>

    {#if $ticketList.status === 'loading'}
      <p class="lcars-label">Loading…</p>
    {:else if $ticketList.status === 'empty'}
      <p class="lcars-label">No tickets in queue.</p>
    {:else if $ticketList.status === 'error'}
      <p class="lcars-label status-err">{$ticketList.message}</p>
    {:else if $ticketList.status === 'success'}
      <div class="ticket-list">
        {#each $ticketList.data as ticket}
          <button
            class="ticket-card"
            class:active={ticket.key === $activeTicketKey}
            type="button"
            onclick={() => ticketQueue.select(ticket.key)}
          >
            <div class="ticket-card__top">
              <span class={`priority-chip ${priorityClass(ticket.priority)}`}>{ticket.priority}</span>
              <strong>{ticket.key}</strong>
            </div>
            <p>{ticket.summary}</p>
            <div class="progress-track">
              <div
                class="progress-track__fill"
                style={`width:${ticket.dorCompletionRatio * 100}%`}
              ></div>
            </div>
            <small class="lcars-label">{Math.round(ticket.dorCompletionRatio * 100)}% DoR</small>
          </button>
        {/each}
      </div>
    {/if}
  </article>

  <!-- ── DoR / Scaffold Panel ───────────────────────────────────────────── -->
  <article class="panel scaffold-panel">
    <header class="panel-header">
      <p class="lcars-label">Definition of Ready</p>
      <h2>
        {$activeTicketKey ?? '—'}
      </h2>
    </header>

    <div class="command-actions">
      <button type="button" onclick={refreshScaffoldsWorkflow}>Refresh Scaffolds</button>
      <button type="button" onclick={createScaffoldForActiveTicket} disabled={!canOperateTickets || !$activeTicketKey}>Create Scaffold</button>
    </div>

    {#if !canOperateTickets}
      <p class="lcars-label status-warn">Read-only access: scaffold mutations require Operator or Admin role.</p>
    {/if}

    {#if $scaffold.status === 'loading'}
      <p class="lcars-label">Loading scaffold…</p>
    {:else if $scaffold.status === 'empty'}
      <p class="lcars-label">No scaffold found. Select a ticket to begin review.</p>
    {:else if $scaffold.status === 'error'}
      <p class="lcars-label status-err">{$scaffold.message}</p>
    {:else if $scaffold.status === 'permission_denied'}
      <p class="lcars-label status-warn">{$scaffold.message}</p>
    {:else if $scaffold.status === 'success'}
      {@const view = $scaffold.data}
      <div class="dor-grid">
        {#each view.dorItems as item}
          <div class="dor-item dor-item--{item.state}">
            <div class="dor-item__meta">
              <span class="dor-state-chip dor-state--{item.state}">{dorStateLabel[item.state]}</span>
              <span class:done={item.state === 'complete'}>{item.title}</span>
            </div>
            <div class="dor-item__right">
              <small>{item.required ? 'required' : 'optional'}</small>
              {#if canOperateTickets}
                <button
                  class="dor-toggle"
                  type="button"
                  onclick={() => toggleDorItem(item.id, item.state)}
                  title={item.state === 'complete' ? 'Mark incomplete' : 'Mark complete'}
                >
                  {item.state === 'complete' ? '✓' : '○'}
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      {#if view.acceptanceCriteria.length > 0}
        <p class="lcars-label">Acceptance Criteria</p>
        <ol class="criteria-list">
          {#each view.acceptanceCriteria as criterion}
            <li>{criterion}</li>
          {/each}
        </ol>
      {/if}

      <label class="lcars-label" for="criteria-input">Acceptance Criteria (one per line)</label>
      <textarea id="criteria-input" rows="4" bind:value={criteriaInput} disabled={!canOperateTickets}></textarea>
      <button type="button" onclick={saveAcceptanceCriteria} disabled={!canOperateTickets || !$activeTicketKey}>Save Acceptance Criteria</button>

      <div class="effort-grid">
        <div>
          <label class="lcars-label" for="effort-band">Effort Band</label>
          <select id="effort-band" bind:value={effortBand} disabled={!canOperateTickets}>
            <option value="trivial">Trivial</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
            <option value="x_large">XLarge</option>
          </select>
        </div>
        <div>
          <label class="lcars-label" for="effort-points">Story Points</label>
          <input id="effort-points" type="number" min="0" step="0.5" bind:value={effortPoints} disabled={!canOperateTickets} />
        </div>
        <div>
          <label class="lcars-label" for="effort-confidence">Confidence (0-100)</label>
          <input id="effort-confidence" type="number" min="0" max="100" bind:value={effortConfidence} disabled={!canOperateTickets} />
        </div>
      </div>
      <label class="lcars-label" for="effort-rationale">Rationale</label>
      <textarea id="effort-rationale" rows="2" bind:value={effortRationale} disabled={!canOperateTickets}></textarea>
      <button type="button" onclick={saveEffortEstimate} disabled={!canOperateTickets || !$activeTicketKey}>Save Effort Estimate</button>

      {#if view.effortEstimate}
        <p class="lcars-label">Current Estimate: {view.effortEstimate.band} ({view.effortEstimate.story_points ?? 'n/a'} pts, {view.effortEstimate.confidence}% confidence)</p>
      {/if}
      <p class="lcars-label">Updated: {view.updatedAt}</p>
    {/if}

    <p class="lcars-label">Recent Scaffolds</p>
    {#if $scaffoldList.status === 'loading'}
      <p class="lcars-label">Loading scaffold index…</p>
    {:else if $scaffoldList.status === 'empty'}
      <p class="lcars-label">No scaffolds created yet.</p>
    {:else if $scaffoldList.status === 'error'}
      <p class="lcars-label status-err">{$scaffoldList.message}</p>
    {:else if $scaffoldList.status === 'permission_denied'}
      <p class="lcars-label status-warn">{$scaffoldList.message}</p>
    {:else if $scaffoldList.status === 'success'}
      <div class="ticket-list">
        {#each $scaffoldList.data as item}
          <button class="ticket-card" type="button" onclick={() => ticketQueue.select(item.ticketKey)}>
            <div class="ticket-card__top">
              <strong>{item.ticketKey}</strong>
              <span class="priority-chip priority-medium">{Math.round(item.completionRatio * 100)}% DoR</span>
            </div>
            <p>{item.acceptanceCriteria.length} acceptance criteria</p>
          </button>
        {/each}
      </div>
    {/if}
  </article>

  <!-- ── LLM Console Panel ──────────────────────────────────────────────── -->
  <article class="panel llm-panel">
    <header class="panel-header">
      <p class="lcars-label">Stub Runtime</p>
      <h2>LLM Stub Console</h2>
    </header>

    <label class="lcars-label" for="llm-provider">Provider</label>
    <select id="llm-provider" bind:value={selectedProvider}>
      <option value="open_ai">OpenAI</option>
      <option value="anthropic">Anthropic</option>
      <option value="ollama">Ollama</option>
      <option value="gemini">Google Gemini</option>
      <option value="atlassian_rovo">Atlassian Rovo</option>
    </select>

    <label class="lcars-label" for="prompt">Prompt</label>
    <textarea id="prompt" bind:value={llmPrompt} rows="5"></textarea>

    <button
      class="preview-button"
      type="button"
      onclick={runPreview}
      disabled={!canInvokeLlm || $llmResult.status === 'loading'}
    >
      {$llmResult.status === 'loading' ? 'Running…' : 'Run Stub Preview'}
    </button>

    {#if !canInvokeLlm}
      <p class="lcars-label status-warn">Insufficient permissions to invoke LLM.</p>
    {:else if $llmResult.status === 'loading'}
      <p class="lcars-label">Invoking stub…</p>
    {:else if $llmResult.status === 'empty'}
      <!-- No output yet — do nothing -->
    {:else if $llmResult.status === 'error'}
      <p class="lcars-label status-err">{$llmResult.message}</p>
    {:else if $llmResult.status === 'permission_denied'}
      <p class="lcars-label status-warn">{$llmResult.message}</p>
    {:else if $llmResult.status === 'success'}
      {@const resp = $llmResult.data}
      <div class="llm-output">
        <div class="llm-output__header">
          <span class="lcars-pill is-cyan">SIMULATED</span>
          <small>{resp.provider} / {resp.model}</small>
        </div>
        <pre>{resp.output}</pre>
        {#if resp.warnings.length > 0}
          {#each resp.warnings as w}
            <p class="lcars-label status-warn">⚠ {w}</p>
          {/each}
        {/if}
      </div>
    {/if}
  </article>
</section>

<style>
  .command-deck {
    display: grid;
    grid-template-columns: 1.25fr 1fr;
    gap: var(--space-4);
    padding: var(--space-4);
    background:
      radial-gradient(circle at 20% 0%, rgba(255, 138, 28, 0.2), transparent 28%),
      radial-gradient(circle at 85% 100%, rgba(111, 127, 232, 0.16), transparent 30%),
      var(--color-bg);
    min-height: 100%;
  }

  .panel {
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-lg);
    background: var(--color-bg-panel);
    padding: var(--space-4);
    box-shadow: var(--shadow-panel);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .panel-header h2 {
    font-size: var(--text-lg);
  }

  .command-panel {
    grid-column: 1 / -1;
  }

  .command-status-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
  }

  .status-value {
    font-family: var(--font-display);
    font-size: var(--text-base);
    text-transform: uppercase;
  }

  .command-actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .audit-summary {
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    background: rgba(255, 255, 255, 0.02);
  }

  .audit-summary--ok {
    border-color: var(--color-lcars-green);
  }

  .audit-summary--warn {
    border-color: var(--color-lcars-amber);
  }

  .audit-timeline {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .audit-timeline__item {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-sm);
  }

  .audit-timeline__item--ok {
    border-left: 3px solid var(--color-lcars-green);
  }

  .audit-timeline__item--degraded,
  .audit-timeline__item--error,
  .audit-timeline__item--permission_denied {
    border-left: 3px solid var(--color-lcars-amber);
  }

  .effort-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .ticket-panel {
    grid-row: span 2;
  }

  .ticket-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .ticket-card {
    text-align: left;
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    background: linear-gradient(120deg, rgba(255, 138, 28, 0.1), rgba(155, 123, 216, 0.1));
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: transform var(--duration-fast) var(--ease-emphasis);
  }

  .ticket-card:hover {
    transform: translateY(-2px);
  }

  .ticket-card.active {
    border-color: var(--color-lcars-orange);
    box-shadow: var(--shadow-glow-soft);
  }

  .ticket-card__top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .priority-chip {
    text-transform: uppercase;
    font-family: var(--font-display);
    font-size: var(--text-xs);
    border-radius: var(--radius-pill);
    padding: var(--space-1) var(--space-3);
    color: var(--color-text-inverse);
  }

  .priority-critical { background: var(--color-lcars-red); }
  .priority-high { background: var(--color-lcars-orange); }
  .priority-medium { background: var(--color-lcars-cyan); }

  .progress-track {
    height: var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--color-bg-elevated);
    overflow: hidden;
  }

  .progress-track__fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-lcars-amber), var(--color-lcars-green));
  }

  .dor-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
    background: rgba(255, 255, 255, 0.02);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-3);
  }

  .dor-item__meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .dor-item__right {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .dor-state-chip {
    font-size: var(--text-xs, 0.7rem);
    padding: 1px 6px;
    border-radius: 3px;
    text-transform: uppercase;
    font-family: var(--font-display);
  }

  .dor-state--complete { background: var(--color-lcars-green, #66cc66); color: #000; }
  .dor-state--incomplete { background: var(--color-lcars-amber, #ffcc00); color: #000; }
  .dor-state--unknown { background: var(--color-lcars-purple, #9966cc); color: #fff; }

  .dor-toggle {
    background: none;
    border: 1px solid var(--color-border-subtle);
    border-radius: 50%;
    width: 24px;
    height: 24px;
    cursor: pointer;
    color: inherit;
    font-size: var(--text-sm);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dor-item .done {
    text-decoration: line-through;
    color: var(--color-status-success);
  }

  .status-err { color: var(--color-lcars-red, #cc3333); }
  .status-warn { color: var(--color-lcars-amber, #ffcc00); }

  .llm-output {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .llm-output__header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  select {
    width: 100%;
    padding: var(--space-2, 0.5rem);
    background: var(--color-bg-elevated);
    color: inherit;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    font-family: inherit;
  }

  .criteria-list {
    padding-left: var(--space-4);
    display: grid;
    gap: var(--space-2);
    color: var(--color-text-secondary);
  }

  textarea,
  pre,
  .preview-button {
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border-default);
    background: var(--color-bg-elevated);
    color: var(--color-text-primary);
    font-family: var(--font-body);
    padding: var(--space-3);
  }

  textarea {
    resize: vertical;
    min-height: 120px;
  }

  .preview-button {
    cursor: pointer;
    font-family: var(--font-display);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: linear-gradient(90deg, var(--color-lcars-purple), var(--color-lcars-violet));
    color: var(--color-text-primary);
  }

  pre {
    white-space: pre-wrap;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  @media (max-width: 1200px) {
    .command-deck {
      grid-template-columns: 1fr;
    }

    .command-status-grid {
      grid-template-columns: 1fr 1fr;
    }

    .effort-grid {
      grid-template-columns: 1fr;
    }

    .ticket-panel {
      grid-row: auto;
    }
  }
</style>
