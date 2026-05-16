import { z } from "zod";
import { isValidBRPhone } from "@/lib/phone";
import { parseBRLToNumber } from "@/lib/currency";

export const MAX_FREE_FILE = 500 * 1024 * 1024; // 500MB
export const MAX_PRO_FILE = 2 * 1024 * 1024 * 1024; // 2GB
export const FREE_ACTIVE_LIMIT = 5;
export const ACTIVE_STATUSES = ["pending", "overdue"] as const;

export const schema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Informe o nome do projeto.")
    .max(80, "Máximo de 80 caracteres."),
  client_name: z
    .string()
    .trim()
    .min(2, "Informe o nome do cliente.")
    .max(80, "Máximo de 80 caracteres."),
  client_email: z
    .string()
    .trim()
    .email("E-mail inválido.")
    .max(120, "Máximo de 120 caracteres."),
  client_whatsapp: z
    .string()
    .trim()
    .max(16, "Número muito longo.")
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || isValidBRPhone(v),
      "Use DDD + número, ex.: (11) 99999-9999.",
    ),
  price_masked: z
    .string()
    .min(1, "Informe o valor.")
    .refine((v) => parseBRLToNumber(v) >= 0.5, "Valor mínimo de R$ 0,50.")
    .refine((v) => parseBRLToNumber(v) <= 9_999_999, "Valor muito alto."),
  allowed_payment_methods: z.enum(["pix", "all"], {
    required_error: "Escolha como você quer receber.",
  }),
  notify_client: z.boolean().default(true),
});

export type FormValues = z.infer<typeof schema>;
