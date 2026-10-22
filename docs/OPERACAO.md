# Telektro: manual de operação e recuperação

Atualizado em 21/10/2026. Este arquivo existe para recuperar o contexto do projeto se a memória ou o ambiente de quem trabalha nele for apagado. **Não contém segredos**: só nomes e lugares onde eles ficam. Quando este manual divergir do código, vale o código; quando divergir de `supabase/migrations/README.md`, vale a lista de SQLs deste manual (a tabela daquele README ficou desatualizada).

Documentos que complementam: `architecture.md`, `security.md`, `eletroposto-piloto.md`, `eletroposto-repasse-manual.md`, `ws-opcional.md`, `roadmap.md`.

## 1. O que é a Telektro

Plataforma para operar carregadores de carro elétrico: cadastrar carregadores (OCPP 1.6J), controlar a recarga (iniciar/parar), medir consumo e cobrar. Mantém-se simples: carregadores, controle de recarga e cobrança. Sem APIs externas extras e sem funções fora disso. "Funcional primeiro."

Tipos de conta (organização): residencial, condomínio e eletroposto (cobrança por QR, sem conta do motorista).

## 2. Arquitetura

| Peça | Onde | Função |
| --- | --- | --- |
| Web (`apps/web`) | Vercel, https://telektro.com.br | Next.js. Painel do dono, telas públicas do cliente (`/carregar/<codigo>`, `/carregar/pagamento/<token>`, `/recibo`), webhooks, varredura (`/api/eletroposto/sweep`). |
| Gateway OCPP (`apps/ocpp-gateway`) | Fly.io, app `telektro-ocpp-gateway`, região gru, https://telektro-ocpp-gateway.fly.dev | Mantém o WebSocket com cada carregador. Autentica, grava estado/sessões/medições, envia RemoteStart/RemoteStop, fecha sessões órfãs. `/health` mostra `connectedChargers`. |
| Banco | Supabase, projeto ref `ipgzatvoxcmzghantdqa` | PostgreSQL com RLS. Auth dos usuários. Regras de cobrança em funções SQL. |
| Pagamentos | Mercado Pago | Pix e cartão de crédito. Webhook em `/api/billing/mercadopago/webhook`. |
| Código | GitHub `redeeletrogo-a11y/telektro` | `main` = produção (Vercel faz deploy a cada merge). Cada PR gera um preview da Vercel protegido por login. |

O painel nunca fala direto com o carregador. O gateway não roda em serverless (conexão persistente). Web e gateway se falam por: banco (fila de comandos `commands`, tabelas de estado) e por HTTP (o gateway chama `SWEEP_URL` na web com `CRON_SECRET` para liquidar logo após uma recarga).

Portas do gateway no Fly (`fly.toml`): 443 (http+tls, wss e /health) e 80 (só http, para ws opcional). Porta interna 9000.

## 3. Fluxos

### 3.1 Pagamento do eletroposto (QR)

1. Cliente abre `/carregar/<codigo>` (ponto = carregador + conector). Informa nome, e-mail, telefone, valor máximo (mínimo R$ 10 e máximo R$ 100 no ponto piloto), aceita o termo e escolhe Pix ou cartão.
2. O banco valida tudo (`eletroposto_create_payment`): ponto ativo, carregador online, conector livre, tarifa, limites, limite de tentativas por IP. O valor vem do banco, nunca do navegador.
3. **Pix**: o servidor cria o Pix no Mercado Pago (`external_reference = ep:<id>`). Pagou, o webhook relê o pagamento no MP, confere valor e moeda e chama `eletroposto_mark_paid` (idempotente), que enfileira o RemoteStart. Não pago em 10 min: `expired`; se o MP aprovar depois, devolução total (`late_payment`).
4. **Cartão**: `POST /v1/payments` com `capture=false`, 1x, só crédito, tokenizado no navegador (Brick do MP). A reserva `authorized` libera a recarga. Nada é cobrado antes.
5. Durante a recarga, cada leitura do medidor calcula o consumo. Ao chegar a (100 − margem)% do valor pago (margem padrão 5%), o banco enfileira RemoteStop. O cliente pode parar antes pela tela.
6. Pagamento fica `paid`, depois `charging`, `settling`, `settled`.

Texto legal já decidido: Pix = "pago agora, a sobra volta no mesmo Pix" (não chamar de "reserva"). Cartão = "reserva no cartão, só o consumo é cobrado". Usar "comprovante" (não "recibo fiscal", e a página diz que não é nota fiscal). Sem prazo de reembolso em minutos.

### 3.2 Liquidação e devolução

`cobrado = min(consumo x tarifa + taxa de sessão, valor pago)`; `devolver = pago − cobrado` (função `eletroposto_advance`). A liquidação (`settleRefunds`, em `apps/web/src/lib/eletroposto.ts`) roda com:

- o gateway chamando `SWEEP_URL` (`/api/eletroposto/sweep`, protegido por `CRON_SECRET` no header Authorization Bearer) 2 s e 65 s depois do StopTransaction normal (o Pix só aceita devolução cerca de 60 s depois do pagamento);
- a página do cliente consultando a cada poucos segundos (também dispara liquidação);
- a varredura diária do `vercel.json` (09:00 UTC, limite do plano Hobby), como rede de segurança.

Pix: estorno parcial ou total no MP com chave de idempotência `ep-refund-<id>`. Cartão: captura parcial (`PUT /v1/payments/{id}`, `capture=true`, `transaction_amount` = cobrado, chave `ep-capture-<id>`); se nada foi consumido, cancela a reserva (`ep-cancel-<id>`). Cartão não tem reembolso: a sobra volta ao limite. Se capturar ou estornar falhar, o pagamento fica `settling` com `needs_attention` e é tentado de novo a cada varredura (a reserva de cartão vale cerca de 5 dias).

Taxa da plataforma: por ponto, `platform_fee_pix_pct` e `platform_fee_card_pct`, gravadas no pagamento (`fee_pct`) e calculadas sobre o valor efetivamente cobrado (`fee_amount`). Ponto piloto: 5% Pix, 5% cartão (os padrões da migration são 5 e 9).

Casos: pago mas carregador offline ou conector ocupado = devolução total (`cannot_start`); início rejeitado ou sem sessão em 12 min = devolução total (`start_rejected`, `start_timeout`); medidor inconsistente = `review` (nada é cobrado sozinho); consumo acima do pago = cliente paga no máximo o valor pago; chargeback = `needs_attention` com `attention_reason = chargeback`.

### 3.3 Sessão órfã

Se o carregador some no meio da recarga (sem StopTransaction), o gateway roda a cada 60 s a função `telektro_close_orphan_sessions`. Sessão sem sinal por `OCPP_ORPHAN_SESSION_MINUTES` (padrão 20, limites 5 a 240) é fechada com a última leitura de energia (`stop_reason = OrphanTimeout`), cobra-se o medido e devolve-se a sobra. Se o StopTransaction chegar depois, as colunas `late_stop_*` registram. Efeito de teste: inserir uma sessão com `started_at` antigo no banco já nasce fechada por esse mecanismo; ajuste `ended_at` e `started_at` depois do insert.

### 3.4 Alerta de carregador sem sinal (só no painel do dono)

`apps/web/src/lib/charger-alert.ts`. Carregador que já mandou um heartbeat e está há 5 minutos ou mais sem sinal gera um banner vermelho no topo do painel (todas as abas), com nome, "sem sinal há X", último sinal e, se houver recarga aberta, "Há recarga aberta nele". Carregador que nunca conectou não alerta. Some sozinho quando volta. Sem e-mail e sem push. O painel marca offline na tela quando o último heartbeat passa de 180 s (`OCPP_CHARGER_STALE_AFTER_SECONDS`). O heartbeat do carregador é pedido a cada 60 s.

### 3.5 ws e wss por carregador

wss (443) é o padrão e o recomendado. Alguns modelos só falam ws (NeoCharge, segundo o fabricante). O dono liga "ws sem criptografia" por carregador (cadastro ou lista; só o dono). O gateway só aceita a porta 80 se o carregador tiver `allow_insecure_ws = true`; senão 403. A decisão usa `X-Forwarded-Proto` e `Fly-Forwarded-Port` e falha fechada (confirmado no Fly real que header falsificado não engana). A senha individual do carregador continua obrigatória nos dois modos. Desligar a opção derruba a conexão ws em até 30 s (código 4001). Há histórico em `charger_transport_events` e o selo "ws sem criptografia liberado" no painel. URL ws: `ws://telektro-ocpp-gateway.fly.dev/ocpp/<ID>`; URL wss: `wss://telektro-ocpp-gateway.fly.dev/ocpp/<ID>`; usuário = ID OCPP, senha = a credencial do carregador. Riscos do ws estão em `ws-opcional.md` e no PR 62.

### 3.6 Credencial e QR de provisionamento

Cada carregador tem senha própria de 160 bits (40 hex); só o hash SHA-256 fica no banco. Aparece uma vez no cadastro; o dono pode gerar nova (derruba o carregador). O dono pode gerar um QR de provisionamento para transferir a titularidade na entrega.

## 4. Deploy e ordem

Regra do dono: toda mudança vai em branch e PR, com preview da Vercel e prints. **Nada é mesclado ou implantado sem o "Pode sim" explícito do Maycon**, dado depois da pergunta "Posso mesclar o N?".

Ordem quando há SQL e gateway:
1. SQL no Supabase (arquivo numerado em `docs/sql/*.txt`, o Maycon cola e responde "sucesso").
2. Merge do PR (Vercel faz o deploy de produção sozinha; conferir o deployment `Production` do commit).
3. `fly deploy -a telektro-ocpp-gateway` (quem roda é o Codex do Maycon). Conferir `/health` na 80 e na 443.

Nunca subir o gateway antes do SQL que ele lê: a consulta falha e nenhum carregador conecta (inclusive wss).

Conferir após o deploy: `https://telektro.com.br/login` responde 200; `gh api repos/redeeletrogo-a11y/telektro/deployments` mostra o hash em `Production`; `https://telektro-ocpp-gateway.fly.dev/health` responde `status ok`.

## 5. Segredos: nomes e onde ficam (nunca valores)

**Vercel (projeto da web, ambiente Production)**
- `SUPABASE_SERVICE_ROLE_KEY` (só servidor), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` e, para a aplicação própria do eletroposto, `MERCADOPAGO_ELETROPOSTO_ACCESS_TOKEN`, `MERCADOPAGO_ELETROPOSTO_WEBHOOK_SECRET`
- `NEXT_PUBLIC_MERCADOPAGO_ELETROPOSTO_PUBLIC_KEY` (chave pública, habilita o cartão)
- `CRON_SECRET` (protege `/api/eletroposto/sweep`), `EPOSTO_IP_SALT`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_OCPP_GATEWAY_BASE_URL` (opcional; padrão wss do Fly em produção)
- `MERCADOPAGO_PAYER_EMAIL_OVERRIDE` (só para testes; não deve existir em produção)

**Fly (app `telektro-ocpp-gateway`, secrets, definidos pelo painel do Fly)**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `SWEEP_URL` (`https://telektro.com.br/api/eletroposto/sweep`) e `CRON_SECRET` (o mesmo valor da Vercel)
- Não-secretos em `fly.toml`: `NODE_ENV`, `OCPP_GATEWAY_PORT`, `OCPP_HEARTBEAT_INTERVAL_SECONDS`. Opcionais: `OCPP_ORPHAN_SESSION_MINUTES`, `OCPP_OPERATION_CONFIRMATION_SECONDS`.
- `OCPP_DEV_TOKEN` só em ambiente local (recusado em produção). `ENABLE_INSECURE_WS` foi removido.

**Cofre do agente (Instinct vault)**, itens usados: "GitHub write token for redeeletrogo-a11y/telektro" (git/gh), "supabase-service-role (key in password)" (testes com org fictícia), "Telektro CRON_SECRET (Vercel Production)". O login do painel do Fly funciona no navegador com a conta rede.eletrogo; o login do GitHub no navegador é outra conta (usar o token do cofre).

Se um valor se perder: gerar de novo na origem (Supabase, Mercado Pago, Vercel, Fly) e atualizar nos dois lugares quando for compartilhado (`CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`).

## 6. SQLs (ordem e estado em 21/10/2026)

As migrations ficam em `supabase/migrations` (e os pequenos arquivos numerados para colar em `docs/sql`). Estado: **V** = confirmado por consulta ao banco em 21/10/2026; **R** = registrado como aplicado pelo Maycon ("sucesso") nas conversas; **?** = a conferir.

| # | Arquivo | Conteúdo | Estado |
| --- | --- | --- | --- |
| 1 | 202609280001 a 202609280006 | Multi-tenant, entidades, onboarding, credenciais, recuperação de comandos, perfis de carregador | V (tabelas existem) |
| 2 | 202609300007 a 202609300010 | Autorização remota, isolamento, arquivar/restaurar, rotação de credencial | V (`charger_credential_events` existe) |
| 3 | 202610020011 a 202610020014 | Papel residente, tipos de conta, cadastro sem org automática, trial | V (`organization_invites`) |
| 4 | 202610030015 a 202610030019 | Pix da mensalidade, condomínio, tags, controle remoto do residente | V (`pix_charges`, `resident_tags`) |
| 5 | 202610030020 a 202610030023 | Eletroposto pré-pago, timeout de início, cartão, conta | V (`eletroposto_*`, `card_last4`, `fee_amount`) |
| 6 | 202610030024, 202610030025 a, b, c1, c2 | Resumo de carregadores do condomínio, mensalidade | ? (aplicadas pelo Maycon em 03/10, não reconferidas) |
| 7 | 202610050001 (docs/sql/01) | Repasse manual do eletroposto | R |
| 8 | 202610180026 | QR de provisionamento (`chargers.claim_token`) | V |
| 9 | 202610200027 a e b | Sessão órfã (`telektro_close_orphan_sessions`, colunas `late_stop_*`) | V |
| 10 | 202610200028 (docs/sql/02) | Livro de repasses (`eletroposto_payouts`) | V |
| 11 | 202610210029 (docs/sql/03) | ws opcional (`allow_insecure_ws`, `last_transport`, `charger_transport_events`, função `set_charger_insecure_ws`, trigger) | V (testado com org fictícia) |
| 12 | 202610210030 | Grants explícitos mínimos (regra do Supabase de 30/10/2026: tabela nova não ganha grant automático). Em produção só repete o que já existe. | Só no repositório; **não precisa colar no banco** (opcional, é idempotente) |

**Regra para tabela nova:** `CREATE TABLE` + grants mínimos + RLS na mesma entrega. Nunca `GRANT ALL`, nunca conceder a `anon`, e `chargers` nunca é lida inteira por `authenticated` (leitura por coluna, sem `ocpp_credential_hash` e `claim_token`).

Nunca reaplicar arquivo já aplicado. Para criar o ponto de um eletroposto novo, usar o `insert` documentado em `eletroposto-piloto.md`.

Ponto piloto atual: organização "condominio barreta" (tipo eletroposto), ponto `06eaf5db6b7d6982`, conector 1, carregador `TELEKTRO-DEMO-VIDEO-2`, tarifa R$ 2,00/kWh, mínimo R$ 10, máximo R$ 100, margem 5%. Em 21/10/2026 nenhum carregador está online: o hardware real ainda não foi comprado.

## 7. Como testar com organização fictícia e limpar

Nunca mexer em dados reais. Nunca criar pagamento real no Mercado Pago em teste; pagamentos fictícios usam `mp_payment_id` falso (ex.: `FAKE-60-1`).

1. Criar usuário de teste pela API admin do Auth (e-mail `zz-teste-...@example.com`, `email_confirm`).
2. Inserir `organizations` (nome e slug com prefixo `zz-teste`, `account_type` eletroposto ou condomínio, `resident_limit`, `subscription_status = active`), `memberships` (role owner; um segundo usuário technician para testar permissões), `sites`, `chargers` (com `ocpp_credential_hash` quando o teste usa autenticação; sem esse hash a inserção como usuário falha), `tariffs`, `eletroposto_points`, `eletroposto_payments` (status `settled` com energia/valores para telas de comprovante).
3. Rodar o painel local (`pnpm --filter web dev`, `next dev -p 3113`) com `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`; para o login do usuário de teste, usar a chave de serviço também como `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (só local).
4. Antes de prints de carregadores, atualizar `last_heartbeat_at` (some do "online" depois de 180 s).
5. Gateway: testar contra um Supabase falso local (REST) ou contra o Fly real com carregadores fictícios; nunca subir um segundo gateway apontando para o banco de produção (ele fecharia sessões e recuperaria comandos de todas as organizações).
6. Safari/iPhone: Playwright WebKit com `devices['iPhone 14']` é emulação (motor WebKit real em Linux, não iOS Safari nem aparelho). No ambiente do agente foi preciso copiar bibliotecas do sistema para `~/.cache/ms-playwright/webkit-*/minibrowser-wpe/sys/lib`.
7. Limpeza obrigatória, nesta ordem, filtrando por `organization_id`: `charger_transport_events`, `ocpp_messages`, `eletroposto_payments`, `eletroposto_points`, `commands`, `meter_values`, `sessions`, `chargers`, `tariffs`, `sites`, `memberships`, depois `organizations` e os usuários do Auth. Conferir que não sobrou `organizations` com slug `zz-*`, `chargers` com `ZZ-*` nem usuários `zz-teste`. Apagar arquivos com a chave de serviço.

## 8. Roteiro dos testes reais pendentes (precisam do carregador físico)

Gasto real, valor mínimo do ponto: R$ 10 em cada teste. Link do ponto: `https://telektro.com.br/carregar/06eaf5db6b7d6982`. Antes de tudo, o carregador precisa estar online (`/health` com `connectedChargers` 1, ou o painel mostrando online); se estiver offline o pagamento cai em "carregador não iniciou" e é devolvido.

**Cartão (cobra de verdade cerca de R$ 1 a R$ 3):**
1. Ligar o carregador. 2. No celular, abrir o link, Cartão, R$ 10, preencher dados e pagar (só reserva). 3. Plugar o carro: a tela vira "Carregando". 4. Carregar 2 a 5 minutos e tocar "Parar recarga". 5. Esperar "Recarga finalizada" e abrir "Ver comprovante".
Conferir no banco: `payment_method = card`, status passando por paid, charging, settling, settled; `energy_wh` e `charged_amount` batendo com tarifa x kWh; sem reembolso. No Mercado Pago: pagamento "authorized" vira capturado só no valor cobrado. Na fatura: só o consumo.

**Pix com sobra (cobra R$ 10 e devolve a sobra):**
1. Mesmo link, Pix, R$ 10, pagar o copia-e-cola no app do banco. 2. Plugar o carro, esperar "Carregando". 3. Carregar 2 a 5 minutos e parar. 4. Ver "Valor cobrado" = consumo e "Valor devolvido" = sobra "no mesmo Pix".
Conferir: `charged_amount + refund_amount = 10`, `refund_id` preenchido, sem `needs_attention`; no banco do cliente a entrada de R$ 10 e depois a devolução.

**iPhone/Safari real:** abrir as telas do cliente e o painel do dono no iPhone: layout, teclado, "Adicionar à Tela de Início", impressão ou PDF do comprovante, Pix copia-e-cola no app do banco, cartão pelo Brick.

**NeoCharge (ws):** cadastrar o carregador, ligar "Permitir ws" (só o dono), configurar o equipamento com `ws://telektro-ocpp-gateway.fly.dev/ocpp/<ID>` (porta 80), usuário = ID, senha = credencial. Conferir no painel "Última conexão: ws" e que ele aparece online. Trocar a senha ao migrar para wss. Também validar com ele o alerta de sem sinal (desligar da tomada e esperar 5 minutos) e o fechamento de sessão órfã (20 minutos).

Já provado antes (4/10/2026, hardware ou simulador do Codex com Mercado Pago real): cartão com reserva de R$ 20, cobrado R$ 4 por captura parcial; Pix com sobra devolvida. O código mudou depois (PRs 55 a 62), por isso o teste real acima ainda é necessário.

## 9. Histórico de entregas (PRs mesclados)

55: 2 conectores e fechamento de sessão órfã. 56: estados da página do motorista e extrato do dono ("a repassar / já pago"). 57: nova tela do cliente. 58: telas pós-pagamento em verde escuro e comprovante imprimível. 59: liquidação logo após parar (gateway pede a varredura). 60 e 61: alerta de carregador sem sinal, contraste do banner nos dois temas, botão "Instalar Telektro" escondido nas telas do cliente em celular (até 720 px). 62: ws opcional por carregador.

## 10. Decisões do Maycon

- Mudanças só por PR com preview e prints; sem merge/deploy sem "Pode sim". Repositório público até ele validar tudo.
- Telektro simples: carregadores, controle de recarga e cobrança; sem APIs externas extras; funcional primeiro.
- Segurança máxima com dados de clientes. O Pix do dono é privado (só do dono).
- Telas pós-pagamento em gradiente verde escuro, sem foto de carro; resto do cliente claro.
- Alerta de carregador sem sinal só no painel do dono, sem e-mail.
- Aceitar ws e wss: o padrão dele é wss; modelos só ws (NeoCharge) entram por opção por carregador, com senha própria e aviso. O modelo Telektro deve servir de referência e aceitar todos os carregadores.
- Relatar sempre o que foi testado de verdade e o que foi simulado.

## 11. Pendências e ideias não feitas

- Testes reais da seção 8 (aguardam o carregador chegar).
- Rate limit de tentativas por IP nas portas 80 e 443 do gateway (hoje inexistente).
- Verificação de consumo plausível por potência do carregador (reforço contra medidor forjado em ws).
- Atualizar a tabela de estado em `supabase/migrations/README.md` (desatualizada).
- Reconferir no banco as migrations marcadas com "?" na seção 6.
- Obrigações fiscais/legais do eletroposto: validar com contador. Split/comissão via OAuth do Mercado Pago do dono não foi feito.

## 12. Como retomar do zero

1. Ler este arquivo e `architecture.md`.
2. `git clone https://github.com/redeeletrogo-a11y/telektro` e `pnpm install`.
3. Conseguir os acessos pelos nomes da seção 5 (cofre do agente, painéis da Vercel, do Fly e do Supabase).
4. Conferir o estado: `/health` do gateway, último deployment `Production` no GitHub, e as consultas de existência das tabelas da seção 6.
5. Antes de qualquer mudança, abrir branch e PR. Nunca mesclar sem o "Pode sim".
