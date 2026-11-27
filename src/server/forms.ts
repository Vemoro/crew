import { InputError, requireInput } from './inputs';

const maxBody = 2_200_000;

export function field(form: FormData, key: string, max: number, required = true) {
  const value = form.get(key) ?? "";
  requireInput(typeof value === "string", "Ungültige Eingabe.");
  const trimmed = value.trim();
  requireInput(trimmed.length <= max && (!required || trimmed.length > 0),
    `Bitte prüfe die Eingabe. Erlaubt sind bis zu ${max} Zeichen.`);
  return trimmed;
}

export function id(form: FormData, key: string) {
  const value = Number(form.get(key));
  requireInput(Number.isSafeInteger(value) && value > 0 && value <= 2147483647, "Ungültiger Eintrag.");
  return value;
}

export function lines(form: FormData, key: string) {
  const values = field(form, key, 2000, false).split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  requireInput(values.length <= 10 && values.every(value => value.length <= 200), "Bis zu zehn Zeilen mit je 200 Zeichen sind möglich.");
  return values;
}

export function expiration(value: string) {
  if (!value) return "";
  const date = new Date(value + "T00:00:00Z");
  requireInput(/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(+date) && date.toISOString().slice(0, 10) === value,
    "Datum für den Nachweis prüfen.");
  return value;
}

export function localTime(value: string) {
  const date = new Date(value);
  const format = new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short" });
  requireInput(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && Number.isFinite(+date) &&
    format.format(date).replace(" ", "T") === value, "Datum und Uhrzeit prüfen.");
  return date.toISOString();
}

export async function readForm(req: Request) {
  const type = req.headers.get("content-type") ?? "";
  requireInput(type.startsWith("application/x-www-form-urlencoded") || type.startsWith("multipart/form-data;"), "Ungültiges Formular.");
  requireInput(Number(req.headers.get("content-length") || 0) <= maxBody, "Die Datei ist zu groß.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  const reader = req.body?.getReader();
  if (reader) {
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.length;
        requireInput(bytes <= maxBody, "Die Datei ist zu groß.");
        chunks.push(part.value);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally {
      reader.releaseLock();
    }
  }
  try {
    return await new Response(Buffer.concat(chunks), { headers: { "Content-Type": type } }).formData();
  } catch {
    throw new InputError("Das Formular konnte nicht gelesen werden.");
  }
}
