// Tipos compartilhados para Vaults (alinhados ao schema do Supabase).
export type VaultStatus = "pending" | "paid";

export interface Vault {
  id: string;
  title: string;
  client_name: string;
  client_email: string | null;
  client_whatsapp: string | null;
  price: number;
  status: VaultStatus;
  owner_id: string;
  public_slug: string;
  file_path: string | null;
  file_name: string | null;
  created_at: string;
  expires_at: string | null;
  downloaded_at: string | null;
}

export function isExpired(vault: Pick<Vault, "expires_at">): boolean {
  if (!vault.expires_at) return false;
  return new Date(vault.expires_at).getTime() < Date.now();
}

export function formatExpiryDate(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  return new Date(expiresAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function statusLabel(status: VaultStatus): string {
  return status === "paid" ? "Pago" : "Pendente";
}
