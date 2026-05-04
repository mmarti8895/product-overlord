<script lang="ts">
  import { onMount } from 'svelte';
  import { ticketQueue } from '$lib/stores/ticketQueue';
  import { dorStore } from '$lib/stores/dor';
  import { llmConsole } from '$lib/stores/llmConsole';
  import { effectiveRole, hasPermission } from '$lib/stores/session';
  import UIStateView from '$lib/components/lcars/UIStateView.svelte';
  import type { LlmProvider } from '$lib/stores/llmConsole';
  import type { DorItemState } from '$lib/stores/dor';

  // Ephemeral LLM prompt — never persisted to store or storage.
  let llmPrompt = $state('Draft a concise PM review summary for the selected ticket.');
  let selectedProvider = $state<LlmProvider>('open_ai');

  // Store subscriptions.
  const ticketList = ticketQueue.list;
  const activeTicketKey = ticketQueue.activeKey;
  const scaffold = dorStore.scaffold;
  const llmResult = llmConsole.result;

  // Ephemeral LLM prompt — never persisted to store or storage.
  let llmPrompt = $state('Draft a concise PM review summary for the selected ticket.');
  let selectedProvider = $state<LlmProvider>('open_ai');

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

  const canOperateTickets = $derived(hasPermission($effectiveRole, 'request_ticket_review'));
  const canInvokeLlm = $derived(hasPermission($effectiveRole, 'invoke_llm'));

  onMount(() => {
    ticketQueue.refresh();
  });
</script>

<section class="command-deck">
  <!-- ── Ticket Queue Panel ─────────────────────────────────────────────── -->
  <article class="panel ticket-panel">
    <header class="panel-header">
      <p class="lcars-label">Ticket Review Queue</p>
      <h2>Operational Focus</h2>
    </header>

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

    .ticket-panel {
      grid-row: auto;
    }
  }
</style>
