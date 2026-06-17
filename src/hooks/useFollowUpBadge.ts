import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useFollowUpBadge() {
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
