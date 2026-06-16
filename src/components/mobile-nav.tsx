import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, MessageCircle, Car, Calendar, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

function MobileNavItem({ to, label, icon: Icon, pathname }: { to: string; label: string; icon: React.ElementType; pathname: string }) {
  const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
  return (
    <Link
      to={to as never}
      className={cn(
        "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { perfil } = useAuth();

  const podeVerUsuarios = perfil === "admin_loja" || perfil === "gerente";
  const cols = podeVerUsuarios ? "grid-cols-6" : "grid-cols-5";

  return (
    <nav className={cn("fixed bottom-0 left-0 right-0 z-50 grid border-t border-border bg-background md:hidden", cols)}>
      <MobileNavItem to="/" label="Início" icon={LayoutDashboard} pathname={pathname} />
      <MobileNavItem to="/clientes" label="Clientes" icon={Users} pathname={pathname} />
      <MobileNavItem to="/followup" label="Follow" icon={MessageCircle} pathname={pathname} />
      <MobileNavItem to="/estoque" label="Estoque" icon={Car} pathname={pathname} />
      <MobileNavItem to="/agenda" label="Agenda" icon={Calendar} pathname={pathname} />
      {podeVerUsuarios && (
        <MobileNavItem to="/usuarios" label="Usuários" icon={UserCog} pathname={pathname} />
      )}
    </nav>
  );
}
