import type { OutboxPort } from "../ports";
import type { OutboxEvent } from "../domain/models";
import { OutboxStatus } from "../domain/models";
import { db } from "../infrastructure/db/database";

export class OutboxRepository implements OutboxPort {
  async findPending(): Promise<OutboxEvent[]> {
    return db.outbox.where("status").equals(OutboxStatus.PENDING).toArray();
  }

  async append(event: OutboxEvent): Promise<void> {
    await db.outbox.add(event);
  }

  async updateStatus(id: string, status: OutboxStatus, sentAt?: string): Promise<void> {
    await db.outbox.update(id, { status, ...(sentAt ? { sentAt } : {}) });
  }
}
