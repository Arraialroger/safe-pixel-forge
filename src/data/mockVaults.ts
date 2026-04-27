// Tipos compartilhados para Vaults (alinhados ao schema do Supabase).
export type VaultStatus = "pending" | "paid";

export interface Vault {
  id: string;
  title: string;
  client_name: string;
  price: number;
  status: VaultStatus;
  owner_id: string;
  public_slug: string;
  file_path: string | null;
  file_name: string | null;
  created_at: string;
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
