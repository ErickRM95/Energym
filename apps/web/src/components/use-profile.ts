"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient, supabaseConfigured } from "@/lib/supabase/browser";

export function useProfile() {
  return useQuery({
    queryKey: ["me"],
    enabled: supabaseConfigured(),
    queryFn: async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (error) throw error;
      return data;
    },
  });
}
