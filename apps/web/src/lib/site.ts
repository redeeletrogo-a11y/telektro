// Public site settings. Change the WhatsApp number with NEXT_PUBLIC_WHATSAPP_NUMBER (digits only, with country code),
// for example when the company moves to a WhatsApp Business number.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL && /^https:\/\/(www\.)?telektro\.com\.br\/?$/.test(process.env.NEXT_PUBLIC_SITE_URL) ? process.env.NEXT_PUBLIC_SITE_URL : "https://telektro.com.br").replace(/\/$/, "");
export const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "") || "558486722883";
export const WHATSAPP_MESSAGE = "Olá, quero saber mais sobre o Telektro";
export const whatsappUrl = (message = WHATSAPP_MESSAGE) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
export const SITE_TITLE = "Telektro: gestão de eletroposto e carregador de carro elétrico";
export const SITE_DESCRIPTION = "Plataforma para gestão de carregador elétrico em casa, condomínio e eletroposto. Controle recargas pelo celular, meça kWh por sessão e cobre com OCPP 1.6J. Teste grátis por 7 dias.";
