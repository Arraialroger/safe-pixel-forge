// Helpers para máscara de valor em BRL no input.

/** Recebe qualquer string digitada e devolve "R$ 1.234,56". Trata centavos. */
export function formatBRLInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const number = Number(digits) / 100;
  return number.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Converte uma string mascarada ("R$ 1.234,56") em number (1234.56). */
export function parseBRLToNumber(masked: string): number {
  const digits = masked.replace(/\D/g, "");
  if (!digits) return 0;
  return Number(digits) / 100;
}
