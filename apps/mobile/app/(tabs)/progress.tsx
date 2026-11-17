import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

type Goal = {
  id: string;
  label: string;
  unit: string;
  start_value: number;
  current_value: number;
  target_value: number;
};

type RecordRow = {
  id: string;
  exercise_name: string;
  value: number;
  unit: string;
  reps: number | null;
};

type PhotoSlot = "start" | "final";

type ProgressPhoto = {
  id: string;
  photo_url: string;
  taken_at: string;
  url: string;
  slot: PhotoSlot | "other";
};

const units = ["kg", "cm", "%"];

function amount(value: number) {
  return Number(value).toLocaleString("es-CR", { maximumFractionDigits: 1 });
}

function progressRatio(start: number, current: number, target: number) {
  const span = target - start;
  if (span === 0) return current === target ? 1 : 0;
  return Math.min(1, Math.max(0, (current - start) / span));
}

function slotOf(path: string): PhotoSlot | "other" {
  if (path.includes("/start/")) return "start";
  if (path.includes("/final/")) return "final";
  return "other";
}

function latest(photos: ProgressPhoto[], slot: PhotoSlot) {
  return photos.find((photo) => photo.slot === slot);
}

export default function ProgressScreen() {
  const { colors } = useTheme();
  const client = useQueryClient();
  const [message, setMessage] = useState("");
  const [goalOpen, setGoalOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [goalLabel, setGoalLabel] = useState("");
  const [goalUnit, setGoalUnit] = useState("kg");
  const [goalStart, setGoalStart] = useState("");
  const [goalNow, setGoalNow] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [recordName, setRecordName] = useState("");
  const [recordValue, setRecordValue] = useState("");
  const [recordReps, setRecordReps] = useState("");
  const [updates, setUpdates] = useState<Record<string, string>>({});
  const progress = useQuery({
    queryKey: ["athlete-progress"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? "";
      if (!userId) return null;
      const profile = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
      const [{ data: measures }, { data: logs }, { data: photos }, { data: goals }, { data: records }] = await Promise.all([
        supabase.from("body_measurements").select("id, weight_kg, body_fat_pct, recorded_at").eq("member_id", userId).order("recorded_at"),
        supabase.from("workout_logs").select("weight_kg, logged_at, routine_exercises(exercises_library(name))").eq("member_id", userId),
        supabase.from("progress_photos").select("id, photo_url, taken_at").eq("member_id", userId).order("taken_at", { ascending: false }),
        supabase.from("athlete_goals").select("id, label, unit, start_value, current_value, target_value").eq("member_id", userId).order("created_at"),
        supabase.from("personal_records").select("id, exercise_name, value, unit, reps").eq("member_id", userId).order("value", { ascending: false }),
      ]);
      const signed = await Promise.all((photos ?? []).map(async (photo) => {
        const { data } = await supabase.storage.from("progress-photos").createSignedUrl(photo.photo_url, 60 * 60);
        return { ...photo, url: data?.signedUrl ?? "", slot: slotOf(photo.photo_url) };
      }));
      const lifted = new Map<string, number>();
      const rows = (logs ?? []) as unknown as Array<{
        weight_kg: number | null;
        logged_at: string;
        routine_exercises: { exercises_library: { name: string } | null } | null;
      }>;
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const days = new Set<string>();
      for (const log of rows) {
        const name = log.routine_exercises?.exercises_library?.name;
        if (name && log.weight_kg !== null) lifted.set(name, Math.max(lifted.get(name) ?? 0, Number(log.weight_kg)));
        if (log.logged_at && new Date(log.logged_at).getTime() >= weekAgo) days.add(log.logged_at.slice(0, 10));
      }
      return {
        organizationId: profile.data?.organization_id ?? "",
        userId,
        measures: measures ?? [],
        goals: (goals ?? []) as Goal[],
        records: (records ?? []) as RecordRow[],
        photos: signed,
        lifted: [...lifted.entries()],
        sessions: days.size,
      };
    },
  });

  const data = progress.data;
  const weights = (data?.measures ?? []).map((row) => Number(row.weight_kg)).filter((value) => value > 0);
  const firstWeight = weights[0];
  const lastWeight = weights[weights.length - 1];
  const startPhoto = data ? latest(data.photos ?? [], "start") : undefined;
  const finalPhoto = data ? latest(data.photos ?? [], "final") : undefined;
  const completed = (data?.goals ?? []).filter((goal) => progressRatio(Number(goal.start_value), Number(goal.current_value), Number(goal.target_value)) >= 1).length;

  async function refresh() {
    await client.invalidateQueries({ queryKey: ["athlete-progress"] });
  }

  async function saveGoal() {
    if (!data?.organizationId) return;
    const start = Number(goalStart.replace(",", "."));
    const current = Number((goalNow || goalStart).replace(",", "."));
    const target = Number(goalTarget.replace(",", "."));
    if (!goalLabel.trim() || [start, current, target].some((value) => Number.isNaN(value))) {
      setMessage("Completa la meta con números.");
      return;
    }
    if (start === target) {
      setMessage("El punto de partida y la meta tienen que ser distintos.");
      return;
    }
    const { error } = await supabase.from("athlete_goals").insert({
      organization_id: data.organizationId,
      member_id: data.userId,
      label: goalLabel.trim(),
      unit: goalUnit,
      start_value: start,
      current_value: current,
      target_value: target,
    });
    if (error) {
      setMessage("No se pudo guardar la meta.");
      return;
    }
    setGoalLabel("");
    setGoalStart("");
    setGoalNow("");
    setGoalTarget("");
    setGoalOpen(false);
    setMessage("");
    await refresh();
  }

  async function updateGoal(goal: Goal) {
    const next = Number((updates[goal.id] ?? "").replace(",", "."));
    if (Number.isNaN(next)) {
      setMessage("Escribe el valor actual.");
      return;
    }
    const { error } = await supabase.from("athlete_goals").update({ current_value: next }).eq("id", goal.id);
    if (error) {
      setMessage("No se pudo actualizar la meta.");
      return;
    }
    setMessage("");
    await refresh();
  }

  async function saveRecord() {
    if (!data?.organizationId) return;
    const value = Number(recordValue.replace(",", "."));
    const reps = recordReps.trim() ? Number(recordReps) : null;
    if (!recordName.trim() || Number.isNaN(value) || value <= 0) {
      setMessage("Anota el ejercicio y la marca.");
      return;
    }
    const { error } = await supabase.from("personal_records").insert({
      organization_id: data.organizationId,
      member_id: data.userId,
      exercise_name: recordName.trim(),
      value,
      unit: "kg",
      reps: reps && reps > 0 ? reps : null,
    });
    if (error) {
      setMessage("No se pudo guardar el récord.");
      return;
    }
    setRecordName("");
    setRecordValue("");
    setRecordReps("");
    setRecordOpen(false);
    setMessage("");
    await refresh();
  }

  async function pickPhoto(slot: PhotoSlot) {
    if (!data?.organizationId) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage("Necesitamos permiso para elegir la foto.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const bytes = await fetch(asset.uri).then((response) => response.arrayBuffer());
    const path = `${data.organizationId}/${data.userId}/${slot}/${Date.now()}.jpg`;
    const uploaded = await supabase.storage.from("progress-photos").upload(path, bytes, {
      contentType: asset.mimeType ?? "image/jpeg",
      upsert: false,
    });
    if (uploaded.error) {
      setMessage("No se pudo subir la foto.");
      return;
    }
    const saved = await supabase.from("progress_photos").insert({
      organization_id: data.organizationId,
      member_id: data.userId,
      photo_url: path,
      angle: "front",
    });
    if (saved.error) {
      setMessage("La foto se subió, pero no quedó registrada.");
      return;
    }
    setMessage(slot === "start" ? "Foto de inicio lista." : "Foto final lista.");
    await refresh();
  }

  return (
    <ScrollView className="flex-1 bg-[#f3f4ef] dark:bg-[#101410]" contentContainerClassName="gap-4 px-5 py-6">
      <Text className="text-3xl font-semibold text-[#161915] dark:text-white">Tu progreso</Text>
      <Text className="text-[#5c655b] dark:text-[#c9d2c8]">
        {completed > 0 ? `Llevas ${completed} ${completed === 1 ? "meta cumplida" : "metas cumplidas"}.` : "Una foto, una meta y un récord. El cambio se ve."}
      </Text>
      {data ? (
        <View className="rounded-3xl bg-[#161915] p-4">
          <Text className="text-sm text-[#c6f135]">Esta semana</Text>
          <Text className="mt-1 text-3xl font-semibold text-white">
            {data.sessions > 0 ? `${data.sessions} ${data.sessions === 1 ? "entreno" : "entrenos"}` : "Tu primer entreno te espera"}
          </Text>
        </View>
      ) : null}
      {progress.isError ? <Text className="text-[#8a3a12]">No se pudo cargar el progreso.</Text> : null}
      {message ? <Text className="text-[#3d5c0a] dark:text-[#c6f135]">{message}</Text> : null}

      <View className="rounded-3xl bg-[#fffcf6] dark:bg-[#1c241c] p-4">
        <Text className="text-lg font-semibold text-[#161915] dark:text-white">Antes y después</Text>
        <View className="mt-3 flex-row gap-3">
          <PhotoCard label="Inicio" photo={startPhoto} onPress={() => void pickPhoto("start")} />
          <PhotoCard label="Final" photo={finalPhoto} onPress={() => void pickPhoto("final")} />
        </View>
      </View>

      {firstWeight ? (
        <View className="rounded-3xl bg-[#fffcf6] dark:bg-[#1c241c] p-4">
          <Text className="text-lg font-semibold text-[#161915] dark:text-white">Peso</Text>
          <View className="mt-3 flex-row items-end justify-between">
            <View>
              <Text className="text-sm text-[#5c655b] dark:text-[#c9d2c8]">Empezaste</Text>
              <Text className="text-2xl font-semibold text-[#161915] dark:text-white">{amount(firstWeight)} kg</Text>
            </View>
            <Text className="text-3xl font-semibold text-[#3d5c0a] dark:text-[#c6f135]">
              {lastWeight === firstWeight ? "Igual" : `${lastWeight < firstWeight ? "−" : "+"}${amount(Math.abs(lastWeight - firstWeight))} kg`}
            </Text>
            <View>
              <Text className="text-right text-sm text-[#5c655b] dark:text-[#c9d2c8]">Hoy</Text>
              <Text className="text-right text-2xl font-semibold text-[#161915] dark:text-white">{amount(lastWeight)} kg</Text>
            </View>
          </View>
        </View>
      ) : null}

      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-[#161915] dark:text-white">Metas</Text>
          <Pressable accessibilityRole="button" onPress={() => setGoalOpen((value) => !value)}>
            <Text className="font-semibold text-[#3d5c0a] dark:text-[#c6f135]">{goalOpen ? "Cerrar" : "Nueva meta"}</Text>
          </Pressable>
        </View>
        {goalOpen ? (
          <View className="rounded-3xl bg-[#fffcf6] dark:bg-[#1c241c] p-4">
            <View>
              <Field label="Qué quieres lograr" value={goalLabel} onChange={setGoalLabel} placeholder="Bajar de peso" colors={colors.muted} />
            </View>
            <Text className="mb-1 mt-3 text-sm text-[#5c655b] dark:text-[#c9d2c8]">Unidad</Text>
            <View className="flex-row gap-2">
              {units.map((unit) => (
                <Pressable key={unit} accessibilityRole="button" className={`rounded-full px-4 py-2 ${goalUnit === unit ? "bg-[#c6f135]" : "bg-[#e6e8e0] dark:bg-black/30"}`} onPress={() => setGoalUnit(unit)}>
                  <Text className={`font-semibold ${goalUnit === unit ? "text-[#142000]" : "text-[#161915] dark:text-white"}`}>{unit}</Text>
                </Pressable>
              ))}
            </View>
            <View className="mt-3 flex-row gap-2">
              <View className="flex-1"><Field label="Desde" value={goalStart} onChange={setGoalStart} placeholder="95" colors={colors.muted} numeric /></View>
              <View className="flex-1"><Field label="Ahora" value={goalNow} onChange={setGoalNow} placeholder="90" colors={colors.muted} numeric /></View>
              <View className="flex-1"><Field label="Meta" value={goalTarget} onChange={setGoalTarget} placeholder="85" colors={colors.muted} numeric /></View>
            </View>
            <Pressable accessibilityRole="button" className="mt-3 items-center rounded-full bg-[#c6f135] py-3" onPress={() => void saveGoal()}>
              <Text className="font-semibold text-[#142000]">Guardar meta</Text>
            </Pressable>
          </View>
        ) : null}
        {(data?.goals?.length ?? 0) === 0 && !goalOpen ? <Text className="text-[#5c655b] dark:text-[#c9d2c8]">Todavía no tienes metas. Prueba con un peso, una medida o un porcentaje.</Text> : null}
        {(data?.goals ?? []).map((goal) => {
          const ratio = progressRatio(Number(goal.start_value), Number(goal.current_value), Number(goal.target_value));
          const done = ratio >= 1;
          const gap = Math.abs(Number(goal.target_value) - Number(goal.current_value));
          return (
            <View key={goal.id} className="rounded-3xl bg-[#fffcf6] dark:bg-[#1c241c] p-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-[#161915] dark:text-white">{goal.label}</Text>
                  <Text className="text-[#5c655b] dark:text-[#c9d2c8]">{amount(Number(goal.current_value))} de {amount(Number(goal.target_value))} {goal.unit}</Text>
                </View>
                <Text className="text-2xl font-semibold text-[#3d5c0a] dark:text-[#c6f135]">{Math.round(ratio * 100)}%</Text>
              </View>
              <View className="mt-3 h-2 rounded-full bg-[#e6e8e0] dark:bg-white/10">
                <View className="h-2 rounded-full bg-[#c6f135]" style={{ width: `${ratio * 100}%` }} />
              </View>
              <Text className="mt-2 text-sm text-[#5c655b] dark:text-[#c9d2c8]">{done ? "Meta cumplida" : `Te faltan ${amount(gap)} ${goal.unit}`}</Text>
              <View className="mt-3 flex-row items-center gap-2">
                <TextInput
                  className="flex-1 rounded-xl bg-[#e6e8e0] dark:bg-black/30 px-3 py-2 text-[#161915] dark:text-white"
                  placeholder="Nuevo valor"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={updates[goal.id] ?? ""}
                  onChangeText={(value) => setUpdates((current) => ({ ...current, [goal.id]: value }))}
                />
                <Pressable accessibilityRole="button" className="rounded-full bg-[#161915] px-4 py-2 dark:bg-white" onPress={() => void updateGoal(goal)}>
                  <Text className="font-semibold text-white dark:text-[#142000]">Actualizar</Text>
                </Pressable>
              </View>
              <Pressable accessibilityRole="button" className="mt-3" onPress={() => void supabase.from("athlete_goals").delete().eq("id", goal.id).then(() => refresh())}>
                <Text className="text-sm text-[#5c655b] dark:text-[#c9d2c8]">Quitar meta</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-[#161915] dark:text-white">Récords personales</Text>
          <Pressable accessibilityRole="button" onPress={() => setRecordOpen((value) => !value)}>
            <Text className="font-semibold text-[#3d5c0a] dark:text-[#c6f135]">{recordOpen ? "Cerrar" : "Anotar récord"}</Text>
          </Pressable>
        </View>
        {recordOpen ? (
          <View className="rounded-3xl bg-[#fffcf6] dark:bg-[#1c241c] p-4">
            <View>
              <Field label="Ejercicio" value={recordName} onChange={setRecordName} placeholder="Sentadilla" colors={colors.muted} />
            </View>
            <View className="mt-3 flex-row gap-2">
              <View className="flex-1"><Field label="Marca (kg)" value={recordValue} onChange={setRecordValue} placeholder="100" colors={colors.muted} numeric /></View>
              <View className="flex-1"><Field label="Repeticiones" value={recordReps} onChange={setRecordReps} placeholder="5" colors={colors.muted} numeric /></View>
            </View>
            <Pressable accessibilityRole="button" className="mt-3 items-center rounded-full bg-[#c6f135] py-3" onPress={() => void saveRecord()}>
              <Text className="font-semibold text-[#142000]">Guardar récord</Text>
            </Pressable>
          </View>
        ) : null}
        {(data?.records?.length ?? 0) === 0 && !recordOpen ? <Text className="text-[#5c655b] dark:text-[#c9d2c8]">Anota tu mejor marca. Puede ser una sentadilla, un peso muerto o las dominadas.</Text> : null}
        {(data?.records ?? []).map((record) => (
          <View key={record.id} className="flex-row items-center justify-between rounded-3xl bg-[#fffcf6] dark:bg-[#1c241c] p-4">
            <View>
              <Text className="text-lg font-semibold text-[#161915] dark:text-white">{record.exercise_name}</Text>
              <Text className="text-[#5c655b] dark:text-[#c9d2c8]">{record.reps ? `${record.reps} repeticiones` : "Mejor peso"}</Text>
            </View>
            <View className="items-end">
              <Text className="text-2xl font-semibold text-[#3d5c0a] dark:text-[#c6f135]">{amount(Number(record.value))} {record.unit}</Text>
              <Pressable accessibilityRole="button" onPress={() => void supabase.from("personal_records").delete().eq("id", record.id).then(() => refresh())}>
                <Text className="text-sm text-[#5c655b] dark:text-[#c9d2c8]">Quitar</Text>
              </Pressable>
            </View>
          </View>
        ))}
        {(data?.lifted?.length ?? 0) > 0 ? <Text className="mt-2 text-sm font-semibold text-[#161915] dark:text-white">Mejores pesos de tus series</Text> : null}
        {(data?.lifted ?? []).map(([name, weight]) => (
          <Text key={name} className="text-[#5c655b] dark:text-[#c9d2c8]">{name} · {amount(weight)} kg</Text>
        ))}
      </View>
    </ScrollView>
  );
}

function PhotoCard({ label, photo, onPress }: { label: string; photo?: ProgressPhoto; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Foto de ${label}`} className="flex-1 overflow-hidden rounded-2xl border border-[#c6f135]/50 bg-[#e6e8e0] dark:bg-black/30" onPress={onPress}>
      {photo?.url ? <Image source={{ uri: photo.url }} style={{ width: "100%", height: 200 }} /> : (
        <View style={{ height: 168 }} className="items-center px-3 pt-8">
          <Text className="text-4xl font-semibold text-[#3d5c0a] dark:text-[#c6f135]">+</Text>
          <Text className="mt-1 text-center font-semibold text-[#161915] dark:text-white">Agregar foto</Text>
        </View>
      )}
      <Text className="bg-[#161915] py-2 text-center text-sm font-semibold text-white">{label}</Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  colors,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  colors: string;
  numeric?: boolean;
}) {
  return (
    <View>
      <Text className="mb-1 text-sm text-[#5c655b] dark:text-[#c9d2c8]">{label}</Text>
      <TextInput
        className="rounded-xl bg-[#e6e8e0] dark:bg-black/30 px-3 py-2 text-[#161915] dark:text-white"
        placeholder={placeholder}
        placeholderTextColor={colors}
        keyboardType={numeric ? "decimal-pad" : "default"}
        value={value}
        onChangeText={onChange}
      />
    </View>
  );
}
