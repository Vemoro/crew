export class InputError extends Error {}

export function requireInput(condition: unknown, message: string): asserts condition {
  if (!condition) throw new InputError(message);
}

export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  requireInput(email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'E-Mail-Adresse prüfen.');
  return email;
}

export function verifyPasswordLength(password: string) {
  requireInput(password.length >= 12 && password.length <= 128, 'Das Passwort braucht 12 bis 128 Zeichen.');
  requireInput(!/[\r\n]/.test(password), 'Das Passwort darf keine Zeilenumbrüche enthalten.');
}

export function qualificationName(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');
}
