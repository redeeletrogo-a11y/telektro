import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { whatsappUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como o Telektro coleta, usa e protege dados pessoais, em conformidade com a LGPD.",
  alternates: { canonical: "/privacidade" },
};

export default function PrivacidadePage() {
  return (
    <LegalPage title="Política de Privacidade" updated="12 de outubro de 2026">
      <p>Esta política explica como o Telektro trata dados pessoais, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018, LGPD).</p>

      <h2>1. Quem somos</h2>
      <p>O Telektro é um produto da Nexa Labs Serviços LTDA, CNPJ 65.072.532/0001-80, endereço Avenida Paulista, 1471 - Conjunto 1110, Sala 2 - Bela Vista, São Paulo/SP - CEP 01311-927. A Nexa Labs é a controladora dos dados tratados na plataforma.</p>

      <h2>2. Dados que coletamos</h2>
      <ul>
        <li>Conta: nome, e-mail e foto de perfil, quando você entra com o Google, e o tipo de conta (residencial, condomínio ou eletroposto).</li>
        <li>Organização: nome do condomínio ou do local, moradores convidados e seus papéis.</li>
        <li>Carregadores: identificador OCPP, modelo, status e credenciais geradas para conectar o equipamento.</li>
        <li>Sessões de carga: horário de início e fim, energia consumida (kWh), potência, valores e estado da recarga.</li>
        <li>Pagamentos: status, valor e identificadores de transações Pix e cartão. Dados completos de cartão são tratados pelo Mercado Pago e não ficam conosco.</li>
        <li>Dados técnicos: endereço IP, tipo de dispositivo e navegador, registros de acesso e de erros.</li>
      </ul>

      <h2>3. Para que usamos</h2>
      <ul>
        <li>Criar e manter sua conta e autenticar seu acesso.</li>
        <li>Iniciar, parar e monitorar recargas e exibir o histórico de consumo.</li>
        <li>Calcular e cobrar valores, emitir QR Codes de pagamento e conciliar transações.</li>
        <li>Permitir a gestão de condomínios, moradores e eletropostos.</li>
        <li>Garantir segurança, prevenir fraudes e corrigir falhas.</li>
        <li>Cumprir obrigações legais e fiscais.</li>
      </ul>

      <h2>4. Bases legais</h2>
      <p>Tratamos dados para executar o contrato com você, cumprir obrigações legais, atender nosso legítimo interesse em manter o serviço seguro e, quando necessário, com o seu consentimento.</p>

      <h2>5. Login com Google</h2>
      <p>Usamos o login do Google apenas para identificar você. Recebemos nome, e-mail e foto de perfil. Não acessamos seus e-mails, contatos, arquivos ou outros dados da sua conta Google. O uso das informações recebidas do Google segue a Política de Dados de Usuário dos Serviços de API do Google, incluindo os requisitos de uso limitado.</p>

      <h2>6. Com quem compartilhamos</h2>
      <p>Não vendemos dados pessoais. Compartilhamos o necessário com prestadores que operam o serviço:</p>
      <ul>
        <li>Supabase (autenticação e banco de dados).</li>
        <li>Vercel e Fly.io (hospedagem do site e do servidor de carregadores).</li>
        <li>Mercado Pago (processamento de pagamentos).</li>
        <li>Google (login).</li>
      </ul>
      <p>Em condomínios e eletropostos, o responsável pela organização vê as sessões de carga e os dados de uso dos moradores ou usuários vinculados a ela. Também podemos compartilhar dados por ordem de autoridade competente.</p>

      <h2>7. Armazenamento e transferência internacional</h2>
      <p>Alguns prestadores podem armazenar dados fora do Brasil. Nesses casos, adotamos as salvaguardas previstas na LGPD.</p>

      <h2>8. Por quanto tempo guardamos</h2>
      <p>Mantemos os dados enquanto sua conta estiver ativa. Após o encerramento, apagamos ou anonimizamos os dados, exceto os que precisamos guardar para cumprir obrigações legais, fiscais ou para o exercício regular de direitos.</p>

      <h2>9. Seus direitos</h2>
      <p>Você pode pedir confirmação de tratamento, acesso, correção, anonimização, bloqueio ou eliminação de dados, portabilidade, informação sobre compartilhamento, revogação de consentimento e revisão de decisões automatizadas. Para exercer esses direitos, fale com a gente pelos contatos abaixo.</p>

      <h2>10. Segurança</h2>
      <p>Usamos conexões criptografadas, controle de acesso por conta e credenciais individuais por carregador. Nenhum sistema é totalmente imune a falhas. Em caso de incidente relevante, avisaremos os titulares e a ANPD conforme a lei.</p>

      <h2>11. Crianças e adolescentes</h2>
      <p>O Telektro não é voltado a menores de 18 anos e não coleta dados de crianças de forma intencional.</p>

      <h2>12. Cookies</h2>
      <p>Usamos apenas cookies e armazenamento local necessários para manter você conectado e lembrar preferências, como o tema claro ou escuro.</p>

      <h2>13. Mudanças nesta política</h2>
      <p>Podemos atualizar esta política. A data no topo mostra a versão mais recente. Mudanças relevantes serão comunicadas no site ou por e-mail.</p>

      <h2>14. Contato e encarregado (DPO)</h2>
      <p>Encarregado de dados: Maycon Terto. E-mail: rede.eletrogo@gmail.com. Você também pode falar conosco pelo <a href={whatsappUrl("Olá, tenho uma dúvida sobre privacidade no Telektro")}>WhatsApp</a>.</p>
    </LegalPage>
  );
}
