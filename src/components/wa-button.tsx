import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, X, Send, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  WA_TEMPLATES,
  type WaTemplateId,
  suggestWaTemplate,
  interpolateWaTemplate,
  whatsappLink,
  FOLLOW_UP_TYPES,
} from "@/lib/crm";

function useTenantNome() {
  const { tenant_id } = useAuth();
  const { data = "nossa loja" } = useQuery({
    queryKey: ["tenant-nome"],
    queryFn: async () => {
      if (!tenant_id) return "nossa loja";
      const { data, error } = await supabase
        .from("tenants")
        .select("nome")
        .eq("id", tenant_id)
        .single();
      if (error || !data) return "nossa loja";
      return (data as Record<string, string>).nome ?? "nossa loja";
    },
    staleTime: Infinity,
    enabled: !!tenant_id,
  });
  return data;
}

export type WaButtonProps = {
  customerId: string;
  nome: string;
  numero: string | null;
  marca?: string | null;
  modelo?: string | null;
  status?: string;
  size?: "sm" | "md";
  onSuccess?: () => void;
};

export function WaButton({
  customerId,
  nome,
  numero,
  marca,
  modelo,
  status = "primeiro_contato",
  size = "md",
  onSuccess,
}: WaButtonProps) {
  const { nome: nomeVendedor } = useAuth();
  const nomeLoja = useTenantNome();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<WaTemplateId>("primeiro_contato");
  const [message, setMessage] = useState("");
  const [agendarFu, setAgendarFu] = useState(false);
  const [fuTipo, setFuTipo] = useState("retorno");
  const [fuData, setFuData] = useState("");

  function makeVars() {
    return {
      nome_cliente: nome,
      nome_veiculo: [marca, modelo].filter(Boolean).join(" ") || "veículo de interesse",
      nome_vendedor: nomeVendedor || "",
      nome_loja: nomeLoja,
    };
  }

  function openModal() {
    const suggested = suggestWaTemplate(status);
    const tpl = WA_TEMPLATES.find((t) => t.id === suggested)!;
    setActiveTemplate(suggested);
    setMessage(interpolateWaTemplate(tpl.text, makeVars()));
    setAgendarFu(false);
    setFuTipo("retorno");
    setFuData("");
    setOpen(true);
  }

  function switchTemplate(id: WaTemplateId) {
    setActiveTemplate(id);
    const tpl = WA_TEMPLATES.find((t) => t.id === id)!;
    setMessage(interpolateWaTemplate(tpl.text, makeVars()));
  }

  const registrar = useMutation({
    mutationFn: async (msg: string) => {
      const { error } = await supabase
        .from("interactions")
        .insert({ customer_id: customerId, type: "whatsapp" as never, content: msg });
      if (error) throw error;

      const patch: Record<string, unknown> = { last_contact_at: new Date().toISOString() };
      if (agendarFu && fuData) {
        patch.next_action_type = fuTipo;
        patch.next_return_at = new Date(fuData).toISOString();
      }
      await supabase.from("customers").update(patch as never).eq("id", customerId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer", customerId] });
      qc.invalidateQueries({ queryKey: ["followup"] });
      qc.invalidateQueries({ queryKey: ["followup-badge"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["dashboard-team"] });
      setOpen(false);
      onSuccess?.();
    },
  });

  function handleSend() {
    if (!numero || !message.trim()) return;
    window.open(whatsappLink(numero, message), "_blank", "noreferrer");
    registrar.mutate(message);
  }

  const nomeVeiculo = [marca, modelo].filter(Boolean).join(" ") || "veículo de interesse";

  if (!numero) {
    return (
      <span
        title="Nenhum número de WhatsApp cadastrado"
        className={cn(
          "inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-border text-muted-foreground",
          size === "sm" ? "h-7 px-2 text-[10px]" : "h-9 px-3 text-sm",
        )}
      >
        <MessageCircle className={size === "sm" ? "size-3" : "size-4"} />
        WhatsApp
      </span>
    );
  }

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); openModal(); }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md font-bold transition-colors",
          size === "sm"
            ? "h-7 px-2 text-[10px] bg-whatsapp/10 text-whatsapp hover:bg-whatsapp hover:text-white"
            : "h-9 px-3 text-sm bg-whatsapp text-white hover:opacity-90",
        )}
      >
        <MessageCircle className={size === "sm" ? "size-3" : "size-4"} />
        WhatsApp
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="font-semibold">{nome}</p>
                <p className="text-xs text-muted-foreground">{numero}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Template tabs */}
            <div className="flex gap-0 overflow-x-auto border-b border-border bg-muted/20 px-3 pt-2 pb-0">
              {WA_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => switchTemplate(t.id)}
                  className={cn(
                    "shrink-0 border-b-2 px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap",
                    activeTemplate === t.id
                      ? "border-whatsapp bg-card text-whatsapp"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="space-y-3 p-4">
              {/* Message editor */}
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Mensagem — editável antes do envio
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="w-full resize-none rounded-md border border-border bg-background p-3 text-sm outline-none focus:border-primary/60"
                />
                {/* Variable legend */}
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                  <span>
                    <code className="rounded bg-muted px-0.5">{"{nome_cliente}"}</code> = {nome}
                  </span>
                  <span>
                    <code className="rounded bg-muted px-0.5">{"{nome_veiculo}"}</code> = {nomeVeiculo}
                  </span>
                  <span>
                    <code className="rounded bg-muted px-0.5">{"{nome_vendedor}"}</code> = {nomeVendedor || "—"}
                  </span>
                  <span>
                    <code className="rounded bg-muted px-0.5">{"{nome_loja}"}</code> = {nomeLoja}
                  </span>
                </div>
              </div>

              {/* Follow-up scheduler */}
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium select-none">
                  <input
                    type="checkbox"
                    checked={agendarFu}
                    onChange={(e) => setAgendarFu(e.target.checked)}
                    className="size-4 rounded accent-primary"
                  />
                  <Calendar className="size-3.5 text-primary" />
                  Agendar próxima ação após o envio
                </label>
                {agendarFu && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <select
                      value={fuTipo}
                      onChange={(e) => setFuTipo(e.target.value)}
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                    >
                      {FOLLOW_UP_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                    <input
                      type="datetime-local"
                      value={fuData}
                      onChange={(e) => setFuData(e.target.value)}
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Abre WhatsApp Web e registra no histórico
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="h-9 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || registrar.isPending}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-whatsapp px-4 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
                >
                  <Send className="size-3.5" />
                  {registrar.isPending ? "Registrando…" : "Enviar"}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
