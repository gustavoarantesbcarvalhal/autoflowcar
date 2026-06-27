import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, MessageCircle, Car, Calendar, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useFollowUpBadge } from "@/hooks/useFollowUpBadge";

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
        "relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <span className={cn(
        "relative flex size-8 items-center justify-center rounded-lg transition-colors",
        active ? "bg-primary/10" : "",
      )}>
        <Icon className="size-4" />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-white">
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
    <nav className={cn("fixed bottom-0 left-0 right-0 z-50 grid border-t border-border bg-background/95 backdrop-blur-sm md:hidden", cols)}>
      <MobileNavItem to="/"         label="Início"    icon={LayoutDashboard} pathname={pathname} />
      <MobileNavItem to="/clientes" label="Clientes"  icon={Users}           pathname={pathname} />
      <MobileNavItem to="/followup" label="Follow-up" icon={MessageCircle}   pathname={pathname} badge={followUpBadge} />
      <MobileNavItem to="/estoque"  label="Estoque"   icon={Car}             pathname={pathname} />
      <MobileNavItem to="/agenda"   label="Agenda"    icon={Calendar}        pathname={pathname} />
      {podeVerUsuarios && (
        <MobileNavItem to="/usuarios" label="Usuários" icon={UserCog} pathname={pathname} />
      )}
    </nav>
  );
}
