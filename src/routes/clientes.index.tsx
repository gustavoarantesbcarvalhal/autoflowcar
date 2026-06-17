import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";

const search = z.object({ q: fallback(z.string(), "").default("") });

// Componente movido para clientes.index.lazy.tsx — @dnd-kit fica fora do bundle principal.
export const Route = createFileRoute("/clientes/")({
  validateSearch: zodValidator(search),
  head: () => ({ meta: [{ title: "Clientes — Pipeline AutoFlow" }] }),
});
