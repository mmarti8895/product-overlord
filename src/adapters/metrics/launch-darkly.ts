/**
 * LaunchDarklyAdapter — polls the LaunchDarkly metrics API (task 2.4)
 */

import type { MetricsIngestionAdapter, RawMetricEvent } from "./index.js";

interface LaunchDarklyConfig {
  apiKey: string;
  projectKey: string;
  environmentKey?: string;
  baseUrl?: string;
}

interface LDFlag {
  key: string;
  environments: Record<string, { on: boolean; _summary?: { variations: { rollout: number }[] } }>;
}

export class LaunchDarklyAdapter implements MetricsIngestionAdapter {
  readonly source = "launch_darkly" as const;
  private readonly baseUrl: string;
  private readonly env: string;

  constructor(private readonly cfg: LaunchDarklyConfig) {
    this.baseUrl = cfg.baseUrl ?? "https://app.launchdarkly.com";
    this.env = cfg.environmentKey ?? "production";
  }

  async fetchSince(since: string | null): Promise<RawMetricEvent[]> {
    const resp = await fetch(
      `${this.baseUrl}/api/v2/flags/${this.cfg.projectKey}?env=${this.env}&summary=true&limit=200`,
      { headers: { Authorization: this.cfg.apiKey } },
    );
    if (!resp.ok) throw new Error(`LaunchDarkly fetch failed: ${resp.status}`);

    const json = (await resp.json()) as { items: LDFlag[] };
    const cutoff = since ? new Date(since).getTime() : 0;
    const now = Date.now();

    // Emit one synthetic "pct_enabled" metric per flag
    return (json.items ?? [])
      .filter(() => now > cutoff)
      .map((flag) => {
        const env = flag.environments[this.env];
        const pct = env?.on ? (env._summary?.variations?.[0]?.rollout ?? 100) : 0;
        return {
          source: "launch_darkly" as const,
          metric_name: `flag_adoption.${flag.key}`,
          value: pct,
          occurred_at: now,
          flag_key: flag.key,
        };
      });
  }
}
