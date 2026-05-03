import { describe, it, expect, vi, beforeEach } from "vitest";
import { VelocityTracker } from "../../services/velocity-tracker.js";
import type { JiraAgileRestAdapter } from "../../adapters/jira-agile-rest.js";

const DONE = ["Done", "Closed"];

describe("VelocityTracker", () => {
  describe("Fixture C — 0 closed sprints", () => {
    it("returns an empty array", async () => {
      const jira: JiraAgileRestAdapter = {
        listSprints: vi.fn().mockResolvedValue({ sprints: [], trace: {} }),
        getSprintIssues: vi.fn(),
      } as unknown as JiraAgileRestAdapter;
      const tracker = new VelocityTracker(jira, DONE);
      const pts = await tracker.getVelocity(1, 6);
      expect(pts).toEqual([]);
    });
  });
});
