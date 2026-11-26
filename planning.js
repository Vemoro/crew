import { requireInput, transaction } from "./model.js";

export function correctEvent(db, { event, revision, location, instructions }) {
  transaction(db, () => {
    const previous = db.prepare("SELECT location,instructions,revision FROM events WHERE id=?").get(event);
    requireInput(previous?.revision === revision, "Der Einsatz hat sich geändert. Bitte öffne die aktuellen Angaben.");
    db.prepare(`UPDATE shifts SET locked_location=?,locked_instructions=?
      WHERE event=? AND locked_location IS NULL AND (starts<=? OR cancelled_at IS NOT NULL)`)
      .run(previous.location, previous.instructions, event, new Date().toISOString());
    db.prepare("UPDATE events SET location=?,instructions=?,revision=revision+1 WHERE id=?")
      .run(location, instructions, event);
  });
}

export function cancelShift(db, shift, revision) {
  transaction(db, () => {
    const result = db.prepare(`UPDATE shifts SET cancelled_at=?,placement_revision=placement_revision+1
      WHERE id=? AND placement_revision=? AND starts>? AND cancelled_at IS NULL`);
    const now = new Date().toISOString();
    if (result.run(now, shift, revision, now).changes === 1) return;
    const current = db.prepare("SELECT cancelled_at,placement_revision FROM shifts WHERE id=?").get(shift);
    requireInput(current?.cancelled_at && current.placement_revision === revision + 1,
      "Die Schicht hat sich geändert oder bereits begonnen. Bitte prüfe den aktuellen Stand.");
  });
}

export function releasePlace(db, shift, person, revision) {
  transaction(db, () => {
    const result = db.prepare(`UPDATE responses SET status='withdrawn',released_by_dispo=1,revision=revision+1
      WHERE shift=? AND person=? AND revision=? AND status='assigned'
      AND EXISTS (SELECT 1 FROM shifts WHERE id=? AND starts>? AND cancelled_at IS NULL)`)
      .run(shift, person, revision, shift, new Date().toISOString());
    if (result.changes === 1) {
      db.prepare("UPDATE shifts SET placement_revision=placement_revision+1 WHERE id=?").run(shift);
      return;
    }
    const current = db.prepare("SELECT status,released_by_dispo,revision FROM responses WHERE shift=? AND person=?")
      .get(shift, person);
    requireInput(current?.status === "withdrawn" && current.released_by_dispo && current.revision === revision + 1,
      "Die Besetzung hat sich geändert oder die Schicht ist nicht mehr offen.");
  });
}
