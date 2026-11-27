import type { Page } from "playwright";
import type { ShowScreenshot } from "./check-browser";
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

export async function checkEvidence(staff: Page, show: ShowScreenshot) {
  const submit = staff.getByRole("button", { name: "Qualifikation einreichen" });
  const name = staff.getByLabel("Bezeichnung", { exact: true });
  const file = staff.locator('.file-picker input[type="file"]');
  const choose = staff.getByRole("button", { name: "Nachweis als PDF Datei wählen" });
  const contents = fixturePdf();
  await name.fill("Browsertest Nachweis");
  const [chooser] = await Promise.all([staff.waitForEvent("filechooser"), choose.click()]);
  await chooser.setFiles({ name: "browsertest.pdf", mimeType: "application/pdf", buffer: contents });
  await staff.getByRole("status").filter({ hasText: "browsertest.pdf" }).waitFor();
  await staff.getByRole("button", { name: "Nachweis als PDF Andere Datei wählen" }).waitFor();
  await submit.click();
  const link = staff.getByRole("link", { name: "PDF herunterladen" });
  await link.waitFor();
  const [download] = await Promise.all([staff.waitForEvent("download"), link.click()]);
  assert.equal(download.suggestedFilename(), "qualifikationsnachweis.pdf");
  assert.deepEqual(await readFile(await download.path()), contents);

  await name.fill("Ungültige Browserdatei");
  await file.setInputFiles({ name: "keine-pdf.txt", mimeType: "text/plain", buffer: Buffer.from("Nur Text") });
  await submit.click();
  await staff.getByText("Erlaubt sind PDF-Dateien bis 2 MB.", { exact: true }).waitFor();
  assert.equal(await choose.getAttribute("aria-invalid"), "true");
  assert.equal(await choose.evaluate(node => node === document.activeElement), true);
  assert.match(await choose.evaluate(node => (node.getAttribute("aria-describedby") ?? "").split(" ")
    .map(id => document.getElementById(id)?.textContent).join(" ")), /Erlaubt sind PDF-Dateien bis 2 MB\./);
  assert.equal(await name.inputValue(), "Ungültige Browserdatei");
  await show(staff, "pdf-formatfehler");
  await name.fill("Browsertest Nachweis");
  await file.setInputFiles({ name: "browsertest.pdf", mimeType: "application/pdf", buffer: contents });
  await submit.click();
  await link.waitFor();
  assert.equal(await staff.getByText("ungültige browserdatei", { exact: true }).count(), 0);
  assert.equal(await link.count(), 1);
}
