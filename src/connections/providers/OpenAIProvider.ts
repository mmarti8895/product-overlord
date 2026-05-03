import type { OpenAIConfig } from "../ConnectionManager.js";

export async function testOpenAI(config: OpenAIConfig): Promise<void> {
  const base = (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/models`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      ...(config.orgId ? { "OpenAI-Organization": config.orgId } : {}),
    },
  });
  if (!res.ok) throw new Error(`OpenAI probe failed: ${res.status} ${res.statusText}`);
}
