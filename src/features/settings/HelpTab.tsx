import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "O Pix do meu cliente demora a cair?",
    a: "Não. Pagamentos via Pix são aprovados em segundos. Assim que o Mercado Pago confirma o pagamento, o cofre é liberado automaticamente para o cliente e o valor cai direto na sua conta Mercado Pago.",
  },
  {
    q: "Como saco o dinheiro das minhas vendas?",
    a: "O dinheiro cai direto na sua conta Mercado Pago (o PixelSafe não toca no seu dinheiro). De lá, você transfere para sua conta bancária pelo app do Mercado Pago, sem custo via Pix.",
  },
  {
    q: "Meu cliente pagou mas não recebeu o arquivo. E agora?",
    a: "Abra o cofre na lista e use o botão 'Reenviar e-mail'. Se o problema persistir, verifique se o e-mail do cliente está correto e peça para ele checar a caixa de spam. O link de download também fica disponível no histórico do cofre.",
  },
  {
    q: "Como cancelo meu plano Pro?",
    a: "Na aba 'Plano' acima, clique em 'Cancelar Assinatura'. Você volta automaticamente ao plano PayGo (sem mensalidade) e continua vendendo normalmente, apenas com a taxa de 2,9% por venda voltando a ser aplicada.",
  },
  {
    q: "Preciso devolver um pagamento. Como faço o reembolso?",
    a: "Reembolsos são feitos direto pelo Mercado Pago, dentro de 90 dias do pagamento. Acesse sua conta Mercado Pago > Atividade > selecione a venda > 'Devolver'. Após o reembolso, o acesso ao cofre pelo cliente é revogado.",
  },
  {
    q: "Posso trocar o arquivo de um cofre depois de criado?",
    a: "Não. Para preservar a integridade da entrega (e a confiança do cliente), o arquivo é imutável após o cofre ser criado. Se precisar substituir, crie um novo cofre e cancele o anterior.",
  },
  {
    q: "Qual o tamanho máximo de arquivo que posso enviar?",
    a: "No plano PayGo, até 500 MB por cofre. No plano Pro, até 2 GB por cofre. Para entregas maiores, recomendamos hospedar em armazenamento externo (WeTransfer, Drive) e usar o cofre como portão de pagamento com o link.",
  },
];

export function HelpTab() {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-foreground">Ajuda rápida</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          As perguntas mais comuns dos editores que usam o PixelSafe.
        </p>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {FAQS.map((item, i) => (
          <AccordionItem key={i} value={`faq-${i}`}>
            <AccordionTrigger className="text-left text-sm font-medium text-foreground">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
        Não encontrou sua resposta? Fale com a gente:{" "}
        <a
          href="mailto:suporte@pixelsafe.com.br"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          suporte@pixelsafe.com.br
        </a>
      </p>
    </section>
  );
}
