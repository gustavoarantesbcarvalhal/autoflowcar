export const STATUSES = [
  { id: "novo_lead", label: "Novo Lead", accent: "bg-blue-500" },
  { id: "primeiro_contato", label: "Primeiro Contato", accent: "bg-sky-500" },
  { id: "interessado", label: "Interessado", accent: "bg-amber-500" },
  { id: "em_negociacao", label: "Em Negociação", accent: "bg-primary" },
  { id: "test_drive", label: "Test Drive", accent: "bg-violet-500" },
  { id: "proposta_enviada", label: "Proposta Enviada", accent: "bg-indigo-500" },
  { id: "venda_realizada", label: "Venda Realizada", accent: "bg-emerald-500" },
  { id: "perdido", label: "Perdido", accent: "bg-slate-400" },
] as const;

export type StatusId = (typeof STATUSES)[number]["id"];

export const SOURCES = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "marketplace", label: "Marketplace" },
  { id: "olx", label: "OLX" },
  { id: "site", label: "Site" },
  { id: "indicacao", label: "Indicação" },
  { id: "outros", label: "Outros" },
] as const;

export const VEHICLE_STATUSES = [
  { id: "disponivel", label: "Disponível" },
  { id: "reservado", label: "Reservado" },
  { id: "vendido", label: "Vendido" },
] as const;

export const APPOINTMENT_TYPES = [
  { id: "retorno", label: "Retorno" },
  { id: "visita", label: "Visita" },
  { id: "test_drive", label: "Test Drive" },
] as const;

export function statusLabel(id: string) {
  return STATUSES.find((s) => s.id === id)?.label ?? id;
}
export function sourceLabel(id: string | null | undefined) {
  if (!id) return "—";
  return SOURCES.find((s) => s.id === id)?.label ?? id;
}

export function formatPriceBRL(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", maximumFractionDigits: 0,
  }).format(Number(value));
}

export function priceRange(min: number | null | undefined, max: number | null | undefined) {
  if (min == null && max == null) return "—";
  if (min && max) return `${formatPriceBRL(min)} – ${formatPriceBRL(max)}`;
  return formatPriceBRL(min ?? max);
}

export function whatsappLink(number: string | null | undefined, message?: string) {
  if (!number) return "#";
  const clean = number.replace(/\D/g, "");
  const withCountry = clean.startsWith("55") ? clean : `55${clean}`;
  const msg = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${withCountry}${msg}`;
}

export function daysSince(iso: string | null | undefined) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
