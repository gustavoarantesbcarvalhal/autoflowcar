import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { whatsappLink, daysSince } from "@/lib/crm";
import { MessageCircle, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/followup")({
  head: () => ({ meta: [{ title: "Follow-up — AutoFlow" }] }),
  component: FollowupPage,
});

const FILTERS = [3, 7, 15, 30] as const;

async function fetchAll() {
  const { data, error } = await supabase
    .from("customers")
    .select("id,name,phone,whatsapp,interest_brand,interest_model,last_contact_at,next_return_at,status")
    .not("status", "in", "(venda_realizada,perdido)")
    .order("last_contact_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

function FollowupPage() {
  const [minDays, setMinDays] = useState<number>(7);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["followup"], queryFn: fetchAll });

  const register = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").update({ last_contact_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      await supabase.from("interactions").insert({ customer_id: id, type: "nota", content: "Follow-up registrado" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["followup"] }); toast.success("Contato registrado"); },
  });

  const filtered = (data ?? []).filter((c) => {
    const d = daysSince(c.last_contact_at);
    return d !== null && d >= minDays;
  });

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="text-2xl font-bold tracking-tight">Central de Follow-up</h1>
      <p className="mb-5 text-sm text-muted-foreground">Recupere leads esquecidos antes que esfriem</p>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setMinDays(f)}
            className={`rounded-md border px-4 py-2 text-xs font-bold uppercase transition-colors ${
              minDays === f ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted"
            }`}>
            Sem contato {f}+ dias
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="p-8 text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center p-12 text-center">
            <CheckCircle2 className="mb-2 size-10 text-success" />
            <p className="text-sm font-medium">Tudo em dia. Nenhum cliente parado há {minDays} dias.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((c) => {
              const d = daysSince(c.last_contact_at);
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-muted/40">
                  <Link to="/clientes/$id" params={{ id: c.id }} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.interest_brand} {c.interest_model} · Última interação há <span className="font-bold text-destructive">{d}d</span>
                      {c.next_return_at && <> · Retorno: {new Date(c.next_return_at).toLocaleDateString("pt-BR")}</>}
                    </p>
                  </Link>
                  <div className="flex gap-2">
                    <a href={whatsappLink(c.whatsapp ?? c.phone, `Olá ${c.name}, tudo bem? Passando para retomar nossa conversa.`)}
                       target="_blank" rel="noreferrer"
                       className="inline-flex h-9 items-center gap-1.5 rounded-md bg-whatsapp px-3 text-xs font-bold text-white hover:opacity-90">
                      <MessageCircle className="size-3.5" /> Enviar WhatsApp
                    </a>
                    <button onClick={() => register.mutate(c.id)}
                      className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-bold hover:bg-muted">
                      Registrar contato
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
