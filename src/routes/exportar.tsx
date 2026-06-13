import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { sourceLabel, statusLabel, formatPriceBRL } from "@/lib/crm";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/exportar")({
  head: () => ({ meta: [{ title: "Exportar Leads — AutoFlow" }] }),
  component: ExportarPage,
});

const PERIODS = [
  { label: "Últimos 7 dias", days: 7 },
  { label: "Últimos 30 dias", days: 30 },
  { label: "Últimos 90 dias", days: 90 },
  { label: "Todo período", days: 0 },
];

function ExportarPage() {
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(false);

  async function fetchRows() {
    let q = supabase.from("customers")
      .select("name,phone,whatsapp,city,interest_brand,interest_model,price_min,price_max,source,status,last_contact_at,created_at")
      .order("created_at", { ascending: false });
    if (period > 0) {
      const from = new Date(Date.now() - period * 86400000).toISOString();
      q = q.gte("created_at", from);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r) => ({
      Nome: r.name,
      Telefone: r.phone ?? "",
      WhatsApp: r.whatsapp ?? "",
      Cidade: r.city ?? "",
      "Veículo de Interesse": [r.interest_brand, r.interest_model].filter(Boolean).join(" "),
      "Faixa de Preço": r.price_min || r.price_max ? `${formatPriceBRL(r.price_min)} – ${formatPriceBRL(r.price_max)}` : "",
      "Origem do Lead": sourceLabel(r.source),
      "Status": statusLabel(r.status),
      "Último Contato": r.last_contact_at ? new Date(r.last_contact_at).toLocaleString("pt-BR") : "",
      "Cadastrado em": new Date(r.created_at).toLocaleString("pt-BR"),
    }));
  }

  async function exportXlsx() {
    setLoading(true);
    try {
      const rows = await fetchRows();
      if (rows.length === 0) { toast.info("Nenhum lead no período"); return; }
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Leads");
      XLSX.writeFile(wb, `leads-autoflow-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`${rows.length} leads exportados`);
    } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); }
  }

  async function exportCsv() {
    setLoading(true);
    try {
      const rows = await fetchRows();
      if (rows.length === 0) { toast.info("Nenhum lead no período"); return; }
      const ws = XLSX.utils.json_to_sheet(rows);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `leads-autoflow-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
      toast.success(`${rows.length} leads exportados`);
    } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <h1 className="text-2xl font-bold tracking-tight">Exportar Leads</h1>
      <p className="mb-6 text-sm text-muted-foreground">Baixe sua base de clientes em Excel ou CSV</p>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Período</h2>
        <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4">
          {PERIODS.map((p) => (
            <button key={p.days} onClick={() => setPeriod(p.days)}
              className={`rounded-md border px-3 py-2 text-xs font-bold uppercase transition-colors ${
                period === p.days ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Campos incluídos</h2>
        <ul className="mb-6 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {["Nome", "Telefone", "WhatsApp", "Cidade", "Veículo de interesse", "Faixa de preço", "Origem do lead", "Status", "Último contato", "Data de cadastro"].map((f) => (
            <li key={f}>• {f}</li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 md:flex-row">
          <button onClick={exportXlsx} disabled={loading}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            <FileSpreadsheet className="size-4" /> Baixar Excel (.xlsx)
          </button>
          <button onClick={exportCsv} disabled={loading}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-3 text-sm font-bold hover:bg-muted disabled:opacity-60">
            <Download className="size-4" /> Baixar CSV
          </button>
        </div>
      </div>
    </div>
  );
}
