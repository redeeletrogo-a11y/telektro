// Indique e ganhe: constantes e formatadores compartilhados entre a página pública, o painel e a equipe.
export const REFERRAL_COMMISSION = 250;

export const REFERRAL_STATUSES = {
  registrado: "Registrado pela equipe",
  cadastrou: "Criou a conta",
  ativo: "Ponto ativado",
  pago: "Comissão paga",
  cancelado: "Cancelada",
} as const;

export type ReferralStatus = keyof typeof REFERRAL_STATUSES;

export type MyReferral = {
  id: string;
  label: string;
  status: string;
  commission_amount: number;
  commission_eligible: boolean;
  created_at: string;
};

export const statusLabel = (status: string) => REFERRAL_STATUSES[status as ReferralStatus] ?? status;

export const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
