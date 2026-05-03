/**
 * Canonical Ticket Normaliser
 *
 * Merges raw Jira API fields into a single CanonicalTicket schema.
 * Resolves all 8 Atlassian acceptance-criteria field aliases.
 * Normalises linked artifacts and dependency relationships.
 */

import type { CanonicalTicket, Dependency, LinkedArtifact } from "../types/index.js";
import type { RawIssue } from "../adapters/rovo-mcp.js";

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
] as const;

export type AcAlias = (typeof AC_ALIASES)[number];

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

export function normaliseTicket(
  raw: RawIssue,
  opts: { boardId?: string; sprintId?: string } = {}
): CanonicalTicket {
  const f = raw.fields as Record<string, unknown>;

  return {
    ticket_key: raw.key,
    ticket_type: resolveIssueType(f),
    summary: str(f["summary"]),
    description: resolveDescription(f),
    acceptance_criteria: resolveAc(f).value,
    ac_field_source: resolveAc(f).source,
    issue_type: str((f["issuetype"] as Record<string, unknown> | undefined)?.["name"]),
    status: str((f["status"] as Record<string, unknown> | undefined)?.["name"]),
    labels: strArray(f["labels"]),
    priority: str((f["priority"] as Record<string, unknown> | undefined)?.["name"]),
    reporter: resolveUser(f["reporter"]),
    assignee: resolveUser(f["assignee"]) || null,
    linked_artifacts: resolveLinkedArtifacts(f),
    dependencies: resolveDependencies(f),
    comments: resolveComments(f),
    board_id: opts.boardId ?? null,
    sprint_id: opts.sprintId ?? resolveSprintId(f),
    epic_key:  str((f["epic"] as Record<string, unknown> | undefined)?.["key"]) || null,
    fix_versions: strArray(
      ((f["fixVersions"] as { name?: string }[] | undefined) ?? []).map((v) => v.name ?? "")
    ),
    raw_fields: f,
  };
}

// ---------------------------------------------------------------------------
// Acceptance-criteria resolution
// ---------------------------------------------------------------------------

export function resolveAc(fields: Record<string, unknown>): {
  value: string | null;
  source: string | null;
} {
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
    if (!key.startsWith("customfield_")) continue;
    const nested = val as Record<string, unknown> | null | undefined;
    if (!nested) continue;
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

function resolveIssueType(fields: Record<string, unknown>): string {
  const raw = str((fields["issuetype"] as Record<string, unknown> | undefined)?.["name"]).toLowerCase();
  if (raw.includes("story")) return "story";
  if (raw.includes("bug")) return "bug";
  if (raw.includes("task")) return "task";
  return raw || "task";
}

function resolveDescription(fields: Record<string, unknown>): string {
  const desc = fields["description"];
  if (!desc) return "";
  if (typeof desc === "string") return desc;
  // Atlassian Document Format (ADF) — extract plain text from content nodes
  return extractAdfText(desc as Record<string, unknown>);
}

function extractAdfText(node: Record<string, unknown>): string {
  if (node["type"] === "text") return str(node["text"]);
  const content = node["content"];
  if (Array.isArray(content)) {
    return (content as Record<string, unknown>[]).map(extractAdfText).join(" ");
  }
  return "";
}

function resolveUser(val: unknown): string {
  if (!val) return "";
  const u = val as Record<string, unknown>;
  return str(u["displayName"] ?? u["name"] ?? u["emailAddress"]);
}

function resolveLinkedArtifacts(fields: Record<string, unknown>): LinkedArtifact[] {
  const links = fields["issuelinks"];
  if (!Array.isArray(links)) return [];
  return (links as Record<string, unknown>[]).flatMap((link) => {
    const results: LinkedArtifact[] = [];
    if (link["inwardIssue"]) {
      const issue = link["inwardIssue"] as Record<string, unknown>;
      results.push({
        key: str(issue["key"]),
        relationship: str((link["type"] as Record<string, unknown> | undefined)?.["inward"]),
        url: str(issue["self"]),
      });
    }
    if (link["outwardIssue"]) {
      const issue = link["outwardIssue"] as Record<string, unknown>;
      results.push({
        key: str(issue["key"]),
        relationship: str((link["type"] as Record<string, unknown> | undefined)?.["outward"]),
        url: str(issue["self"]),
      });
    }
    return results;
  });
}

function resolveDependencies(fields: Record<string, unknown>): Dependency[] {
  const links = fields["issuelinks"];
  if (!Array.isArray(links)) return [];
  const deps: Dependency[] = [];

  for (const link of links as Record<string, unknown>[]) {
    const relType = (link["type"] as Record<string, unknown> | undefined);
    const inward = str(relType?.["inward"]).toLowerCase();
    const outward = str(relType?.["outward"]).toLowerCase();

    if (link["inwardIssue"] && BLOCKER_RELATIONSHIPS.has(inward)) {
      const issue = link["inwardIssue"] as Record<string, unknown>;
      deps.push({
        key: str(issue["key"]),
        relationship: inward,
        status: str((issue["fields"] as Record<string, unknown> | undefined)?.["status"]),
      });
    }
    if (link["outwardIssue"] && BLOCKER_RELATIONSHIPS.has(outward)) {
      const issue = link["outwardIssue"] as Record<string, unknown>;
      deps.push({
        key: str(issue["key"]),
        relationship: outward,
        status: str((issue["fields"] as Record<string, unknown> | undefined)?.["status"]),
      });
    }
  }
  return deps;
}

function resolveComments(fields: Record<string, unknown>): string[] {
  const commentBlock = fields["comment"] as Record<string, unknown> | undefined;
  const comments = commentBlock?.["comments"];
  if (!Array.isArray(comments)) return [];
  return (comments as Record<string, unknown>[]).map((c) => {
    const body = c["body"];
    if (typeof body === "string") return body;
    return extractAdfText(body as Record<string, unknown>);
  });
}

function resolveSprintId(fields: Record<string, unknown>): string | null {
  // Sprint is typically a customfield array
  for (const val of Object.values(fields)) {
    if (Array.isArray(val) && val.length > 0) {
      const first = val[0] as Record<string, unknown>;
      if (typeof first?.["id"] === "number" && typeof first?.["name"] === "string" && first?.["state"]) {
        return String(first["id"]);
      }
    }
  }
  return null;
}

function str(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}

function strArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.map((v) => str(v));
}
