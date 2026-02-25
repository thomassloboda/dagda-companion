import type { PartyRepositoryPort } from "../../ports";

export class DeletePartyUseCase {
  constructor(private readonly partyRepo: PartyRepositoryPort) {}

  /** Supprime la partie et toutes ses données associées (cascade dans le repository). */
  async execute(partyId: string): Promise<void> {
    await this.partyRepo.delete(partyId);
  }
}
