/**
 * CustomAgentBuilder — scaffolds AGENTS.md, SOUL.md, SKILLS.md for a custom agent.
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
const AGENTS_DIR = process.env.AGENTS_DIR ?? "agents";
export function buildAgent(spec) {
    const agentsMd = `# ${spec.name}

## Role
${spec.role}

## Description
${spec.description}

## Parallelization
- Max concurrency: ${spec.maxConcurrency}
- RPM cap: ${spec.rpmCap}
- TPM cap: ${spec.tpmCap}
- Retry policy: ${spec.retryPolicy}
`;
    const soulMd = `# Soul — ${spec.name}

${spec.persona}
`;
    const skillsMd = `# Skills — ${spec.name}

${spec.skills.map(s => `- ${s}`).join("\n")}
`;
    const dir = join(AGENTS_DIR, spec.name.toLowerCase().replace(/\s+/g, "-"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "AGENTS.md"), agentsMd);
    writeFileSync(join(dir, "SOUL.md"), soulMd);
    writeFileSync(join(dir, "SKILLS.md"), skillsMd);
    return { name: spec.name, dir, files: { "AGENTS.md": agentsMd, "SOUL.md": soulMd, "SKILLS.md": skillsMd } };
}
// Default capability registry
export const CAPABILITY_REGISTRY = [
    "jira-read", "jira-write", "github-read", "github-write",
    "web-crawl", "embed-text", "search-kb", "call-llm",
    "run-eval", "write-report", "send-notification",
    "manage-workflows", "monitor-agents",
];
