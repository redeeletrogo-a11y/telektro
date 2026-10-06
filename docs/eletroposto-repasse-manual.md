# Repasses: primeira etapa, manual

Não envia Pix, não ativa split, não muda credenciais Mercado Pago e não mexe na cobrança do motorista. Não confirma o tratamento fiscal; revisar com contabilidade e jurídico.

- Owner cadastra chave Pix e nome do titular. Admin lê extrato, mas não acessa ou altera chave. Histórico das mudanças fica só no servidor.
- Chave tem validação de formato, não de titularidade. Confirmar destinatário no banco antes de pagar.
- Extrato mensal usa `settled_at` (conclusão financeira da recarga), Fortaleza. Soma consumo cobrado e taxa congelada em centavos; nunca o valor máximo reservado.
- Pendentes, devoluções totais, alertas e taxa ausente não viram valor para pagar. Não é saldo Mercado Pago. Estornos posteriores e repasses externos exigem reconciliação.
- Não há botão de marcar pago. Não há acesso administrativo Nexa nem ledger de pagamentos realizados nesta etapa.
- Mensalidade do software não é descontada do repasse e não entra neste CSV. Taxas vigentes continuam por ponto/meio (5% Pix, 9% cartão). Não são editadas aqui.
- CSV: todos os registros elegíveis do mês, IDs de recargas sem dados pessoais de motoristas. Até 10.000 registros, depois bloqueia o total em vez de truncar silenciosamente.
- Migração: `docs/sql/01-eletroposto-repasse-manual.txt`, transacional/idempotente. Owner executa no Supabase; não aplicada automaticamente.
- Preview `/preview/repasse`: somente Vercel Preview, dados fictícios e leitura sem gravação. Em produção retorna 404.

## Validação antes do merge

Aplicar a migração com autorização do owner; testar owner/admin/membro e acesso cruzado entre organizações, salvar chave e conferir histórico, CSV/valores com recargas conciliadas. Validar no mês em que a recarga cruza a virada do mês. Preview com dados fictícios não substitui esses testes. Só merge após revisão do Maycon.
