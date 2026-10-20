export const brl = (value: number | null) => value === null ? "-" : `R$ ${value.toFixed(2).replace(".", ",")}`;
export const kwhText = (value: number | null) => `${(value ?? 0).toFixed(2).replace(".", ",")} kWh`;
const TZ = "America/Sao_Paulo";
export const dateTime = (iso: string | null) => iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
export const duration = (from: string | null, to: string | null) => {
  if (!from || !to) return "-";
  const minutes = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
};
// Estimativa do consumo maximo pelo valor pago (a parada real ocorre um pouco antes, por margem de seguranca).
export const maxKwh = (cap: number, price: number) => price > 0 ? cap / price : null;
