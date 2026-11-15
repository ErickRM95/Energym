import { useQuery } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";

export default function ProgressScreen() {
  const progress = useQuery({
    queryKey: ["progress"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? "";
      const [{ data: measures }, { data: logs }, { data: photos }] = await Promise.all([
        supabase.from("body_measurements").select("id, weight_kg, body_fat_pct").eq("member_id", userId).order("recorded_at"),
        supabase.from("workout_logs").select("weight_kg, routine_exercises(exercises_library(name))").eq("member_id", userId),
        supabase.from("progress_photos").select("id, angle, taken_at").eq("member_id", userId),
      ]);
      const records = new Map<string, number>();
      const rows = (logs ?? []) as unknown as Array<{
        weight_kg: number | null;
        routine_exercises: { exercises_library: { name: string } | null } | null;
      }>;
      for (const log of rows) {
        const name = log.routine_exercises?.exercises_library?.name;
        if (!name || log.weight_kg === null) continue;
        records.set(name, Math.max(records.get(name) ?? 0, Number(log.weight_kg)));
      }
      return { measures: measures ?? [], records: [...records.entries()], photos: photos ?? [] };
    },
  });
  const maxWeight = Math.max(1, ...(progress.data?.measures.map((row) => Number(row.weight_kg ?? 0)) ?? [1]));

  return (
    <ScrollView className="flex-1 bg-[#f3f4ef] dark:bg-[#101410]" contentContainerClassName="gap-4 px-5 py-6">
      <Text className="text-3xl font-semibold text-[#161915] dark:text-white">Progreso</Text>
      {(progress.data?.measures ?? []).map((row) => (
        <View key={row.id}>
          <Text className="text-sm text-[#5c655b] dark:text-[#c9d2c8]">{row.weight_kg ?? "—"} kg · grasa {row.body_fat_pct ?? "—"}%</Text>
          <View className="mt-1 h-2 rounded-full bg-[#e6e8e0] dark:bg-white/10">
            <View className="h-2 rounded-full bg-[#c6f135]" style={{ width: `${(Number(row.weight_kg ?? 0) / maxWeight) * 100}%` }} />
          </View>
        </View>
      ))}
      <Text className="mt-4 text-lg font-semibold text-[#161915] dark:text-white">Marcas</Text>
      {(progress.data?.records ?? []).map(([name, weight]) => (
        <Text key={name} className="text-[#5c655b] dark:text-[#c9d2c8]">{name}: {weight} kg</Text>
      ))}
      <Text className="mt-4 text-lg font-semibold text-[#161915] dark:text-white">Fotos</Text>
      {(progress.data?.photos ?? []).map((photo) => (
        <Text key={photo.id} className="text-[#5c655b] dark:text-[#c9d2c8]">{photo.angle} · {photo.taken_at}</Text>
      ))}
    </ScrollView>
  );
}
