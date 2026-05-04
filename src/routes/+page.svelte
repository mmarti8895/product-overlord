<script lang="ts">
  type TicketCard = {
    key: string;
    summary: string;
    priority: 'critical' | 'high' | 'medium';
    readiness: number;
  };

  let tickets = $state<TicketCard[]>([
    {
      key: 'PROJ-314',
      summary: 'Harden credential rotation workflow',
      priority: 'critical',
      readiness: 0.75
    },
    {
      key: 'PROJ-318',
      summary: 'Summarize incident retros in weekly digest',
      priority: 'high',
      readiness: 0.5
    },
    {
      key: 'PROJ-322',
      summary: 'Expose ticket scaffold completion in command deck',
      priority: 'medium',
      readiness: 0.92
    }
  ]);

  let selectedTicket = $state(tickets[0].key);

  let dorTemplate = $state([
    { title: 'Problem statement clear', required: true, done: true },
    { title: 'Dependencies mapped', required: true, done: false },
    { title: 'Acceptance criteria drafted', required: true, done: true },
    { title: 'Risk notes captured', required: false, done: false }
  ]);

  let acceptanceCriteria = $state([
    'Given a selected ticket, when scaffold state loads, then DoR completion appears with required/optional tags.',
    'Given a configured provider, when user triggers LLM preview, then response is marked as simulated stub output.',
    'Given Phase 1 security policy, when action implies writes to Jira, then interface keeps suggest-only posture.'
  ]);

  let llmPrompt = $state('Draft a concise PM review summary for the selected ticket.');
  let llmOutput = $state('[stub:OpenAI] prompt accepted (56 chars)');

  function selectTicket(key: string) {
    selectedTicket = key;
  }

  function runPreview() {
    llmOutput = `[stub:OpenAI] prompt accepted (${llmPrompt.trim().length} chars)`;
  }

  function priorityClass(priority: TicketCard['priority']) {
    if (priority === 'critical') return 'priority-critical';
    if (priority === 'high') return 'priority-high';
    return 'priority-medium';
  }
</script>

<section class="command-deck">
  <article class="panel ticket-panel">
    <header class="panel-header">
      <p class="lcars-label">Ticket Review Queue</p>
      <h2>Operational Focus</h2>
    </header>

    <div class="ticket-list">
      {#each tickets as ticket}
        <button
          class="ticket-card"
          class:active={ticket.key === selectedTicket}
          type="button"
          onclick={() => selectTicket(ticket.key)}
        >
          <div class="ticket-card__top">
            <span class={`priority-chip ${priorityClass(ticket.priority)}`}>{ticket.priority}</span>
            <strong>{ticket.key}</strong>
          </div>
          <p>{ticket.summary}</p>
          <div class="progress-track">
            <div class="progress-track__fill" style={`width:${ticket.readiness * 100}%`}></div>
          </div>
        </button>
      {/each}
    </div>
  </article>

  <article class="panel scaffold-panel">
    <header class="panel-header">
      <p class="lcars-label">Phase 1I Scaffold</p>
      <h2>Definition of Ready + Acceptance Criteria</h2>
    </header>

    <div class="dor-grid">
      {#each dorTemplate as item}
        <div class="dor-item">
          <span class:done={item.done}>{item.title}</span>
          <small>{item.required ? 'required' : 'optional'}</small>
        </div>
      {/each}
    </div>

    <ol class="criteria-list">
      {#each acceptanceCriteria as criterion}
        <li>{criterion}</li>
      {/each}
    </ol>
  </article>

  <article class="panel llm-panel">
    <header class="panel-header">
      <p class="lcars-label">Phase 1H Runtime</p>
      <h2>LLM Stub Console</h2>
    </header>

    <label class="lcars-label" for="prompt">Prompt</label>
    <textarea id="prompt" bind:value={llmPrompt} rows="5"></textarea>

    <button class="preview-button" type="button" onclick={runPreview}>
      Run Stub Preview
    </button>

    <pre>{llmOutput}</pre>
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

  .dor-grid {
    display: grid;
    gap: var(--space-2);
  }

  .dor-item {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    background: rgba(255, 255, 255, 0.02);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-3);
  }

  .dor-item .done {
    text-decoration: line-through;
    color: var(--color-status-success);
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
