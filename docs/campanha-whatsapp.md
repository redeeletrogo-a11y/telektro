# Páginas de campanha e medição

- Destinos: /condominio e /eletroposto. Home, login, guias, banco e pagamentos preservados.
- Mensalidades base: R$199 e R$149. Contato compartilhado atualizado para o WhatsApp pedido pelo proprietário.
- Botões abrem WhatsApp em outra aba com mensagem por perfil. O clique não prova conversa enviada nem lead qualificado.
- Evento: whatsapp_click, parâmetros profile (condominio/eletroposto) e placement (hero/details). Sem telefone, mensagem ou dados de clientes no evento.
- Com gtag instalado, dispara gtag('event', 'whatsapp_click', ...). Sem gtag, adiciona evento ao dataLayer, pronto para um gatilho de evento personalizado no Google Tag Manager. Não há conta, ID fictício, nova tag, cookies analíticos ou gasto nesta alteração.

## Antes de anunciar

1. Criar/configurar Google Ads e escolher uma integração: Google tag/GA4 com importação da conversão ou GTM com gatilho whatsapp_click e tag de conversão Ads. Não configurar as duas para contar o mesmo clique duas vezes.
2. Configurar consentimento/privacidade conforme o uso de tags. Instalar a tag base aprovada e inserir IDs reais. Este código sozinho NÃO registra conversões no Google Ads.
3. No GA4, registrar o evento e os parâmetros para análise; marcar como evento principal se for a rota escolhida. No Ads, configurar contagem Uma e identificar como clique de contato, não venda/conversa qualificada.
4. Testar os dois perfis e as posições no Tag Assistant/DebugView, incluindo celular e retorno do WhatsApp. Testar a conversão na conta real antes de investir.
5. Medir conversas recebidas e vendas separadamente; clique no botão é apenas sinal de intenção. Revisar cliques sem conversa e atendimento antes de otimizar CAC.

## Divergência de oferta a decidir

A home informa condomínio até 5 carregadores e módulo de cobrança +R$49,90. A cobrança no código informa até 5 moradores, extras por morador e taxa sobre energia. Eletroposto também exige confirmação dos limites/adicionais e taxas. Esta alteração mantém os preços-base da home sem replicar limites conflitantes nem alterar cobrança. As páginas pedem confirmação das condições na proposta. Alinhar oferta pública e faturamento antes de investir.

## Revisão

Não fazer merge sem aprovação do proprietário. Revisar telas mobile, links e condições comerciais. Nenhuma campanha foi criada ou ativada.
