import type { ExportPort, ImportPort } from "../ports";
import type { PartySnapshot } from "../domain/models";

const EXPORT_VERSION = 1;

interface ExportEnvelope {
  version: number;
  exportedAt: string;
  snapshot: PartySnapshot;
}

export class JsonExportAdapter implements ExportPort, ImportPort {
  exportParty(snapshot: PartySnapshot): string {
    const envelope: ExportEnvelope = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      snapshot,
    };
    return JSON.stringify(envelope, null, 2);
  }

  exportSummary(snapshot: PartySnapshot): string {
    const { party } = snapshot;
    const char = party.character;
    const lines = [
      `=== ${party.name} ===`,
      `Mode : ${party.mode}`,
      `Statut : ${party.status}`,
      `Chapitre : ${party.currentChapter}`,
      ``,
      `--- Personnage ---`,
      `Nom : ${char.name}`,
      `Talent : ${char.talent}`,
      `PV : ${char.hpCurrent} / ${char.hpMax}`,
      `Chance : ${char.luck}`,
      `Dextérité : ${char.dexterity}`,
      ``,
      `Sauvegardes : ${snapshot.saveSlots.length} / 3`,
      `Notes : ${snapshot.notes.length}`,
      ``,
      `Exporté le ${new Date().toLocaleString("fr-FR")}`,
    ];
    return lines.join("\n");
  }

  importParty(data: string): PartySnapshot {
    let envelope: ExportEnvelope;
    try {
      envelope = JSON.parse(data) as ExportEnvelope;
    } catch {
      throw new Error("Fichier JSON invalide.");
    }
    if (!envelope.snapshot || !envelope.snapshot.party) {
      throw new Error("Format de sauvegarde non reconnu.");
    }
    return envelope.snapshot;
  }
}
