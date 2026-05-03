import { describe, it, expect } from "vitest";
import { VelocityTracker } from "../../services/velocity-tracker.js";
describe("min", () => {
    it("imports ok", () => {
        expect(VelocityTracker).toBeDefined();
    });
});
