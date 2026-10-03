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
