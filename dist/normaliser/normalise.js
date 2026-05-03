/**
 * Canonical Ticket Normaliser
 *
 * Merges raw Jira API fields into a single CanonicalTicket schema.
 * Resolves all 8 Atlassian acceptance-criteria field aliases.
 * Normalises linked artifacts and dependency relationships.
 */
// ---------------------------------------------------------------------------
// Acceptance-criteria alias table (8 variants, case-insensitive match)
// ---------------------------------------------------------------------------
export const AC_ALIASES = [
    "Acceptance Criteria",
    "AC",
    "ACs",
    "Business Requirements",
    "Functional Requirements",
    "Requirements",
    "Definition of Done",
    "DoD",
];
// ---------------------------------------------------------------------------
// Blocker relationship labels
// ---------------------------------------------------------------------------
const BLOCKER_RELATIONSHIPS = new Set([
    "is blocked by",
    "depends on",
    "blocks",
    "clones",
    "is cloned by",
    "relates to",
    "duplicates",
    "is duplicated by",
]);
// ---------------------------------------------------------------------------
// Normaliser
// ---------------------------------------------------------------------------
export function normaliseTicket(raw, opts = {}) {
    const f = raw.fields;
    return {
        ticket_key: raw.key,
        ticket_type: resolveIssueType(f),
        summary: str(f["summary"]),
        description: resolveDescription(f),
        acceptance_criteria: resolveAc(f).value,
        ac_field_source: resolveAc(f).source,
        issue_type: str(f["issuetype"]?.["name"]),
        status: str(f["status"]?.["name"]),
        labels: strArray(f["labels"]),
        priority: str(f["priority"]?.["name"]),
        reporter: resolveUser(f["reporter"]),
        assignee: resolveUser(f["assignee"]) || null,
        linked_artifacts: resolveLinkedArtifacts(f),
        dependencies: resolveDependencies(f),
        comments: resolveComments(f),
        board_id: opts.boardId ?? null,
        sprint_id: opts.sprintId ?? resolveSprintId(f),
        epic_key: str(f["epic"]?.["key"]) || null,
        fix_versions: strArray((f["fixVersions"] ?? []).map((v) => v.name ?? "")),
        raw_fields: f,
    };
}
// ---------------------------------------------------------------------------
// Acceptance-criteria resolution
// ---------------------------------------------------------------------------
export function resolveAc(fields) {
    // 1. Check exact alias name keys (custom fields stored by name)
    for (const alias of AC_ALIASES) {
        const val = fields[alias];
        if (val && typeof val === "string" && val.trim().length > 0) {
            return { value: val.trim(), source: alias };
        }
    }
    // 2. Check case-insensitive match against all field keys
    const lowerAliases = AC_ALIASES.map((a) => a.toLowerCase());
    for (const [key, val] of Object.entries(fields)) {
        if (lowerAliases.includes(key.toLowerCase())) {
            if (val && typeof val === "string" && val.trim().length > 0) {
                return { value: val.trim(), source: key };
            }
        }
    }
    // 3. Check rendered custom fields (customfield_XXXXX) whose display name matches
    for (const [key, val] of Object.entries(fields)) {
        if (!key.startsWith("customfield_"))
            continue;
        const nested = val;
        if (!nested)
            continue;
        const label = str(nested["name"] ?? nested["label"] ?? nested["displayName"]);
        if (label && lowerAliases.includes(label.toLowerCase())) {
            const content = str(nested["value"] ?? nested["content"] ?? nested["text"]);
            if (content.trim().length > 0) {
                return { value: content.trim(), source: label };
            }
        }
    }
    return { value: null, source: null };
}
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function resolveIssueType(fields) {
    const raw = str(fields["issuetype"]?.["name"]).toLowerCase();
    if (raw.includes("story"))
        return "story";
    if (raw.includes("bug"))
        return "bug";
    if (raw.includes("task"))
        return "task";
    return raw || "task";
}
function resolveDescription(fields) {
    const desc = fields["description"];
    if (!desc)
        return "";
    if (typeof desc === "string")
        return desc;
    // Atlassian Document Format (ADF) — extract plain text from content nodes
    return extractAdfText(desc);
}
function extractAdfText(node) {
    if (node["type"] === "text")
        return str(node["text"]);
    const content = node["content"];
    if (Array.isArray(content)) {
        return content.map(extractAdfText).join(" ");
    }
    return "";
}
function resolveUser(val) {
    if (!val)
        return "";
    const u = val;
    return str(u["displayName"] ?? u["name"] ?? u["emailAddress"]);
}
function resolveLinkedArtifacts(fields) {
    const links = fields["issuelinks"];
    if (!Array.isArray(links))
        return [];
    return links.flatMap((link) => {
        const results = [];
        if (link["inwardIssue"]) {
            const issue = link["inwardIssue"];
            results.push({
                key: str(issue["key"]),
                relationship: str(link["type"]?.["inward"]),
                url: str(issue["self"]),
            });
        }
        if (link["outwardIssue"]) {
            const issue = link["outwardIssue"];
            results.push({
                key: str(issue["key"]),
                relationship: str(link["type"]?.["outward"]),
                url: str(issue["self"]),
            });
        }
        return results;
    });
}
function resolveDependencies(fields) {
    const links = fields["issuelinks"];
    if (!Array.isArray(links))
        return [];
    const deps = [];
    for (const link of links) {
        const relType = link["type"];
        const inward = str(relType?.["inward"]).toLowerCase();
        const outward = str(relType?.["outward"]).toLowerCase();
        if (link["inwardIssue"] && BLOCKER_RELATIONSHIPS.has(inward)) {
            const issue = link["inwardIssue"];
            deps.push({
                key: str(issue["key"]),
                relationship: inward,
                status: str(issue["fields"]?.["status"]),
            });
        }
        if (link["outwardIssue"] && BLOCKER_RELATIONSHIPS.has(outward)) {
            const issue = link["outwardIssue"];
            deps.push({
                key: str(issue["key"]),
                relationship: outward,
                status: str(issue["fields"]?.["status"]),
            });
        }
    }
    return deps;
}
function resolveComments(fields) {
    const commentBlock = fields["comment"];
    const comments = commentBlock?.["comments"];
    if (!Array.isArray(comments))
        return [];
    return comments.map((c) => {
        const body = c["body"];
        if (typeof body === "string")
            return body;
        return extractAdfText(body);
    });
}
function resolveSprintId(fields) {
    // Sprint is typically a customfield array
    for (const val of Object.values(fields)) {
        if (Array.isArray(val) && val.length > 0) {
            const first = val[0];
            if (typeof first?.["id"] === "number" && typeof first?.["name"] === "string" && first?.["state"]) {
                return String(first["id"]);
            }
        }
    }
    return null;
}
function str(val) {
    if (val === null || val === undefined)
        return "";
    return String(val);
}
function strArray(val) {
    if (!Array.isArray(val))
        return [];
    return val.map((v) => str(v));
}
