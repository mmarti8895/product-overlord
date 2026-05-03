import { describe, it, expect } from "vitest";
import { normaliseTicket, resolveAc, AC_ALIASES } from "../../normaliser/normalise.js";
import type { RawIssue } from "../../adapters/rovo-mcp.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRaw(fields: Record<string, unknown>, key = "ABC-123"): RawIssue {
  return { key, fields };
}

function baseFields(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    summary: "Test summary",
    description: "Test description",
    issuetype: { name: "Story" },
    status: { name: "In Progress" },
    labels: ["backend"],
    priority: { name: "High" },
    reporter: { displayName: "Alice" },
    assignee: { displayName: "Bob" },
    issuelinks: [],
    comment: { comments: [] },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC alias detection — all 8 variants
// ---------------------------------------------------------------------------

describe("resolveAc — all 8 AC alias variants", () => {
  for (const alias of AC_ALIASES) {
    it(`detects alias "${alias}"`, () => {
      const fields = { [alias]: "Must do X when Y happens." };
      const result = resolveAc(fields);
      expect(result.value).toBe("Must do X when Y happens.");
      expect(result.source).toBe(alias);
    });
  }

  it("detects alias case-insensitively (e.g. 'acceptance criteria')", () => {
    const fields = { "acceptance criteria": "some criteria" };
    const result = resolveAc(fields);
    expect(result.value).toBe("some criteria");
  });
});

// ---------------------------------------------------------------------------
// Missing AC → null
// ---------------------------------------------------------------------------

describe("resolveAc — missing AC", () => {
  it("returns null value and null source when no AC field exists", () => {
    const result = resolveAc({ summary: "no ac here" });
    expect(result.value).toBeNull();
    expect(result.source).toBeNull();
  });

  it("returns null for empty-string AC field", () => {
    const result = resolveAc({ "Acceptance Criteria": "   " });
    expect(result.value).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Full normaliseTicket
// ---------------------------------------------------------------------------

describe("normaliseTicket", () => {
  it("maps basic fields correctly", () => {
    const raw = makeRaw(baseFields({ "Acceptance Criteria": "User can log in" }));
    const ticket = normaliseTicket(raw);
    expect(ticket.ticket_key).toBe("ABC-123");
    expect(ticket.summary).toBe("Test summary");
    expect(ticket.acceptance_criteria).toBe("User can log in");
    expect(ticket.ac_field_source).toBe("Acceptance Criteria");
    expect(ticket.ticket_type).toBe("story");
    expect(ticket.labels).toEqual(["backend"]);
    expect(ticket.reporter).toBe("Alice");
    expect(ticket.assignee).toBe("Bob");
  });

  it("sets AC to null and missing-item severity high when no AC field", () => {
    const raw = makeRaw(baseFields());
    const ticket = normaliseTicket(raw);
    expect(ticket.acceptance_criteria).toBeNull();
    expect(ticket.ac_field_source).toBeNull();
  });

  it("uses board_id and sprint_id from opts", () => {
    const raw = makeRaw(baseFields());
    const ticket = normaliseTicket(raw, { boardId: "42", sprintId: "7" });
    expect(ticket.board_id).toBe("42");
    expect(ticket.sprint_id).toBe("7");
  });
});

// ---------------------------------------------------------------------------
// Dependency normalisation
// ---------------------------------------------------------------------------

describe("normaliseTicket — dependency normalisation", () => {
  it("extracts 'is blocked by' links as dependencies", () => {
    const raw = makeRaw(
      baseFields({
        issuelinks: [
          {
            type: { inward: "is blocked by", outward: "blocks" },
            inwardIssue: { key: "DEP-1", self: "https://jira/DEP-1", fields: { status: "Open" } },
          },
        ],
      })
    );
    const ticket = normaliseTicket(raw);
    expect(ticket.dependencies).toHaveLength(1);
    expect(ticket.dependencies[0].key).toBe("DEP-1");
    expect(ticket.dependencies[0].relationship).toBe("is blocked by");
  });

  it("returns empty dependencies when no links", () => {
    const raw = makeRaw(baseFields({ issuelinks: [] }));
    expect(normaliseTicket(raw).dependencies).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-project partial-access redaction
// ---------------------------------------------------------------------------

describe("normaliseTicket — cross-project key detection", () => {
  it("preserves project key in ticket_key", () => {
    const raw = makeRaw(baseFields(), "PROJ-99");
    expect(normaliseTicket(raw).ticket_key).toBe("PROJ-99");
  });
});

// ---------------------------------------------------------------------------
// ADF description extraction
// ---------------------------------------------------------------------------

describe("normaliseTicket — ADF description", () => {
  it("extracts plain text from ADF content nodes", () => {
    const adf = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello " }, { type: "text", text: "world" }] },
      ],
    };
    const raw = makeRaw(baseFields({ description: adf }));
    expect(normaliseTicket(raw).description).toContain("Hello");
    expect(normaliseTicket(raw).description).toContain("world");
  });
});
