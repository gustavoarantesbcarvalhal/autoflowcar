import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { trocarCodigoMeta } from "@/lib/api/meta-oauth.functions";

export const Route = createFileRoute("/meta-oauth-callback")({
  validateSearch: z.object({
    code:              z.string().optional(),
    state:             z.string().optional(),
    error:             z.string().optional(),
    error_description: z.string().optional(),
  }),
  component: MetaOAuthCallback,
});

type Status = "processing" | "success" | "error";

function MetaOAuthCallback() {
  const { code, state, error, error_description } = Route.useSearch();
  const navigate = useNavigate();
  const [status, setStatus]   = useState<Status>("processing");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const isPopup = Boolean(window.opener);

    function finish(s: "success" | "error" | "cancelled", msg?: string) {
      if (isPopup) {
        window.opener?.postMessage(
          { type: "META_OAUTH", status: s, error: msg },
          window.location.origin,
        );
        setTimeout(() => window.close(), 1200);
      } else {
        navigate({ to: "/configuracoes" as never });
      }
    }

    if (error) {
      const msg = error_description ?? error;
      setStatus("error");
      setMessage(msg);
      finish("error", msg);
      return;
    }

    if (!code || !state) {
      finish("cancelled");
      return;
    }

    trocarCodigoMeta({ data: { code, state } })
      .then(() => {
        setStatus("success");
        finish("success");
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Erro ao conectar";
        setStatus("error");
        setMessage(msg);
        finish("error", msg);
      });
  // Runs once on mount — deps intentionally empty
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
      {status === "processing" && (
        <>
          <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Conectando ao Facebook…</p>
        </>
      )}
      {status === "success" && (
        <>
          <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <svg className="size-7 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Conta conectada! Fechando…</p>
        </>
      )}
      {status === "error" && (
        <>
          <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
            <svg className="size-7 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </div>
          <p className="text-sm font-semibold text-destructive">Erro ao conectar</p>
          {message && <p className="max-w-xs text-center text-xs text-muted-foreground">{message}</p>}
        </>
      )}
    </div>
  );
}
