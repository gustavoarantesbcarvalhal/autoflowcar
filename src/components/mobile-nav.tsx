import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, MessageCircle, Car, Calendar, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function useFollowUpBadge() {
  const { data = 0 } = useQuery({
    queryKey: ["followup-badge"],
    queryFn: async () => {
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const { count, error } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .not("status", "in", "(venda_realizada,perdido)")
        .not("next_return_at", "is", null)
        .lte("next_return_at", todayEnd.toISOString());
      if (error) return 0;
      return count ?? 0;
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });
  return data;
}

function MobileNavItem({
  to,
  label,
  icon: Icon,
  pathname,
  badge,
}: {
  to: string;
  label: string;
  icon: React.ElementType;
  pathname: string;
  badge?: number;
}) {
  const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
  return (
    <Link
      to={to as never}
      className={cn(
        "relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <span className="relative">
        <Icon className="size-4" />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -right-2 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      {label}
    </Link>
  );
}

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { perfil } = useAuth();
  const followUpBadge = useFollowUpBadge();

  const podeVerUsuarios = perfil === "admin_loja" || perfil === "gerente";
  const cols = podeVerUsuarios ? "grid-cols-6" : "grid-cols-5";

  return (
    <nav className={cn("fixed bottom-0 left-0 right-0 z-50 grid border-t border-border bg-background md:hidden", cols)}>
      <MobileNavItem to="/"         label="Início"   icon={LayoutDashboard} pathname={pathname} />
      <MobileNavItem to="/clientes" label="Clientes" icon={Users}           pathname={pathname} />
      <MobileNavItem to="/followup" label="Follow"   icon={MessageCircle}   pathname={pathname} badge={followUpBadge} />
      <MobileNavItem to="/estoque"  label="Estoque"  icon={Car}             pathname={pathname} />
      <MobileNavItem to="/agenda"   label="Agenda"   icon={Calendar}        pathname={pathname} />
      {podeVerUsuarios && (
        <MobileNavItem to="/usuarios" label="Usuários" icon={UserCog} pathname={pathname} />
      )}
    </nav>
  );
}
