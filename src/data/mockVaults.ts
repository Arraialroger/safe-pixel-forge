export type VaultStatus = "pendente" | "pago";

export interface Vault {
  id: string;
  project: string;
  client: string;
  amount: number; // em reais
  status: VaultStatus;
}

export const initialVaults: Vault[] = [
  {
    id: "v-1",
    project: "Logo Café Raíz",
    client: "Marina Souza",
    amount: 850,
    status: "pendente",
  },
  {
    id: "v-2",
    project: "Edição Vídeo Casamento",
    client: "João Pereira",
    amount: 2400,
    status: "pago",
  },
  {
    id: "v-3",
    project: "Identidade Visual Studio Z",
    client: "Ana Lima",
    amount: 1600,
    status: "pendente",
  },
];

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
