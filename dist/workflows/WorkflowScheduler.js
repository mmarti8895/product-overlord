/**
 * WorkflowScheduler — wraps node-cron for persistent workflow schedules.
 */
import cron from "node-cron";
import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { WorkflowEngine } from "./WorkflowEngine.js";
const SCHEDULES_PATH = process.env.SCHEDULES_PATH ?? join("data", "workflows", "schedules.json");
class WorkflowSchedulerImpl {
    schedules = new Map();
    tasks = new Map();
    load() {
        try {
            if (!existsSync(SCHEDULES_PATH))
                return;
            const data = JSON.parse(readFileSync(SCHEDULES_PATH, "utf8"));
            for (const s of data) {
                this.schedules.set(s.id, s);
                if (s.enabled)
                    this.startTask(s);
            }
        }
        catch { /* ignore load errors */ }
    }
    save() {
        try {
            const dir = SCHEDULES_PATH.split("/").slice(0, -1).join("/");
            if (dir)
                mkdirSync(dir, { recursive: true });
            writeFileSync(SCHEDULES_PATH, JSON.stringify([...this.schedules.values()], null, 2));
        }
        catch { /* ignore save errors */ }
    }
    startTask(schedule) {
        if (!cron.validate(schedule.cron_expr))
            return;
        const task = cron.schedule(schedule.cron_expr, async () => {
            schedule.last_run = new Date().toISOString();
            await WorkflowEngine.run(schedule.stages);
            this.save();
        });
        this.tasks.set(schedule.id, task);
    }
    upsert(data) {
        const existing = [...this.schedules.values()].find(s => s.name === data.name);
        const id = existing?.id ?? randomUUID();
        if (existing) {
            this.tasks.get(id)?.stop();
            this.tasks.delete(id);
        }
        const schedule = { ...data, id, created_at: existing?.created_at ?? new Date().toISOString() };
        this.schedules.set(id, schedule);
        if (schedule.enabled)
            this.startTask(schedule);
        this.save();
        return schedule;
    }
    delete(id) {
        if (!this.schedules.has(id))
            return false;
        this.tasks.get(id)?.stop();
        this.tasks.delete(id);
        this.schedules.delete(id);
        this.save();
        return true;
    }
    list() {
        return [...this.schedules.values()];
    }
}
export const WorkflowScheduler = new WorkflowSchedulerImpl();
