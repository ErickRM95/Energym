import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { FloatingTimer } from "@/components/floating-timer";
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

type RoutineDay = {
  id: string;
  day_number: number;
  name: string;
  routine_exercises: LoggedExercise[];
};

type Routine = {
  id: string;
  name: string;
  routine_days: RoutineDay[] | null;
};

type WorkoutLog = {
  id: string;
  routine_exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  reps_completed: number;
};

function seriesLabel(count: number) {
  if (count === 1) return "1 serie registrada";
  return `${count} series registradas`;
}

function prescription(sets: number, reps: string) {
  const series = sets === 1 ? "1 serie" : `${sets} series`;
  const timed = /seg|min|minuto|tiempo/i.test(reps);
  return timed ? `${series} · ${reps}` : `${series} · ${reps} repeticiones`;
}

function startOfToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

export default function WorkoutScreen() {
  const { colors } = useTheme();
  const client = useQueryClient();
  const [rest, setRest] = useState(0);
  const [dayId, setDayId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { weight: string; reps: string }>>({});
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
      const loaded = data as Routine | null;
      if (loaded) await AsyncStorage.setItem(cacheKeys.routine, JSON.stringify({ userId: auth.user.id, routine: loaded }));
      else await AsyncStorage.removeItem(cacheKeys.routine);
      return loaded;
    },
  });
  const [cached, setCached] = useState<Routine | null>(null);
  useEffect(() => {
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const value = await AsyncStorage.getItem(cacheKeys.routine);
      if (!value || !auth.user) return;
      const parsed = JSON.parse(value) as { userId?: string; routine?: Routine };
      if (parsed.userId === auth.user.id && parsed.routine) setCached(parsed.routine);
    })();
  }, []);

  const current = routine.data ?? cached;
  const days = (current?.routine_days ?? []).slice().sort((a, b) => a.day_number - b.day_number);
  const day = days.find((item) => item.id === dayId) ?? days[0];
  const exercises = (day?.routine_exercises ?? []).slice().sort((a, b) => a.order_index - b.order_index);
  const logs = useQuery({
    queryKey: ["workout-logs", day?.id],
    enabled: Boolean(day),
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || exercises.length === 0) return [] as WorkoutLog[];
      const { data, error } = await supabase
        .from("workout_logs")
        .select("id, routine_exercise_id, set_number, weight_kg, reps_completed")
        .eq("member_id", auth.user.id)
        .gte("logged_at", startOfToday())
        .in("routine_exercise_id", exercises.map((exercise) => exercise.id))
        .order("set_number");
      if (error) throw error;
      return (data ?? []) as WorkoutLog[];
    },
  });

  useEffect(() => {
    if (rest <= 0) return;
    const timer = setTimeout(() => setRest((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [rest]);

  function draftFor(exercise: LoggedExercise) {
    return drafts[exercise.id] ?? { weight: "", reps: "" };
  }

  function updateDraft(exerciseId: string, patch: Partial<{ weight: string; reps: string }>) {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [exerciseId]: { weight: "", reps: "", ...currentDrafts[exerciseId], ...patch },
    }));
  }

  async function logSet(exercise: LoggedExercise) {
    const draft = draftFor(exercise);
    const repsCompleted = Number(draft.reps);
    if (!draft.reps.trim() || Number.isNaN(repsCompleted) || repsCompleted < 0) {
      setMessage("Escribe cuántas repeticiones hiciste.");
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", auth.user?.id ?? "").single();
    if (!auth.user || !profile?.organization_id) {
      setMessage("No se pudo registrar la serie.");
      return;
    }
    const done = (logs.data ?? []).filter((entry) => entry.routine_exercise_id === exercise.id).length;
    const { error } = await supabase.from("workout_logs").insert({
      organization_id: profile.organization_id,
      member_id: auth.user.id,
      routine_exercise_id: exercise.id,
      set_number: done + 1,
      weight_kg: draft.weight.trim() ? Number(draft.weight) : null,
      reps_completed: repsCompleted,
    });
    if (error) {
      setMessage("No se pudo registrar la serie.");
      return;
    }
    setMessage("");
    setRest(exercise.rest_seconds);
    await client.invalidateQueries({ queryKey: ["workout-logs", day?.id] });
  }

  return (
    <View className="flex-1">
    <ScrollView className="flex-1 bg-[#f3f4ef] dark:bg-[#101410]" contentContainerClassName="gap-4 px-5 pb-28 pt-6">
      <Text className="text-3xl font-semibold text-[#161915] dark:text-white">{current?.name ?? (routine.isPending ? "Cargando rutina…" : "Todavía no tienes una rutina")}</Text>
      {days.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {days.map((item) => {
            const selected = item.id === day?.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.name}
                className={`rounded-full px-4 py-2 ${selected ? "bg-[#c6f135]" : "bg-[#fffcf6] dark:bg-[#1c241c]"}`}
                onPress={() => {
                  setDayId(item.id);
                  setRest(0);
                  setMessage("");
                }}
              >
                <Text className={`font-semibold ${selected ? "text-[#142000]" : "text-[#161915] dark:text-white"}`}>{item.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : day ? <Text className="text-[#3d5c0a] dark:text-[#c6f135]">{day.name}</Text> : null}
      {!current && !routine.isPending ? <Text className="text-[#5c655b] dark:text-[#c9d2c8]">Cuando tu entrenador te asigne una, vas a poder registrar cada serie aquí.</Text> : null}
      {rest > 0 ? <Text className="text-2xl font-semibold text-[#161915] dark:text-white">Descanso {rest} s</Text> : null}
      {message ? <Text className="text-[#c83b2d] dark:text-[#ff8d7a]">{message}</Text> : null}
      {exercises.map((exercise) => {
        const done = (logs.data ?? []).filter((entry) => entry.routine_exercise_id === exercise.id);
        const draft = draftFor(exercise);
        const next = done.length + 1;
        return (
          <View key={exercise.id} className="rounded-3xl bg-[#fffcf6] dark:bg-[#1c241c] p-4">
            <Text className="text-xl font-semibold text-[#161915] dark:text-white">{exercise.exercises_library?.name ?? "Ejercicio"}</Text>
            <Text className="mt-1 text-[#5c655b] dark:text-[#c9d2c8]">{prescription(exercise.sets, exercise.reps)}</Text>
            <Text className="text-[#5c655b] dark:text-[#c9d2c8]">Descanso {exercise.rest_seconds} s</Text>
            {exercise.trainer_notes ? <Text className="mt-2 text-[#161915] dark:text-white">{exercise.trainer_notes}</Text> : null}
            <View className="mt-3 flex-row gap-2">
              <View className="flex-1">
                <Text className="mb-1 text-sm text-[#5c655b] dark:text-[#c9d2c8]">Peso (kg)</Text>
                <TextInput
                  className="rounded-xl bg-[#e6e8e0] dark:bg-black/30 px-3 py-2 text-[#161915] dark:text-white"
                  accessibilityLabel="Peso en kilogramos"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={draft.weight}
                  onChangeText={(weight) => updateDraft(exercise.id, { weight })}
                />
              </View>
              <View className="flex-1">
                <Text className="mb-1 text-sm text-[#5c655b] dark:text-[#c9d2c8]">Repeticiones</Text>
                <TextInput
                  className="rounded-xl bg-[#e6e8e0] dark:bg-black/30 px-3 py-2 text-[#161915] dark:text-white"
                  accessibilityLabel="Repeticiones"
                  placeholder={exercise.reps}
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  value={draft.reps}
                  onChangeText={(reps) => updateDraft(exercise.id, { reps })}
                />
              </View>
            </View>
            <Pressable className="mt-3 items-center rounded-full bg-[#c6f135] py-3" accessibilityRole="button" onPress={() => void logSet(exercise)}>
              <Text className="font-semibold text-[#142000]">{done.length >= exercise.sets ? "Registrar otra serie" : `Registrar serie ${next} de ${exercise.sets}`}</Text>
            </Pressable>
            <Text className="mt-3 font-semibold text-[#161915] dark:text-white">Series registradas</Text>
            {done.length === 0 ? <Text className="mt-1 text-[#5c655b] dark:text-[#c9d2c8]">Todavía no registras ninguna.</Text> : null}
            {done.length > 0 ? <Text className="mt-1 text-[#3d5c0a] dark:text-[#c6f135]">{seriesLabel(done.length)}</Text> : null}
            {done.map((entry) => (
              <Text key={entry.id} className="mt-1 text-[#5c655b] dark:text-[#c9d2c8]">
                Serie {entry.set_number} · {entry.weight_kg == null ? "sin peso" : `${entry.weight_kg} kg`} · {entry.reps_completed} repeticiones
              </Text>
            ))}
          </View>
        );
      })}
    </ScrollView>
    <FloatingTimer />
    </View>
  );
}
