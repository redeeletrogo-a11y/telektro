import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { whatsappUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Termos de Serviço",
  description: "Condições de uso da plataforma Telektro de gestão de carregadores de veículos elétricos.",
  alternates: { canonical: "/termos" },
};

export default function TermosPage() {
  return (
    <LegalPage title="Termos de Serviço" updated="12 de outubro de 2026">
      <p>Ao criar uma conta ou usar o Telektro, você concorda com estes termos. Se não concordar, não use o serviço.</p>

      <h2>1. O serviço</h2>
      <p>O Telektro é uma plataforma da Nexa Labs Serviços LTDA, CNPJ 65.072.532/0001-80, para gerenciar carregadores de veículos elétricos compatíveis com OCPP 1.6J: iniciar, parar e monitorar recargas, medir consumo e cobrar por Pix ou cartão. Há contas residenciais, de condomínio e de eletroposto, cada uma com seus recursos.</p>

      <h2>2. Conta</h2>
      <p>Você precisa ter 18 anos ou mais e fornecer informações verdadeiras. Você é responsável por manter o acesso à sua conta seguro e por tudo que acontece nela. Avise-nos se suspeitar de uso indevido.</p>

      <h2>3. Planos e pagamentos</h2>
      <ul>
        <li>Conta residencial: uso gratuito.</li>
        <li>Condomínio: mensalidade paga pelo condomínio por Pix. O responsável convida os moradores.</li>
        <li>Eletroposto: sem mensalidade nem aluguel; a Telektro recebe 5% do faturamento bruto das recargas. O motorista paga antes por Pix ou cartão, recarrega e recebe de volta o valor não consumido.</li>
        <li>Diretrizes: valores, percentuais e condições dos planos podem ser ajustados. Os valores vigentes ficam visíveis no site e no app antes da contratação. Pagamentos são processados pelo Mercado Pago.</li>
        <li>Você pode cancelar a assinatura a qualquer momento, sem multa. O cancelamento vale para os ciclos seguintes. Reembolsos seguem a legislação de defesa do consumidor.</li>
      </ul>

      <h2>4. Seu carregador e sua instalação</h2>
      <p>O Telektro não vende nem instala carregadores. Você deve usar equipamentos em boas condições, instalados por profissional habilitado e dentro das normas elétricas. Você deve ter autorização para usar o ponto de recarga, por exemplo do condomínio ou do proprietário do local.</p>

      <h2>5. Uso aceitável</h2>
      <ul>
        <li>Não tente acessar contas, carregadores ou dados de outras pessoas.</li>
        <li>Não use o serviço para fraude, para sobrecarregar a plataforma ou para fins ilegais.</li>
        <li>Não faça engenharia reversa nem copie o sistema, salvo quando a lei permitir.</li>
      </ul>

      <h2>6. Responsabilidades de eletropostos e condomínios</h2>
      <p>Quem opera um eletroposto ou administra um condomínio é responsável por definir tarifas, informar os usuários, cumprir obrigações fiscais e regulatórias da sua atividade e tratar corretamente os dados dos usuários que cadastrar.</p>

      <h2>7. Disponibilidade e limites</h2>
      <p>Trabalhamos para manter o serviço no ar, mas ele depende de internet, do carregador e de terceiros, e pode ter interrupções. As medições de energia vêm do equipamento e podem diferir do medidor da concessionária. Na máxima extensão permitida em lei, a Nexa Labs não responde por danos indiretos, lucros cessantes, falhas do carregador, da rede elétrica, do veículo ou de serviços de terceiros. Isso não afasta direitos garantidos pelo Código de Defesa do Consumidor.</p>

      <h2>8. Propriedade intelectual</h2>
      <p>O software, a marca Telektro e o conteúdo do site pertencem à Nexa Labs. Você recebe uma licença limitada, pessoal e não exclusiva de uso do serviço. Os dados que você insere continuam sendo seus.</p>

      <h2>9. Privacidade</h2>
      <p>O tratamento de dados pessoais está descrito na <Link href="/privacidade">Política de Privacidade</Link>.</p>

      <h2>10. Suspensão e encerramento</h2>
      <p>Você pode encerrar sua conta quando quiser. Podemos suspender ou encerrar contas que violem estes termos, com aviso quando possível.</p>

      <h2>11. Mudanças nos termos</h2>
      <p>Podemos atualizar estes termos. Mudanças relevantes serão avisadas no site ou no app. Continuar usando o serviço depois disso significa que você aceita a nova versão.</p>

      <h2>12. Lei aplicável e foro</h2>
      <p>Estes termos seguem as leis do Brasil. Fica eleito o foro de Natal/RN, sem prejuízo do foro do domicílio do consumidor.</p>

      <h2>13. Contato</h2>
      <p>Nexa Labs Serviços LTDA, Avenida Paulista, 1471 - Conjunto 1110, Sala 2 - Bela Vista, São Paulo/SP - CEP 01311-927, e-mail rede.eletrogo@gmail.com, ou pelo <a href={whatsappUrl()}>WhatsApp</a>.</p>
    </LegalPage>
  );
}
