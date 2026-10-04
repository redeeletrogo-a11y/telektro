# Eletroposto pré-pago por QR (piloto)

Motorista sem conta escaneia o QR do carregador, informa nome e e-mail, escolhe um **valor máximo** em R$ e paga por Pix (Mercado Pago). O carregador só é liberado depois do pagamento confirmado. A recarga para sozinha perto do valor pago, cobra-se o consumo **medido** (kWh × tarifa congelada) e a sobra é devolvida no mesmo Pix.

Escopo do piloto: 1 dono, 1 conector, só Pix. Conta de motorista/app, cartão, OAuth do dono e split/comissão ficam para a fase seguinte.

## Como funciona

1. `/carregar/<codigo>`: tela pública do QR (tarifa, valor, nome, e-mail, aceite). O banco valida tudo (`eletroposto_create_payment`): ponto ativo, carregador online, conector livre, tarifa, limites, limite de tentativas por IP.
2. O servidor cria o Pix no Mercado Pago com `external_reference = ep:<id>`. O valor sai do banco, nunca do navegador.
3. Webhook (`/api/billing/mercadopago/webhook`, mesma assinatura HMAC da mensalidade): o pagamento é **relido** no Mercado Pago, valor e moeda conferidos, e `eletroposto_mark_paid` (idempotente) enfileira o mesmo `RemoteStartTransaction` do painel, com idTag `TP...` sem usuário.
4. Ao abrir a sessão, o banco liga sessão ↔ pagamento. A cada leitura do medidor (trigger) calcula o consumo; ao chegar a (100 − margem)% do valor pago (margem padrão 5%) enfileira `RemoteStopTransaction`.
5. Fim da sessão: `eletroposto_advance` calcula `cobrado = min(consumo × tarifa, valor pago)` e `devolver = pago − cobrado`. O servidor faz o estorno parcial/total no Mercado Pago com chave de idempotência `ep-refund-<id>`.
6. Se o consumo passar do valor pago (parada lenta), o cliente paga no máximo o valor pago e o excedente fica por conta do operador (marcado em `attention_reason`).

## Casos tratados

| Caso | O que acontece |
| --- | --- |
| Pix não pago em 10 min | `expired`. Se o MP aprovar depois, devolução total (`late_payment`). |
| Pago, mas carregador offline/conector ocupado | Devolução total (`cannot_start`). |
| Comando de início rejeitado ou sem sessão em 12 min | Devolução total (`start_rejected`/`start_timeout`). Se uma sessão com aquele idTag aparecer depois, o banco manda parar. |
| Carro para antes do limite | Cobra o medido, devolve a sobra. |
| `meterStop < meterStart` ou leitura ausente | `review`: nada é cobrado nem devolvido sozinho; responsável confere. |
| Carregador sem sinal > 30 min com sessão aberta | `needs_attention` (a sessão não é encerrada sozinha). |
| Webhook repetido / fora de ordem | Idempotente (transições condicionais + chave de idempotência). |
| Estorno falha (ex.: saldo do vendedor) | Fica `settling`, `needs_attention`, nova tentativa a cada varredura. |

## Segurança

- Tabelas com RLS e **sem policies**; funções só para `service_role`. O visitante nunca fala direto com o banco.
- Segredos só no servidor (`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`).
- Página do pagamento usa token aleatório de 192 bits; não indexada (`noindex`).
- Webhook valida assinatura e relê o pagamento no MP.
- Um único pagamento ativo por conector (índice único parcial).

## Para ligar o piloto

1. Rodar `202610030020_eletroposto_prepago.sql` no SQL Editor do Supabase.
2. A conta (organização) do carregador precisa ser do tipo `eletroposto` e ter uma tarifa ativa (R$/kWh).
3. Criar o ponto (troque o ID do carregador):

```sql
insert into public.eletroposto_points (public_code, organization_id, charger_id, connector_id, enabled, min_amount, max_amount, stop_margin_pct)
select lower(encode(gen_random_bytes(8), 'hex')), c.organization_id, c.id, 1, true, 10, 100, 5
from public.chargers c where c.charge_point_id = 'ID-DO-CARREGADOR';
select public_code from public.eletroposto_points order by created_at desc limit 1;
```

4. O QR para imprimir é `https://telektro.com.br/carregar/<codigo>/qr` (PNG). A página é `https://telektro.com.br/carregar/<codigo>`.
5. Varredura (fecha recargas e devolve sobras mesmo se o motorista fechar a página): definir `CRON_SECRET` na Vercel. O `vercel.json` agenda 1 vez por dia (limite do plano Hobby). Para rodar a cada minuto, use o Supabase `pg_cron` + `pg_net` chamando `GET /api/eletroposto/sweep` com `Authorization: Bearer <CRON_SECRET>`. Enquanto o motorista está com a página aberta, ela mesma aciona a liquidação a cada 5 s.

## Fora do piloto (a fazer / validar)

- OAuth do Mercado Pago do dono + comissão (`marketplace_fee`/`application_fee`): exige credenciais da aplicação e confirmação comercial do Pix com split e estorno parcial. No piloto o Pix cai na conta MP configurada no servidor.
- Cartão, conta do motorista, recibo por e-mail, painel do dono com lista de pagamentos.
- Obrigações fiscais/legais da operação de eletroposto: validar com o contador.
- Teste real no carregador: o `RemoteStop` não garante parar no kWh exato; a margem (5%) precisa ser calibrada com o intervalo de `MeterValues` do equipamento.

## Aplicação própria do Mercado Pago (opcional)

O eletroposto pode usar uma aplicação do Mercado Pago só dele, para separar os pagamentos de residencial e condomínio:

- `MERCADOPAGO_ELETROPOSTO_ACCESS_TOKEN`: token de produção da aplicação do eletroposto (cria o Pix, relê o pagamento e devolve a sobra). Se não existir, usa `MERCADOPAGO_ACCESS_TOKEN`.
- `MERCADOPAGO_ELETROPOSTO_WEBHOOK_SECRET`: segredo do webhook dessa aplicação (URL `/api/billing/mercadopago/webhook`, evento "Pagamentos"). O webhook aceita o segredo padrão ou este.
- Se o pagamento notificado não pertence à aplicação do eletroposto (leitura 401/403/404 com token próprio), o fluxo segue como mensalidade, sem efeito no eletroposto.

## Cartão de crédito (reserva + captura parcial) e taxa da plataforma

- Pix continua igual e é o meio padrão. O cartão aparece quando `NEXT_PUBLIC_MERCADOPAGO_ELETROPOSTO_PUBLIC_KEY` está definida (chave pública da aplicação do eletroposto, não é segredo).
- Front: Card Payment Brick do Mercado Pago (Checkout Transparente) tokeniza o cartão no navegador; o servidor só recebe o token. 1x, só crédito. O device id (`MP_DEVICE_SESSION_ID`) vai no header `X-meli-session-id`.
- Servidor: `POST /v1/payments` com `capture=false` reserva o valor máximo. Reserva `authorized` libera a recarga pelo mesmo `eletroposto_mark_paid` e RemoteStart do Pix.
- Liquidação do cartão: captura parcial do consumo (`PUT /v1/payments/{id}` com `capture=true` e `transaction_amount` = valor cobrado). Se nada foi consumido (ou a recarga não iniciou), a reserva é cancelada. Não há reembolso: a sobra volta ao limite do cartão. A reserva expira em 5 dias; a varredura diária (`/api/eletroposto/sweep`) tenta capturar/cancelar de novo e o pagamento fica com `needs_attention` (`card_capture_failed`) se falhar.
- Chargeback (webhook `charged_back`): marca `needs_attention` com `attention_reason = 'chargeback'`.
- Taxa da plataforma (migration 202610030022): `platform_fee_pix_pct` (padrão 5) e `platform_fee_card_pct` (padrão 9) por ponto, gravadas em cada pagamento como `fee_pct` e calculadas na liquidação em `fee_amount` sobre o valor efetivamente cobrado. Não há repasse automático; é registro para o repasse ao proprietário. Tarifas do Mercado Pago (online): Pix 0,99%; crédito à vista 4,98% na hora, 4,49% em 14 dias, 3,98% em 30 dias; conferir no painel da conta.
- Ordem de rollout: rodar a migration 202610030022 (em 3 partes) ANTES do deploy; o código novo lê as colunas novas.

<!-- rebuild preview -->
