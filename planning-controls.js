import { button, esc, hidden, label, post, textarea } from "./forms.js";

export function correctionForm(event, upcoming, failure) {
  const values = failure?.form;
  return `<details ${failure ? "open" : ""}><summary>Ort und Hinweise korrigieren</summary>
    ${failure ? `<p class="form-error" role="alert">${esc(failure.message)}</p>` : ""}
    ${upcoming.length ? `<p>Die Änderung betrifft diese Schichten</p><ul>${upcoming.map(shift => `<li>${esc(shift)}</li>`).join("")}</ul>`
      : "<p>Derzeit sind keine bevorstehenden Schichten betroffen.</p>"}
    <p>Begonnene, vergangene und zurückgenommene Schichten behalten ihre bisherigen Angaben.</p>
    ${post("/dispo/einsatz-korrigieren", hidden("event", event.id) + hidden("revision", event.revision)
      + label("Korrigierter Ort", `<input name="location" required maxlength="180" value="${esc(values?.get("location") ?? event.location)}">`)
      + label("Korrigierter Treffpunkt und Hinweise", textarea("instructions", 2000, values?.get("instructions") ?? event.instructions))
      + button("Angaben aktualisieren"))}</details>`;
}

function confirmation(id, toggleLabel, title, detail, action, fields, submitLabel) {
  return `<div class="secondary"><button type="button" data-open-dialog="${id}">${toggleLabel}</button></div>
    <dialog id="${id}" aria-labelledby="${id}-title">
      <h3 id="${id}-title">${title}</h3><p>${detail}</p>
      ${post(action, fields + `<div class="dialog-actions">
        <button class="quiet" type="submit" formmethod="dialog" autofocus>Abbrechen</button>
        <button class="danger" type="submit">${submitLabel}</button></div>`)}
    </dialog>`;
}

export function withdrawShiftControl(shift) {
  return confirmation(`cancel-dispo-${shift.id}`, "Schicht zurücknehmen", "Schicht zurücknehmen?",
    `„${esc(shift.title)}“ ist anschließend für weitere Bewerbungen und Einteilungen geschlossen. Die erwartete Vergütung für diese Schicht entfällt im Portal.`,
    "/dispo/schicht-zuruecknehmen", hidden("shift", shift.id) + hidden("revision", shift.placement_revision), "Rücknahme bestätigen");
}

export function releasePlaceControl(shift, response) {
  return confirmation(`release-${shift.id}-${response.person}`, "Platz freigeben", "Platz freigeben?",
    `Der Platz von ${esc(response.name)} in „${esc(shift.title)}“ wird wieder frei. Für diese Person entfällt die erwartete Vergütung für die Schicht.`,
    "/dispo/platz-freigeben", hidden("shift", shift.id) + hidden("person", response.person)
      + hidden("revision", response.revision), "Platzfreigabe bestätigen");
}
