import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";

function NotificationItem({ n, onRead }: { n: AppNotification; onRead: () => void }) {
  const navigate = useNavigate();
  const customerId = n.metadata?.customer_id as string | undefined;

  function handleClick() {
    onRead();
    if (customerId) navigate({ to: `/clientes/${customerId}` as never });
  }

  return (
    <li
      onClick={handleClick}
      className={cn(
        "flex cursor-pointer items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-muted",
        !n.read && "bg-primary/5",
      )}
    >
      <div className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", !n.read ? "bg-primary" : "bg-transparent")} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{n.title}</p>
        {n.body && <p className="truncate text-[11px] text-muted-foreground">{n.body}</p>}
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {new Date(n.created_at).toLocaleString("pt-BR")}
        </p>
      </div>
    </li>
  );
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const recent = notifications.slice(0, 10);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          open && "bg-muted text-foreground",
        )}
        aria-label="Notificações"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Notificações</p>
            {unreadCount > 0 && (
              <button onClick={() => markAllRead()} className="text-[11px] text-primary hover:underline">
                Marcar tudo como lido
              </button>
            )}
          </div>
          {!recent.length ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Nenhuma notificação</p>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {recent.map((n) => (
                <NotificationItem
                  key={n.id}
                  n={n}
                  onRead={() => { markAsRead(n.id); setOpen(false); }}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
