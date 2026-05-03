import type { JiraConfig } from "../ConnectionManager.js";

export async function testJira(config: JiraConfig): Promise<void> {
  const url = `${config.baseUrl.replace(/\/$/, "")}/rest/api/3/myself`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Jira probe failed: ${res.status} ${res.statusText}`);
}
