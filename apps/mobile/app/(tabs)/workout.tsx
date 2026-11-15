import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { cacheKeys, supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

type LoggedExercise = {
  id: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  trainer_notes: string | null;
  order_index: number;
  exercises_library: { name: string; video_url: string | null } | null;
};

export default function WorkoutScreen() {
  const { colors } = useTheme();
  const [rest, setRest] = useState(0);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const routine = useQuery({
    queryKey: ["routine"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("routines")
        .select("id, name, routine_days(id, day_number, name, routine_exercises(id, sets, reps, rest_seconds, trainer_notes, order_index, exercises_library(name, video_url)))")
        .eq("member_id", auth.user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const routine = data as {
        id: string;
        name: string;
        routine_days: Array<{
          id: string;
          day_number: number;
          name: string;
          routine_exercises: LoggedExercise[];
        }> | null;
      } | null;
      if (routine) await AsyncStorage.setItem(cacheKeys.routine, JSON.stringify(routine));
      return routine;
    },
  });
  const [cached, setCached] = useState<typeof routine.data>(null);
  useEffect(() => {
    void AsyncStorage.getItem(cacheKeys.routine).then((value) => {
      if (value) setCached(JSON.parse(value) as typeof routine.data);
    });
  }, []);

  const current = routine.data ?? cached;
  const day = current?.routine_days?.slice().sort((a, b) => a.day_number - b.day_number)[0];
  useEffect(() => {
    if (rest <= 0) return;
    const timer = setTimeout(() => setRest((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [rest]);

  async function logSet(exercise: LoggedExercise) {
    const { data: auth } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", auth.user?.id ?? "").single();
    if (!auth.user || !profile?.organization_id) return;
    await supabase.from("workout_logs").insert({
      organization_id: profile.organization_id,
      member_id: auth.user.id,
      routine_exercise_id: exercise.id,
      set_number: 1,
      weight_kg: weight ? Number(weight) : null,
      reps_completed: Number(reps || 0),
    });
    setRest(exercise.rest_seconds);
  }

  return (
    <ScrollView className="flex-1 bg-[#f3f4ef] dark:bg-[#101410]" contentContainerClassName="gap-4 px-5 py-6">
      <Text className="text-3xl font-semibold text-[#161915] dark:text-white">{current?.name ?? "Sin rutina en caché"}</Text>
      <Text className="text-[#3d5c0a] dark:text-[#c6f135]">{day?.name}</Text>
      {rest > 0 ? <Text className="text-5xl text-[#161915] dark:text-white">{rest}s</Text> : null}
      {(day?.routine_exercises ?? []).slice().sort((a, b) => a.order_index - b.order_index).map((exercise) => (
        <View key={exercise.id} className="rounded-3xl bg-[#fffcf6] dark:bg-[#1c241c] p-4">
          <Text className="text-xl font-semibold text-[#161915] dark:text-white">{exercise.exercises_library?.name}</Text>
          <Text className="mt-1 text-[#5c655b] dark:text-[#c9d2c8]">{exercise.sets} x {exercise.reps} · {exercise.rest_seconds}s</Text>
          {exercise.trainer_notes ? <Text className="mt-2 text-[#161915] dark:text-white">{exercise.trainer_notes}</Text> : null}
          <View className="mt-3 flex-row gap-2">
            <TextInput className="flex-1 rounded-xl bg-[#e6e8e0] dark:bg-black/30 px-3 py-2 text-[#161915] dark:text-white" placeholder="kg" placeholderTextColor={colors.muted} keyboardType="decimal-pad" value={weight} onChangeText={setWeight} />
            <TextInput className="flex-1 rounded-xl bg-[#e6e8e0] dark:bg-black/30 px-3 py-2 text-[#161915] dark:text-white" placeholder="reps" placeholderTextColor={colors.muted} keyboardType="number-pad" value={reps} onChangeText={setReps} />
          </View>
          <Pressable className="mt-3 items-center rounded-full bg-[#c6f135] py-3" onPress={() => void logSet(exercise)}>
            <Text className="font-semibold text-[#142000]">Registrar serie</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}
