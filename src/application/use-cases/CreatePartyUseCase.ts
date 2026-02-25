import type {
  PartyRepositoryPort,
  EventLogPort,
  OutboxPort,
  RngPort,
  ClockPort,
} from "../../ports";
import { createCharacter } from "../../domain/rules/character";
import {
  GameMode,
  Talent,
  PartyStatus,
  TimelineEventType,
  OutboxStatus,
} from "../../domain/models";
import type { Party } from "../../domain/models";

export interface CreatePartyInput {
  name: string;
  mode: GameMode;
  talent: Talent;
  characterName: string;
}

export class CreatePartyUseCase {
  constructor(
    private readonly partyRepo: PartyRepositoryPort,
    private readonly eventLog: EventLogPort,
    private readonly outbox: OutboxPort,
    private readonly rng: RngPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: CreatePartyInput): Promise<Party> {
    const hpRoll = this.rng.rollNd6(2).reduce((a, b) => a + b, 0);
    const luckRoll = this.rng.rollD6();
    const now = this.clock.now();
    const id = crypto.randomUUID();

    const character = createCharacter({
      name: input.characterName,
      talent: input.talent,
      hpRoll,
      luckRoll,
    });

    const party: Party = {
      id,
      name: input.name,
      mode: input.mode,
      status: PartyStatus.ACTIVE,
      currentChapter: 1,
      character,
      createdAt: now,
      updatedAt: now,
    };

    await this.partyRepo.save(party);

    await this.eventLog.append({
      id: crypto.randomUUID(),
      partyId: id,
      type: TimelineEventType.PARTY_CREATED,
      label: `Partie "${input.name}" créée (mode ${input.mode})`,
      payload: { mode: input.mode, talent: input.talent, hpRoll, luckRoll },
      createdAt: now,
    });

    await this.outbox.append({
      id: crypto.randomUUID(),
      partyId: id,
      type: TimelineEventType.PARTY_CREATED,
      payload: { partyId: id, name: input.name, mode: input.mode },
      status: OutboxStatus.PENDING,
      createdAt: now,
    });

    return party;
  }
}
