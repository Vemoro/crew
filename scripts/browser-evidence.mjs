import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function fixturePdf() {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> >>"];
  let source = "%PDF-1.4\n";
  const entries = ["0000000000 65535 f \n"];
  for (const [index, object] of objects.entries()) {
    entries.push(`${String(source.length).padStart(10, "0")} 00000 n \n`);
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const offset = source.length;
  source += `xref\n0 ${entries.length}\n${entries.join("")}trailer\n<< /Size ${entries.length} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`;
  return Buffer.from(source);
}

export async function checkEvidence(staff, show) {
  const submit = staff.getByRole("button", { name: "Qualifikation einreichen" });
  const name = staff.getByLabel("Bezeichnung", { exact: true });
  const file = staff.getByLabel("Nachweis als PDF", { exact: false });
  const contents = fixturePdf();
  await name.fill("Browsertest Nachweis");
  await file.setInputFiles({ name: "browsertest.pdf", mimeType: "application/pdf", buffer: contents });
  await submit.click();
  const link = staff.getByRole("link", { name: "PDF herunterladen" });
  await link.waitFor();
  const [download] = await Promise.all([staff.waitForEvent("download"), link.click()]);
  assert.equal(download.suggestedFilename(), "qualifikationsnachweis.pdf");
  assert.deepEqual(await readFile(await download.path()), contents);

  await name.fill("Ungültige Browserdatei");
  await file.setInputFiles({ name: "keine-pdf.txt", mimeType: "text/plain", buffer: Buffer.from("Nur Text") });
  await submit.click();
  await staff.getByRole("alert").getByText("Erlaubt sind PDF-Dateien bis 2 MB.").waitFor();
  await show(staff, "pdf-formatfehler", false);
  await staff.getByRole("link", { name: "Zur Übersicht" }).click();
  assert.equal(await staff.getByText("ungültige browserdatei", { exact: true }).count(), 0);
  assert.equal(await link.count(), 1);
}
