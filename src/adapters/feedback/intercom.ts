/**
 * IntercomAdapter — pulls conversations from the Intercom REST API (task 2.3)
 */

import type { FeedbackAdapter, RawFeedbackItem } from "./index.js";

interface IntercomConfig {
  token: string;
  baseUrl?: string;
}

interface IntercomConversation {
  id: string;
  created_at: number;
  conversation_message?: { body?: string };
  tags?: { tags?: { name: string }[] };
  custom_attributes?: Record<string, string | null>;
}

export class IntercomAdapter implements FeedbackAdapter {
  readonly source = "intercom" as const;
  private readonly baseUrl: string;

  constructor(private readonly cfg: IntercomConfig) {
    this.baseUrl = cfg.baseUrl ?? "https://api.intercom.io";
  }

  async fetchSince(since: string | null): Promise<RawFeedbackItem[]> {
    const cutoff = since ? Math.floor(new Date(since).getTime() / 1000) : 0;
    const url = `${this.baseUrl}/conversations?display_as=plaintext&order=asc&sort=created_at&created_since=${cutoff}&per_page=150`;

    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.cfg.token}`,
        Accept: "application/json",
        "Intercom-Version": "2.10",
      },
    });

    if (!resp.ok) {
      throw new Error(`Intercom fetch failed: ${resp.status} ${resp.statusText}`);
    }

    const json = (await resp.json()) as { conversations: IntercomConversation[] };
    return (json.conversations ?? []).map((c) => ({
      source_id: c.id,
      text: c.conversation_message?.body ?? "",
      created_at: c.created_at * 1000,
      customer_segment: c.custom_attributes?.["segment"] ?? null,
      tags: c.tags?.tags?.map((t) => t.name) ?? [],
    }));
  }
}
