/**
 * WorkflowScheduler — wraps node-cron for persistent workflow schedules.
 */

import cron from "node-cron";
import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { WorkflowEngine } from "./WorkflowEngine.js";

const SCHEDULES_PATH = process.env.SCHEDULES_PATH ?? join("data", "workflows", "schedules.json");

export interface WorkflowSchedule {
  id: string;
  name: string;
  cron_expr: string;
  stages: string[];
  enabled: boolean;
  created_at: string;
  last_run?: string;
  next_run?: string;
}

class WorkflowSchedulerImpl {
  private schedules = new Map<string, WorkflowSchedule>();
  private tasks = new Map<string, cron.ScheduledTask>();

  load(): void {
    try {
      if (!existsSync(SCHEDULES_PATH)) return;
      const data: WorkflowSchedule[] = JSON.parse(readFileSync(SCHEDULES_PATH, "utf8"));
      for (const s of data) {
        this.schedules.set(s.id, s);
        if (s.enabled) this.startTask(s);
      }
    } catch { /* ignore load errors */ }
  }

  private save(): void {
    try {
      const dir = SCHEDULES_PATH.split("/").slice(0, -1).join("/");
      if (dir) mkdirSync(dir, { recursive: true });
      writeFileSync(SCHEDULES_PATH, JSON.stringify([...this.schedules.values()], null, 2));
    } catch { /* ignore save errors */ }
  }

  private startTask(schedule: WorkflowSchedule): void {
    if (!cron.validate(schedule.cron_expr)) return;
    const task = cron.schedule(schedule.cron_expr, async () => {
      schedule.last_run = new Date().toISOString();
      await WorkflowEngine.run(schedule.stages);
      this.save();
    });
    this.tasks.set(schedule.id, task);
  }

  upsert(data: Omit<WorkflowSchedule, "id" | "created_at">): WorkflowSchedule {
    const existing = [...this.schedules.values()].find(s => s.name === data.name);
    const id = existing?.id ?? randomUUID();
    if (existing) { this.tasks.get(id)?.stop(); this.tasks.delete(id); }
    const schedule: WorkflowSchedule = { ...data, id, created_at: existing?.created_at ?? new Date().toISOString() };
    this.schedules.set(id, schedule);
    if (schedule.enabled) this.startTask(schedule);
    this.save();
    return schedule;
  }

  delete(id: string): boolean {
    if (!this.schedules.has(id)) return false;
    this.tasks.get(id)?.stop();
    this.tasks.delete(id);
    this.schedules.delete(id);
    this.save();
    return true;
  }

  list(): WorkflowSchedule[] {
    return [...this.schedules.values()];
  }
}

export const WorkflowScheduler = new WorkflowSchedulerImpl();
