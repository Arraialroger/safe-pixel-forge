/**
 * Utilitários de telefone BR para WhatsApp.
 * Formato esperado: (XX) XXXXX-XXXX (celular) ou (XX) XXXX-XXXX (fixo).
 */

/** Mantém apenas dígitos. */
export function onlyDigits(value: string): string {
  return value.replace(/\D+/g, "");
}

/** Formata progressivamente enquanto o usuário digita. */
export function formatBRPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  const len = digits.length;

  if (len === 0) return "";
  if (len < 3) return `(${digits}`;
  if (len < 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (len <= 10) {
    // Fixo: (XX) XXXX-XXXX
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  // Celular: (XX) XXXXX-XXXX
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Valida 10 (fixo) ou 11 (celular) dígitos. */
export function isValidBRPhone(value: string): boolean {
  const d = onlyDigits(value);
  return d.length === 10 || d.length === 11;
}

/** Devolve só dígitos para persistência. */
export function normalizeBRPhone(value: string): string {
  return onlyDigits(value);
}
