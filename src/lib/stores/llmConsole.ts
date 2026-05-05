import { writable } from 'svelte/store';
import { invoke, type UIState, loading, success, err, empty } from '$lib/tauri/invoke';

// ─── Types mirroring Rust domain ─────────────────────────────────────────────

export type LlmProvider = 'open_ai' | 'anthropic' | 'ollama' | 'gemini' | 'atlassian_rovo';

export interface LlmInvocationResponse {
  provider: LlmProvider;
  model: string;
  /** The response text. Always sanitised before reaching this type. */
  output: string;
  /** Always true in Phase 1 stub runtime. */
  simulated: boolean;
  warnings: string[];
}

/** Frontend-safe view: output is sanitised and tagged. */
export interface LlmResponseView {
  provider: LlmProvider;
  model: string;
  /** Sanitised output text. */
  output: string;
  /** Always true — enforced in the adapter, not in template code. */
  simulated: true;
  warnings: string[];
}

// ─── Sanitise helper ──────────────────────────────────────────────────────────

function sanitiseOutput(raw: string): string {
  // Strip HTML tags to prevent injection from LLM-generated content.
  return raw.replace(/<[^>]*>/g, '').trim();
}

function toView(raw: LlmInvocationResponse): LlmResponseView {
  return {
    provider: raw.provider,
    model: raw.model,
    output: sanitiseOutput(raw.output),
    simulated: true, // Structural invariant — not derived from backend flag.
    warnings: raw.warnings,
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

function createLlmConsoleStore() {
  const result = writable<UIState<LlmResponseView>>(empty());

  async function invoke_llm(
    provider: LlmProvider,
    prompt: string,
    systemPrompt?: string,
    maxTokens?: number,
  ) {
    result.set(loading());
    const res = await invoke<LlmInvocationResponse>('cmd_invoke_llm', {
      request: {
        provider,
        prompt,
        system_prompt: systemPrompt ?? null,
        max_tokens: maxTokens ?? null,
        temperature: null,
      },
    });
    if (res.status === 'success') {
      result.set(success(toView(res.data)));
    } else if (res.status === 'error') {
      result.set(err(res.message));
    } else if (res.status === 'permission_denied') {
      result.set({ status: 'permission_denied', message: res.message });
    } else {
      result.set(empty());
    }
    // Prompt text is never stored here — it remains in ephemeral component state.
  }

  function reset() {
    result.set(empty());
  }

  return { result, invoke_llm, reset };
}

export const llmConsole = createLlmConsoleStore();
