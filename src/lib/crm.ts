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

export const FOLLOW_UP_TYPES = [
  { id: "ligacao",    label: "Ligação" },
  { id: "whatsapp",  label: "WhatsApp" },
  { id: "email",     label: "E-mail" },
  { id: "visita",    label: "Visita" },
  { id: "test_drive", label: "Test Drive" },
  { id: "retorno",   label: "Retorno" },
] as const;

export type FollowUpTypeId = (typeof FOLLOW_UP_TYPES)[number]["id"];

export function followUpTypeLabel(id: string | null | undefined) {
  if (!id) return "—";
  return FOLLOW_UP_TYPES.find((t) => t.id === id)?.label ?? id;
}

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

// ---------------------------------------------------------------------------
// WhatsApp templates
// ---------------------------------------------------------------------------

export type WaTemplateId =
  | "primeiro_contato"
  | "retorno"
  | "agendamento"
  | "test_drive"
  | "pos_venda";

export const WA_TEMPLATES: Array<{
  id: WaTemplateId;
  label: string;
  suggestFor: string[];
  text: string;
}> = [
  {
    id: "primeiro_contato",
    label: "Primeiro contato",
    suggestFor: ["novo_lead", "primeiro_contato"],
    text: "Olá {nome_cliente}! Vi que você tem interesse em {nome_veiculo}. Sou {nome_vendedor} de {nome_loja} e estou aqui para te ajudar. Posso te passar mais informações? 😊",
  },
  {
    id: "retorno",
    label: "Retorno",
    suggestFor: ["interessado", "em_negociacao", "proposta_enviada"],
    text: "Olá {nome_cliente}! Tudo bem? Passando para dar um retorno sobre o {nome_veiculo} que conversamos. Ainda tem interesse? Posso ajudar com alguma dúvida? 🙂",
  },
  {
    id: "agendamento",
    label: "Agendamento",
    suggestFor: ["primeiro_contato", "interessado"],
    text: "Olá {nome_cliente}! Gostaria de agendar uma visita para você conhecer o {nome_veiculo} pessoalmente aqui em {nome_loja}. Qual horário fica melhor para você esta semana?",
  },
  {
    id: "test_drive",
    label: "Test Drive",
    suggestFor: ["test_drive", "em_negociacao"],
    text: "Olá {nome_cliente}! Que tal vir fazer um test-drive do {nome_veiculo} aqui em {nome_loja}? É a melhor forma de sentir o carro! 🚗 Quando você pode vir?",
  },
  {
    id: "pos_venda",
    label: "Pós-venda",
    suggestFor: ["venda_realizada"],
    text: "Olá {nome_cliente}! Como está sendo a experiência com o seu novo veículo? Sou {nome_vendedor} de {nome_loja} e fico à disposição para qualquer dúvida! 😊",
  },
];

export function suggestWaTemplate(status: string): WaTemplateId {
  for (const t of WA_TEMPLATES) {
    if (t.suggestFor.includes(status)) return t.id;
  }
  return "retorno";
}

export function interpolateWaTemplate(
  text: string,
  vars: { nome_cliente: string; nome_veiculo: string; nome_vendedor: string; nome_loja: string },
): string {
  return text
    .replace(/\{nome_cliente\}/g, vars.nome_cliente)
    .replace(/\{nome_veiculo\}/g, vars.nome_veiculo)
    .replace(/\{nome_vendedor\}/g, vars.nome_vendedor)
    .replace(/\{nome_loja\}/g, vars.nome_loja);
}
