import type { EventLogPort, ClockPort } from "../../ports";
import { TimelineEventType } from "../../domain/models";

export class AddCustomActionUseCase {
  constructor(
    private readonly eventLog: EventLogPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(partyId: string, label: string): Promise<void> {
    const now = this.clock.now();
    await this.eventLog.append({
      id: crypto.randomUUID(),
      partyId,
      type: TimelineEventType.CUSTOM_ACTION,
      label,
      createdAt: now,
    });
  }
}
