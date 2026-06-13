import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, MessageCircle, Car, Calendar, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/", label: "Início", icon: LayoutDashboard },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/followup", label: "Follow", icon: MessageCircle },
  { to: "/estoque", label: "Estoque", icon: Car },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/exportar", label: "Export", icon: Download },
] as const;

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-6 border-t border-border bg-background md:hidden">
      {ITEMS.map((i) => {
        const active = i.to === "/" ? pathname === "/" : pathname.startsWith(i.to);
        const Icon = i.icon;
        return (
          <Link
            key={i.to}
            to={i.to}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-4" />
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
