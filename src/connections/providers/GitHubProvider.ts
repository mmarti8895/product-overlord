import type { GitHubConfig } from "../ConnectionManager.js";

export async function testGitHub(config: GitHubConfig): Promise<void> {
  if (config.pat) {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${config.pat}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) throw new Error(`GitHub PAT probe failed: ${res.status} ${res.statusText}`);
  } else if (config.appId) {
    // GitHub App: just verify the app endpoint is reachable
    const res = await fetch(`https://api.github.com/app`, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) throw new Error(`GitHub App probe failed: ${res.status} ${res.statusText}`);
  } else {
    throw new Error("No GitHub credentials configured (need pat or appId)");
  }
}
