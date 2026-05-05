<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { hub, type HubTab } from '$lib/stores/hub';
  import { invoke, type UIState, empty, loading, success, err } from '$lib/tauri/invoke';
  import { credentials } from '$lib/stores/credentials';
  import { effectiveRole } from '$lib/stores/session';
  import { hasPermission } from '$lib/stores/capabilities';

  type LlmProvider = 'open_ai' | 'anthropic' | 'ollama' | 'gemini' | 'atlassian_rovo';

  interface LlmProviderConfig {
    provider: LlmProvider;
    model: string;
    base_url: string | null;
    credential_id: string | null;
    enabled: boolean;
  }

  interface UrlValidationResult {
    normalised: string;
  }

  const tabs: { id: HubTab; label: string }[] = [
    { id: 'llm', label: 'LLM Connections' },
    { id: 'jira', label: 'Jira MCP' },
    { id: 'github', label: 'GitHub Repositories' },
  ];

  const llmProviderOptions: { value: LlmProvider; label: string }[] = [
    { value: 'open_ai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'ollama', label: 'Ollama' },
    { value: 'gemini', label: 'Google Gemini' },
    { value: 'atlassian_rovo', label: 'Atlassian Rovo' },
  ];

  let llmConfigs = $state<UIState<LlmProviderConfig[]>>(empty());
  let llmFeedback = $state('');
  let llmProvider = $state<LlmProvider>('open_ai');
  let llmModel = $state('');
  let llmBaseUrl = $state('');
  let llmCredentialId = $state('');
  let llmCredentialLabel = $state('');
  let llmSecretInput = $state<HTMLInputElement | null>(null);

  let jiraBaseUrl = $state('');
  let jiraProjectKey = $state('');
  let jiraCredentialLabel = $state('');
  let jiraFeedback = $state('');
  let jiraStatus = $state<'unknown' | 'connected' | 'degraded'>('unknown');
  let jiraLastValidated = $state<string | null>(null);
  let jiraSecretInput = $state<HTMLInputElement | null>(null);

  let githubRepoUrl = $state('');
  let githubBranch = $state('main');
  let githubCredentialLabel = $state('');
  let githubFeedback = $state('');
  let githubSecretInput = $state<HTMLInputElement | null>(null);

  const canConfigureLlm = $derived(hasPermission($effectiveRole, 'configure_llm_provider'));
  const canAddCredential = $derived(hasPermission($effectiveRole, 'add_credential'));
  const canDeleteCredential = $derived(hasPermission($effectiveRole, 'delete_credential'));
  const canCheckCredentialHealth = $derived(hasPermission($effectiveRole, 'check_credential_health'));

  const llmCredentials = $derived.by(() => {
    if ($credentials.status !== 'success') return [];
    return $credentials.data.filter((v) =>
      ['open_ai', 'anthropic', 'ollama', 'gemini', 'atlassian_rovo'].includes(v.credential.provider),
    );
  });

  const selectedProviderCredentials = $derived.by(() => llmCredentials.filter((v) => v.credential.provider === llmProvider));

  const jiraCredentials = $derived.by(() => {
    if ($credentials.status !== 'success') return [];
    return $credentials.data.filter((v) => v.credential.provider === 'jira');
  });

  const githubCredentials = $derived.by(() => {
    if ($credentials.status !== 'success') return [];
    return $credentials.data.filter((v) => v.credential.provider === 'git_hub');
  });

  function providerDisplayName(provider: LlmProvider): string {
    const found = llmProviderOptions.find((p) => p.value === provider);
    return found ? found.label : provider;
  }

  function splitGithubLabel(label: string): { displayLabel: string; branch: string } {
    const [displayLabel, branch] = label.split('::', 2);
    return { displayLabel: displayLabel || label, branch: branch || 'main' };
  }

  function llmConnectionStatus(cfg: LlmProviderConfig): string {
    if (!cfg.credential_id && cfg.provider !== 'ollama') return 'missing credential';
    if (cfg.credential_id) {
      const cred = llmCredentials.find((v) => v.credential.id === cfg.credential_id);
      if (!cred || cred.health === 'invalid' || cred.health === 'missing') return 'unreachable';
    }
    return cfg.enabled ? 'configured' : 'disabled';
  }

  async function refreshLlmConfigs() {
    llmConfigs = loading();
    const res = await invoke<LlmProviderConfig[]>('cmd_list_llm_provider_configs');
    if (res.status === 'success') {
      llmConfigs = res.data.length > 0 ? success(res.data) : empty();
    } else if (res.status === 'permission_denied') {
      llmConfigs = { status: 'permission_denied', message: res.message };
    } else if (res.status === 'error') {
      llmConfigs = err(res.message);
    } else {
      llmConfigs = empty();
    }
  }

  async function refreshCredentialHealth() {
    if (!canCheckCredentialHealth) return;
    if (get(credentials).status !== 'success') return;

    const items = get(credentials);
    if (items.status !== 'success') return;
    for (const item of items.data) {
      await credentials.checkHealth(item.credential.id);
    }
  }

  async function addLlmProvider() {
    llmFeedback = '';
    if (!canConfigureLlm) {
      llmFeedback = 'Insufficient permissions to configure LLM providers.';
      return;
    }
    if (!llmModel.trim()) {
      llmFeedback = 'Model is required.';
      return;
    }

    let normalisedBaseUrl: string | null = null;
    if (llmBaseUrl.trim()) {
      const urlResult = await invoke<UrlValidationResult>('cmd_validate_base_url', { raw: llmBaseUrl.trim() });
      if (urlResult.status !== 'success') {
        llmFeedback = urlResult.status === 'error' || urlResult.status === 'permission_denied'
          ? urlResult.message
          : 'Invalid base URL.';
        return;
      }
      normalisedBaseUrl = urlResult.data.normalised;
    }

    const res = await invoke<LlmProviderConfig>('cmd_configure_llm_provider', {
      config: {
        provider: llmProvider,
        model: llmModel.trim(),
        base_url: normalisedBaseUrl,
        credential_id: llmCredentialId || null,
        enabled: true,
      },
    });

    if (res.status === 'success') {
      llmFeedback = `Saved ${providerDisplayName(res.data.provider)} provider.`;
      llmModel = '';
      llmBaseUrl = '';
      llmCredentialId = '';
      await refreshCredentialHealth();
      await refreshLlmConfigs();
    } else if (res.status === 'error' || res.status === 'permission_denied') {
      llmFeedback = res.message;
    }
  }

  async function addLlmCredential() {
    llmFeedback = '';

    if (!canAddCredential) {
      llmFeedback = 'Insufficient permissions to save LLM credentials.';
      return;
    }

    if (llmProvider === 'ollama') {
      llmFeedback = 'Ollama does not require an API credential. Configure provider directly.';
      return;
    }

    if (!llmCredentialLabel.trim()) {
      llmFeedback = 'Credential label is required.';
      return;
    }

    const secret = llmSecretInput?.value ?? '';
    if (!secret.trim()) {
      llmFeedback = 'API credential secret is required for this provider.';
      return;
    }

    let normalisedBaseUrl: string | undefined;
    if (llmBaseUrl.trim()) {
      const urlResult = await invoke<UrlValidationResult>('cmd_validate_base_url', { raw: llmBaseUrl.trim() });
      if (urlResult.status !== 'success') {
        llmFeedback = urlResult.status === 'error' || urlResult.status === 'permission_denied'
          ? urlResult.message
          : 'Invalid base URL.';
        return;
      }
      normalisedBaseUrl = urlResult.data.normalised;
    }

    const addRes = await credentials.addCredential(
      llmProvider,
      llmCredentialLabel.trim(),
      secret,
      normalisedBaseUrl,
    );
    if (llmSecretInput) llmSecretInput.value = '';

    if (addRes.status === 'success') {
      llmCredentialId = addRes.data.id;
      llmCredentialLabel = '';
      llmFeedback = `Saved ${providerDisplayName(llmProvider)} credential and linked it.`;
      await refreshCredentialHealth();
    } else if (addRes.status === 'error' || addRes.status === 'permission_denied') {
      llmFeedback = addRes.message;
    }
  }

  async function setActiveProvider(target: LlmProvider) {
    if (!canConfigureLlm || llmConfigs.status !== 'success') return;

    for (const cfg of llmConfigs.data) {
      const res = await invoke<LlmProviderConfig>('cmd_configure_llm_provider', {
        config: {
          provider: cfg.provider,
          model: cfg.model,
          base_url: cfg.base_url,
          credential_id: cfg.credential_id,
          enabled: cfg.provider === target,
        },
      });
      if (res.status !== 'success') {
        llmFeedback = 'Failed to set active provider.';
        return;
      }
    }

    llmFeedback = `${providerDisplayName(target)} is now active.`;
    await refreshCredentialHealth();
    await refreshLlmConfigs();
  }

  async function removeLlmProvider(cfg: LlmProviderConfig) {
    if (!canConfigureLlm) return;
    llmFeedback = '';

    if (cfg.credential_id && canDeleteCredential) {
      const delRes = await credentials.deleteCredential(cfg.credential_id);
      if (delRes.status !== 'success') {
        llmFeedback = delRes.status === 'error' || delRes.status === 'permission_denied'
          ? delRes.message
          : 'Failed to remove linked credential.';
        return;
      }
    }

    const disableRes = await invoke<LlmProviderConfig>('cmd_configure_llm_provider', {
      config: {
        provider: cfg.provider,
        model: cfg.model,
        base_url: cfg.base_url,
        credential_id: null,
        enabled: false,
      },
    });

    if (disableRes.status === 'success') {
      llmFeedback = `${providerDisplayName(cfg.provider)} removed.`;
      await refreshCredentialHealth();
      await refreshLlmConfigs();
    } else if (disableRes.status === 'error' || disableRes.status === 'permission_denied') {
      llmFeedback = disableRes.message;
    }
  }

  async function addJiraCredential(event: SubmitEvent) {
    event.preventDefault();
    jiraFeedback = '';

    if (!canAddCredential) {
      jiraFeedback = 'Insufficient permissions to save Jira credentials.';
      return;
    }

    if (!jiraBaseUrl.trim() || !jiraCredentialLabel.trim() || !jiraProjectKey.trim()) {
      jiraFeedback = 'Base URL, project key, and credential label are required.';
      return;
    }

    const secret = jiraSecretInput?.value ?? '';
    if (!secret.trim()) {
      jiraFeedback = 'Jira API token is required.';
      return;
    }

    const urlResult = await invoke<UrlValidationResult>('cmd_validate_base_url', { raw: jiraBaseUrl.trim() });
    if (urlResult.status !== 'success') {
      jiraFeedback = urlResult.status === 'error' || urlResult.status === 'permission_denied'
        ? urlResult.message
        : 'Invalid URL.';
      return;
    }

    const label = `${jiraCredentialLabel.trim()}::${jiraProjectKey.trim().toUpperCase()}`;
    const addRes = await credentials.addCredential('jira', label, secret, urlResult.data.normalised);
    jiraSecretInput!.value = '';

    if (addRes.status === 'success') {
      jiraFeedback = 'Jira credential saved.';
      jiraStatus = 'unknown';
      await credentials.refresh();
      await refreshCredentialHealth();
    } else if (addRes.status === 'error' || addRes.status === 'permission_denied') {
      jiraFeedback = addRes.message;
    }
  }

  async function testJiraConnection() {
    jiraFeedback = '';

    if (!jiraBaseUrl.trim()) {
      jiraFeedback = 'Enter Jira base URL first.';
      return;
    }

    const urlResult = await invoke<UrlValidationResult>('cmd_validate_base_url', { raw: jiraBaseUrl.trim() });
    if (urlResult.status !== 'success') {
      jiraStatus = 'degraded';
      jiraFeedback = urlResult.status === 'error' || urlResult.status === 'permission_denied'
        ? urlResult.message
        : 'Invalid URL.';
      return;
    }

    const jiraCred = jiraCredentials[0];
    if (!jiraCred) {
      jiraStatus = 'degraded';
      jiraFeedback = 'No Jira credential configured yet.';
      return;
    }

    if (!canCheckCredentialHealth) {
      jiraStatus = 'degraded';
      jiraFeedback = 'Insufficient permissions to check credential health.';
      return;
    }

    const healthRes = await invoke<boolean>('cmd_check_credential_health', {
      id: jiraCred.credential.id,
    });

    if (healthRes.status === 'success' && healthRes.data) {
      jiraStatus = 'connected';
      jiraLastValidated = new Date().toISOString();
      jiraFeedback = 'Connection healthy.';
      await credentials.checkHealth(jiraCred.credential.id);
    } else {
      jiraStatus = 'degraded';
      jiraLastValidated = new Date().toISOString();
      jiraFeedback = healthRes.status === 'success'
        ? 'Credential health check failed.'
        : (healthRes.status === 'error' || healthRes.status === 'permission_denied'
          ? healthRes.message
          : 'Connection test failed.');
    }
  }

  async function addGithubRepo(event: SubmitEvent) {
    event.preventDefault();
    githubFeedback = '';

    if (!canAddCredential) {
      githubFeedback = 'Insufficient permissions to save GitHub credentials.';
      return;
    }

    if (!githubRepoUrl.trim() || !githubBranch.trim() || !githubCredentialLabel.trim()) {
      githubFeedback = 'Repository URL, branch, and credential label are required.';
      return;
    }

    const secret = githubSecretInput?.value ?? '';
    if (!secret.trim()) {
      githubFeedback = 'GitHub PAT is required.';
      return;
    }

    const urlResult = await invoke<UrlValidationResult>('cmd_validate_base_url', { raw: githubRepoUrl.trim() });
    if (urlResult.status !== 'success') {
      githubFeedback = urlResult.status === 'error' || urlResult.status === 'permission_denied'
        ? urlResult.message
        : 'Invalid URL.';
      return;
    }

    const encodedLabel = `${githubCredentialLabel.trim()}::${githubBranch.trim()}`;
    const addRes = await credentials.addCredential('git_hub', encodedLabel, secret, urlResult.data.normalised);
    githubSecretInput!.value = '';

    if (addRes.status === 'success') {
      githubFeedback = 'Repository credential saved.';
      await credentials.refresh();
      await refreshCredentialHealth();
    } else if (addRes.status === 'error' || addRes.status === 'permission_denied') {
      githubFeedback = addRes.message;
    }
  }

  async function removeGithubRepo(id: string) {
    githubFeedback = '';
    if (!canDeleteCredential) {
      githubFeedback = 'Insufficient permissions to remove repositories.';
      return;
    }

    const res = await credentials.deleteCredential(id);
    if (res.status === 'success') {
      githubFeedback = 'Repository removed.';
    } else if (res.status === 'error' || res.status === 'permission_denied') {
      githubFeedback = res.message;
    }
  }

  onMount(async () => {
    await credentials.refresh();
    await refreshCredentialHealth();
    await refreshLlmConfigs();
  });
</script>

{#if $hub.open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="hub-backdrop" onclick={() => hub.close()} aria-hidden="true"></div>
  <aside class="hub-panel" aria-label="Integration Hub">
    <header class="hub-header">
      <p class="lcars-label">Integration Hub</p>
      <button
        class="hub-close"
        type="button"
        onclick={() => hub.close()}
        aria-label="Close Integration Hub"
      >✕</button>
    </header>

    <nav class="hub-tabs" aria-label="Integration tabs">
      {#each tabs as tab}
        <button
          class="hub-tab {$hub.activeTab === tab.id ? 'hub-tab--active' : ''}"
          type="button"
          onclick={() => hub.setTab(tab.id)}
        >
          {tab.label}
        </button>
      {/each}
    </nav>

    <div class="hub-body">
      {#if $hub.activeTab === 'llm'}
        <section class="hub-section">
          <p class="lcars-label">Configured Providers</p>

          {#if llmConfigs.status === 'loading'}
            <p class="hub-muted">Loading providers…</p>
          {:else if llmConfigs.status === 'empty'}
            <p class="hub-muted">No providers configured yet.</p>
          {:else if llmConfigs.status === 'error'}
            <p class="hub-error">{llmConfigs.message}</p>
          {:else if llmConfigs.status === 'permission_denied'}
            <p class="hub-error">{llmConfigs.message}</p>
          {:else if llmConfigs.status === 'success'}
            {@const activeConfigs = llmConfigs.data.filter((cfg) => cfg.enabled)}
            {#if activeConfigs.length === 0}
              <p class="hub-muted">No providers configured yet.</p>
            {:else}
            <div class="hub-list">
              {#each activeConfigs as cfg}
                <article class="hub-card">
                  <div class="hub-card__row">
                    <strong>{providerDisplayName(cfg.provider)}</strong>
                    <span class="hub-state {cfg.enabled ? 'hub-state--ok' : ''}">
                      {llmConnectionStatus(cfg)}
                    </span>
                  </div>
                  <p class="hub-small">Model: {cfg.model}</p>
                  <p class="hub-small">Credential: {cfg.credential_id ?? 'none'}</p>
                  {#if cfg.base_url}
                    <p class="hub-small" title={cfg.base_url}>Base URL: {cfg.base_url}</p>
                  {/if}
                  <div class="hub-actions">
                    <button
                      type="button"
                      onclick={() => setActiveProvider(cfg.provider)}
                      disabled={!canConfigureLlm || cfg.enabled}
                    >Set Active</button>
                    <button
                      type="button"
                      onclick={() => removeLlmProvider(cfg)}
                      disabled={!canConfigureLlm}
                    >Remove</button>
                  </div>
                </article>
              {/each}
            </div>
            {/if}
          {/if}

          <div class="hub-divider"></div>

          <p class="lcars-label">Add Provider</p>
          {#if !canConfigureLlm}
            <p class="hub-permission-notice">Read-only access — LLM configuration requires Operator or Admin role.</p>
          {/if}
          {#if !canAddCredential}
            <p class="hub-permission-notice">Read-only access — LLM credential management requires Operator or Admin role.</p>
          {/if}
          <div class="hub-form-grid">
            <label for="llm-provider">Provider</label>
            <select id="llm-provider" bind:value={llmProvider} disabled={!canConfigureLlm}>
              {#each llmProviderOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>

            <label for="llm-model">Model</label>
            <input id="llm-model" type="text" bind:value={llmModel} placeholder="gpt-4o-mini" disabled={!canConfigureLlm} />

            <label for="llm-base-url">Base URL (optional)</label>
            <input id="llm-base-url" type="url" bind:value={llmBaseUrl} placeholder="https://api.example.com" disabled={!canConfigureLlm} />

            <label for="llm-credential-label">New Credential Label</label>
            <input
              id="llm-credential-label"
              type="text"
              bind:value={llmCredentialLabel}
              placeholder="prod-openai"
              disabled={!canAddCredential || llmProvider === 'ollama'}
            />

            <label for="llm-credential-secret">New Credential Secret</label>
            <input
              id="llm-credential-secret"
              type="password"
              bind:this={llmSecretInput}
              autocomplete="off"
              disabled={!canAddCredential || llmProvider === 'ollama'}
            />

            <label for="llm-credential">Credential (optional)</label>
            <select id="llm-credential" bind:value={llmCredentialId} disabled={!canConfigureLlm}>
              <option value="">None</option>
              {#each selectedProviderCredentials as cred}
                <option value={cred.credential.id}>{cred.credential.label}</option>
              {/each}
            </select>
          </div>

          {#if llmProvider === 'ollama'}
            <p class="hub-small">Ollama uses local runtime access and typically does not require API credentials.</p>
          {/if}

          <div class="hub-actions">
            <button type="button" onclick={addLlmCredential} disabled={!canAddCredential || llmProvider === 'ollama'}>Save Credential</button>
            <button type="button" onclick={addLlmProvider} disabled={!canConfigureLlm}>Save Provider</button>
            <button type="button" onclick={refreshLlmConfigs}>Refresh</button>
            <button type="button" onclick={refreshCredentialHealth} disabled={!canCheckCredentialHealth}>Refresh Health</button>
          </div>

          {#if llmFeedback}
            <p class="hub-feedback">{llmFeedback}</p>
          {/if}
        </section>
      {:else if $hub.activeTab === 'jira'}
        <section class="hub-section">
          <p class="lcars-label">Jira MCP Configuration</p>
          {#if !canAddCredential}
            <p class="hub-permission-notice">Read-only access — credential management requires Operator or Admin role.</p>
          {/if}
          <form class="hub-form-grid" onsubmit={addJiraCredential}>
            <label for="jira-base-url">Base URL</label>
            <input id="jira-base-url" type="url" bind:value={jiraBaseUrl} placeholder="https://your-org.atlassian.net" disabled={!canAddCredential} />

            <label for="jira-project-key">Project Key</label>
            <input id="jira-project-key" type="text" bind:value={jiraProjectKey} placeholder="PROJ" disabled={!canAddCredential} />

            <label for="jira-credential-label">Credential Label</label>
            <input id="jira-credential-label" type="text" bind:value={jiraCredentialLabel} placeholder="prod-jira" disabled={!canAddCredential} />

            <label for="jira-secret">API Token / MCP Secret</label>
            <input id="jira-secret" type="password" bind:this={jiraSecretInput} autocomplete="off" disabled={!canAddCredential} />

            <div class="hub-actions">
              <button type="submit" disabled={!canAddCredential}>Save Jira Credential</button>
              <button type="button" onclick={testJiraConnection} disabled={!canCheckCredentialHealth}>Test Connection</button>
            </div>
          </form>

          <article class="hub-card">
            <div class="hub-card__row">
              <strong>Connection Status</strong>
              <span class="hub-state {jiraStatus === 'connected' ? 'hub-state--ok' : jiraStatus === 'degraded' ? 'hub-state--warn' : ''}">
                {jiraStatus}
              </span>
            </div>
            {#if jiraLastValidated}
              <p class="hub-small">Last validated: {jiraLastValidated}</p>
            {/if}
            {#if jiraCredentials.length === 0}
              <p class="hub-small">No Jira credential configured.</p>
            {:else}
              <p class="hub-small">Active credential: {jiraCredentials[0].credential.label}</p>
            {/if}
          </article>

          {#if jiraFeedback}
            <p class="hub-feedback">{jiraFeedback}</p>
          {/if}
        </section>
      {:else if $hub.activeTab === 'github'}
        <section class="hub-section">
          <p class="lcars-label">Registered Repositories</p>

          {#if githubCredentials.length === 0}
            <p class="hub-muted">No repositories registered yet.</p>
          {:else}
            <div class="hub-list">
              {#each githubCredentials as item}
                {@const parsed = splitGithubLabel(item.credential.label)}
                <article class="hub-card">
                  <div class="hub-card__row">
                    <strong title={item.credential.base_url ?? ''}>{item.credential.base_url ?? 'No URL'}</strong>
                    <span class="hub-state {item.health === 'healthy' ? 'hub-state--ok' : item.health === 'invalid' ? 'hub-state--warn' : ''}">
                      {item.health}
                    </span>
                  </div>
                  <p class="hub-small">Branch: {parsed.branch}</p>
                  <p class="hub-small">Credential Label: {parsed.displayLabel}</p>
                  <div class="hub-actions">
                    <button
                      type="button"
                      onclick={() => removeGithubRepo(item.credential.id)}
                      disabled={!canDeleteCredential}
                    >Remove</button>
                  </div>
                </article>
              {/each}
            </div>
          {/if}

          <div class="hub-divider"></div>

          <p class="lcars-label">Add Repository</p>
          {#if !canAddCredential}
            <p class="hub-permission-notice">Read-only access — credential management requires Operator or Admin role.</p>
          {/if}
          <form class="hub-form-grid" onsubmit={addGithubRepo}>
            <label for="gh-repo-url">Repository URL</label>
            <input id="gh-repo-url" type="url" bind:value={githubRepoUrl} placeholder="https://github.com/org/repo" disabled={!canAddCredential} />

            <label for="gh-branch">Branch</label>
            <input id="gh-branch" type="text" bind:value={githubBranch} placeholder="main" disabled={!canAddCredential} />

            <label for="gh-cred-label">Credential Label</label>
            <input id="gh-cred-label" type="text" bind:value={githubCredentialLabel} placeholder="prod-gh" disabled={!canAddCredential} />

            <label for="gh-secret">PAT</label>
            <input id="gh-secret" type="password" bind:this={githubSecretInput} autocomplete="off" disabled={!canAddCredential} />

            <div class="hub-actions">
              <button type="submit" disabled={!canAddCredential}>Add Repository</button>
            </div>
          </form>

          {#if githubFeedback}
            <p class="hub-feedback">{githubFeedback}</p>
          {/if}
        </section>
      {/if}
    </div>
  </aside>
{/if}

<style>
  .hub-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.4);
  }

  .hub-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(460px, 95vw);
    z-index: 201;
    background: var(--color-bg-panel, #1a1a2e);
    border-left: 2px solid var(--color-lcars-orange, #ff9900);
    display: flex;
    flex-direction: column;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.5);
  }

  .hub-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4);
    border-bottom: 1px solid var(--color-border-default, #333);
  }

  .hub-close {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: var(--text-lg, 1.125rem);
    padding: var(--space-1);
    opacity: 0.7;
    line-height: 1;
  }

  .hub-close:hover {
    opacity: 1;
  }

  .hub-tabs {
    display: flex;
    border-bottom: 1px solid var(--color-border-default, #333);
  }

  .hub-tab {
    flex: 1;
    padding: var(--space-3) var(--space-2);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: inherit;
    cursor: pointer;
    font-size: var(--text-sm, 0.875rem);
    opacity: 0.6;
    transition: opacity 0.15s, border-color 0.15s;
  }

  .hub-tab:hover {
    opacity: 0.85;
  }

  .hub-tab--active {
    opacity: 1;
    border-bottom-color: var(--color-lcars-orange, #ff9900);
    color: var(--color-lcars-orange, #ff9900);
  }

  .hub-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-4);
  }

  .hub-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .hub-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .hub-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    border: 1px solid var(--color-border-default, #333);
    border-radius: var(--radius-md, 8px);
    padding: var(--space-3);
    background: rgba(255, 255, 255, 0.02);
  }

  .hub-card__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
  }

  .hub-state {
    font-size: var(--text-xs, 0.75rem);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.75;
  }

  .hub-state--ok {
    color: var(--color-lcars-green, #66cc66);
    opacity: 1;
  }

  .hub-state--warn {
    color: var(--color-lcars-amber, #ffcc00);
    opacity: 1;
  }

  .hub-small {
    font-size: var(--text-xs, 0.75rem);
    opacity: 0.8;
    margin: 0;
  }

  .hub-form-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-2);
  }

  .hub-form-grid label {
    font-size: var(--text-xs, 0.75rem);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.8;
  }

  .hub-form-grid input,
  .hub-form-grid select {
    border: 1px solid var(--color-border-default, #333);
    background: var(--color-bg-elevated, #111);
    color: var(--color-text-primary, #f6f2d8);
    border-radius: var(--radius-sm, 4px);
    padding: var(--space-2);
  }

  .hub-form-grid select {
    -webkit-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23ff8a1c' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right var(--space-3, 0.75rem) center;
    padding-right: calc(var(--space-3, 0.75rem) * 2 + 12px);
    cursor: pointer;
  }

  .hub-form-grid select:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .hub-actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .hub-actions button {
    border: 1px solid var(--color-border-default, #333);
    background: rgba(255, 255, 255, 0.06);
    color: inherit;
    border-radius: var(--radius-sm, 4px);
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
  }

  .hub-actions button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .hub-divider {
    height: 1px;
    background: var(--color-border-default, #333);
    margin: var(--space-1) 0;
  }

  .hub-muted {
    opacity: 0.7;
    margin: 0;
  }

  .hub-error {
    color: var(--color-lcars-red, #cc3333);
    margin: 0;
  }

  .hub-feedback {
    margin: 0;
    font-size: var(--text-sm, 0.875rem);
  }

  .hub-permission-notice {
    margin: 0 0 var(--space-3, 0.75rem) 0;
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-lcars-orange, #ff9900);
    background: rgba(255, 153, 0, 0.08);
    border-left: 3px solid var(--color-lcars-orange, #ff9900);
    border-radius: 2px;
  }
</style>
