// ─── Ticket domain types ──────────────────────────────────────────────────────

export type TicketPriority = 'critical' | 'high' | 'medium' | 'low';

export interface TicketSummary {
  key: string;
  summary: string;
  priority: TicketPriority;
  /** Ratio 0–1 of required DoR items marked done. */
  dorCompletionRatio: number;
}

// ─── Provider interface ───────────────────────────────────────────────────────

export interface TicketQueueProvider {
  /** Fetch the current list of tickets for review. */
  list(): Promise<TicketSummary[]>;
}

// ─── Stub implementation ──────────────────────────────────────────────────────

const STUB_TICKETS: TicketSummary[] = [
  {
    key: 'PROJ-314',
    summary: 'Harden credential rotation workflow',
    priority: 'critical',
    dorCompletionRatio: 0.75,
  },
  {
    key: 'PROJ-318',
    summary: 'Summarize incident retros in weekly digest',
    priority: 'high',
    dorCompletionRatio: 0.5,
  },
  {
    key: 'PROJ-322',
    summary: 'Expose ticket scaffold completion in command deck',
    priority: 'medium',
    dorCompletionRatio: 0.92,
  },
];

export const stubTicketProvider: TicketQueueProvider = {
  async list() {
    // Simulates async fetch; replace with Tauri command in Phase 2.
    return STUB_TICKETS;
  },
};
