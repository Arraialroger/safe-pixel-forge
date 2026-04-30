import type { Vault } from "@/data/mockVaults";
import { isExpired } from "@/data/mockVaults";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Retorna o número de dias restantes até `expires_at` (arredondado para cima).
 * - `null` se o cofre não tem `expires_at`.
 * - `0` se faltam menos de 24h e ainda não expirou.
 * - Negativo se já expirou.
 */
export function daysUntilExpiry(
  vault: Pick<Vault, "expires_at">,
): number | null {
  if (!vault.expires_at) return null;
  const diffMs = new Date(vault.expires_at).getTime() - Date.now();
  if (diffMs <= 0) return Math.ceil(diffMs / MS_PER_DAY); // negativo
  return Math.ceil(diffMs / MS_PER_DAY);
}

/**
 * `true` quando faltam 3 dias ou menos para expirar e o cofre ainda está ativo.
 * Usado para gatilhos de urgência (badge âmbar / aviso de checkout).
 */
export function isExpiringSoon(vault: Pick<Vault, "expires_at">): boolean {
  if (isExpired(vault)) return false;
  const days = daysUntilExpiry(vault);
  if (days === null) return false;
  return days <= 3;
}

/**
 * Texto amigável de urgência ("Expira hoje" / "Expira em X dias").
 * Retorna `null` se não estiver no estado "expirando em breve".
 */
export function expiringLabel(vault: Pick<Vault, "expires_at">): string | null {
  if (!isExpiringSoon(vault)) return null;
  const days = daysUntilExpiry(vault);
  if (days === null) return null;
  if (days <= 0) return "Expira hoje";
  if (days === 1) return "Expira em 1 dia";
  return `Expira em ${days} dias`;
}
