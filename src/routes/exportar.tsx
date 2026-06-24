import { createFileRoute } from "@tanstack/react-router";

// Componente movido para exportar.lazy.tsx — o TanStack Router carrega
// esse chunk sob demanda, mantendo xlsx (~600KB) fora do bundle principal.
export const Route = createFileRoute("/exportar")({
  head: () => ({ meta: [{ title: "Exportar Leads — DriverLeads" }] }),
});
