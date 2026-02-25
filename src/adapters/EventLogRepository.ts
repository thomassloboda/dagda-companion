import type { EventLogPort } from "../ports";
import type { TimelineEvent } from "../domain/models";
import { db } from "../infrastructure/db/database";

export class EventLogRepository implements EventLogPort {
  async findByPartyId(partyId: string): Promise<TimelineEvent[]> {
    return db.timeline.where("partyId").equals(partyId).reverse().sortBy("createdAt");
  }

  async append(event: TimelineEvent): Promise<void> {
    await db.timeline.add(event);
  }
}
