/**
 * OutcomeSnapshotBuilder — computes OKR deltas and flag adoptions, then triggers
 * the ReflectionAgent to produce Markdown commentary. (task 2.6)
 */

import { randomUUID } from "crypto";
import type { OKRStore } from "../stores/okr-store.js";
import type { MetricsIngestionAdapter } from "../adapters/metrics/index.js";
import type { OutcomeSnapshot, OKRDelta, FlagAdoption } from "../types/outcomes.js";
import type { ReflectionAgent } from "./reflection-agent.js";

export class OutcomeSnapshotBuilder {
  constructor(
    private readonly store: OKRStore,
    private readonly metricsAdapters: MetricsIngestionAdapter[],
    private readonly reflectionAgent: ReflectionAgent,
  ) {}

  async build(projectKey: string): Promise<OutcomeSnapshot> {
    const okrs = await this.store.listOKRs(projectKey);

    // ── Ingest new metric events ─────────────────────────────────────────
    const latestSnap = await this.store.latestSnapshot(projectKey);
    const since = latestSnap?.generated_at ?? null;

    for (const adapter of this.metricsAdapters) {
      const events = await adapter.fetchSince(since).catch(() => []);
      for (const e of events) {
        // Route to a specific OKR/KR if provided, otherwise first matching OKR
        const targetOkr = e.okr_id
          ? okrs.find((o) => o.id === e.okr_id)
          : okrs[0];
        if (!targetOkr) continue;
        await this.store.appendMetricEvent({
          okr_id:      targetOkr.id,
          kr_id:       e.kr_id ?? null,
          source:      e.source,
          metric_name: e.metric_name,
          value:       e.value,
          occurred_at: new Date(e.occurred_at).toISOString(),
        });
        // If this is a KR metric, update KR current value
        if (e.kr_id) {
          await this.store.updateKeyResult(targetOkr.id, e.kr_id, e.value).catch(() => {});
        }
      }
    }

    // ── Compute OKR deltas ───────────────────────────────────────────────
    const freshOkrs = await this.store.listOKRs(projectKey);
    const prevOkrs  = okrs; // pre-ingest snapshot

    const okrDeltas: OKRDelta[] = [];
    for (const okr of freshOkrs) {
      const prev = prevOkrs.find((o) => o.id === okr.id);
      for (const kr of okr.key_results) {
        const prevKr = prev?.key_results.find((k) => k.id === kr.id);
        const previous = prevKr?.current ?? 0;
        const current  = kr.current;
        const target   = kr.target;
        const deltaPct = target !== 0 ? ((current - previous) / target) * 100 : 0;
        okrDeltas.push({ kr_id: kr.id, description: kr.description, previous, current, target, delta_pct: parseFloat(deltaPct.toFixed(1)) });
      }
    }

    // ── Flag adoptions from LaunchDarkly events ──────────────────────────
    const flagMap = new Map<string, { date: string; pct: number }[]>();
    for (const okr of freshOkrs) {
      const events = await this.store.getMetricEvents(okr.id);
      for (const e of events) {
        if (!e.metric_name.startsWith("flag_adoption.")) continue;
        const flagKey = e.metric_name.replace("flag_adoption.", "");
        const series  = flagMap.get(flagKey) ?? [];
        series.push({ date: e.occurred_at.slice(0, 10), pct: e.value });
        flagMap.set(flagKey, series);
      }
    }
    const flagAdoptions: FlagAdoption[] = Array.from(flagMap.entries()).map(([flag_key, series]) => ({
      flag_key,
      series: series.sort((a, b) => a.date.localeCompare(b.date)),
    }));

    // ── LLM reflection ───────────────────────────────────────────────────
    let reflection: string | null = null;
    try {
      reflection = await this.reflectionAgent.reflect(projectKey, freshOkrs, okrDeltas);
    } catch { /* optional */ }

    const snapshot: OutcomeSnapshot = {
      id:             randomUUID(),
      project_key:    projectKey,
      generated_at:   new Date().toISOString(),
      okr_deltas:     okrDeltas,
      flag_adoptions: flagAdoptions,
      reflection,
      notes:          null,
    };
    await this.store.saveSnapshot(snapshot);
    return snapshot;
  }
}
