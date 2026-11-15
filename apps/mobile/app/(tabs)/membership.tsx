import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState, type JSX } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import QRCodeSvg from "react-native-qrcode-svg";
import { cacheKeys, supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

const MemberPass = QRCodeSvg as unknown as (props: { value: string; size: number }) => JSX.Element;

type Athlete = {
  full_name: string;
  email: string;
  phone: string | null;
  national_id: string | null;
  birth_date: string | null;
  gender: string | null;
  avatar_url: string | null;
  qr_code_token: string;
};

function shownDate(value: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "A";
}

export default function ProfileScreen() {
  const { colors } = useTheme();
  const client = useQueryClient();
  const [cachedQr, setCachedQr] = useState("");
  const [planId, setPlanId] = useState("");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoNote, setPhotoNote] = useState("");

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return null;
      const columns = "full_name, email, phone, national_id, birth_date, gender, avatar_url, qr_code_token";
      const withId = await supabase.from("profiles").select(columns).eq("id", userId).single();
      const row = withId.error?.message.includes("national_id")
        ? await supabase.from("profiles").select("full_name, email, phone, birth_date, gender, avatar_url, qr_code_token").eq("id", userId).single()
        : withId;
      if (row.error || !row.data) throw new Error(row.error?.message ?? "No se pudo cargar el perfil.");
      const athlete = { national_id: null, ...row.data } as Athlete;
      const subscription = await supabase
        .from("member_subscriptions")
        .select("end_date, plan_id")
        .eq("member_id", userId)
        .eq("status", "active")
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      const plan = subscription.data?.plan_id
        ? await supabase.from("membership_plans").select("name").eq("id", subscription.data.plan_id).maybeSingle()
        : { data: null };
      return { athlete, membership: subscription.data ? { end: subscription.data.end_date, plan: plan.data?.name ?? "Membresía" } : null };
    },
  });

  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data } = await supabase.from("membership_plans").select("id, name, price, duration_days").eq("is_active", true).order("price");
      return data ?? [];
    },
  });

  useEffect(() => {
    void AsyncStorage.getItem(cacheKeys.qr).then((value) => setCachedQr(value ?? ""));
  }, []);
  const token = profile.data?.athlete.qr_code_token ?? cachedQr;
  useEffect(() => {
    if (token) void AsyncStorage.setItem(cacheKeys.qr, token);
  }, [token]);

  async function uploadPhoto() {
    setPhotoNote("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotoNote("Necesitamos permiso para elegir una foto.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;
    setUploading(true);
    const bytes = new Uint8Array(await fetch(asset.uri).then((response) => response.arrayBuffer()));
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    const avatarUrl = `data:${asset.mimeType ?? "image/jpeg"};base64,${btoa(binary)}`;
    const saved = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId);
    setUploading(false);
    if (saved.error) {
      setPhotoNote(saved.error.message);
      return;
    }
    await client.invalidateQueries({ queryKey: ["profile"] });
  }

  async function quote() {
    const selected = planId || plans.data?.[0]?.id;
    if (!selected || !code) return;
    const { data: auth } = await supabase.auth.getUser();
    const { data, error } = await supabase.rpc("preview_promotion", {
      p_code: code,
      p_plan_id: selected,
      p_member_id: auth.user?.id ?? null,
    });
    setPreview(error ? error.message : JSON.stringify(data));
  }

  async function redeem() {
    const selected = planId || plans.data?.[0]?.id;
    const { data: auth } = await supabase.auth.getUser();
    if (!selected || !auth.user) return;
    const response = code
      ? await supabase.rpc("redeem_promotion_code", {
          p_code: code,
          p_member_id: auth.user.id,
          p_plan_id: selected,
          p_payment_method: "card",
        })
      : await supabase.rpc("subscribe_member", {
          p_member_id: auth.user.id,
          p_plan_id: selected,
          p_payment_method: "card",
        });
    setResult(response.error ? response.error.message : "Membresía activada.");
    void client.invalidateQueries({ queryKey: ["profile"] });
    void client.invalidateQueries({ queryKey: ["home"] });
  }

  const athlete = profile.data?.athlete;
  const facts = [
    ["Correo", athlete?.email],
    ["Teléfono", athlete?.phone],
    ["Cédula", athlete?.national_id],
    ["Nacimiento", athlete?.birth_date ? shownDate(athlete.birth_date) : null],
    ["Género", athlete?.gender],
    ["Membresía", profile.data?.membership ? `${profile.data.membership.plan} · vence ${shownDate(profile.data.membership.end)}` : "Sin membresía activa"],
  ] as const;

  return (
    <ScrollView className="flex-1 bg-[#f3f4ef] dark:bg-[#101410]" contentContainerClassName="gap-4 px-5 py-6">
      <Text className="text-3xl font-semibold text-[#161915] dark:text-white">Tu perfil</Text>
      <View className="items-center gap-3">
        <Pressable className="h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#fffcf6] dark:bg-[#1c241c]" onPress={() => void uploadPhoto()} disabled={uploading}>
          {athlete?.avatar_url ? (
            <Image source={{ uri: athlete.avatar_url }} style={{ width: 96, height: 96 }} />
          ) : (
            <Text className="text-2xl font-semibold text-[#161915] dark:text-white">{initials(athlete?.full_name ?? "")}</Text>
          )}
        </Pressable>
        <Text className="text-xl font-semibold text-[#161915] dark:text-white">{athlete?.full_name ?? "Atleta"}</Text>
        <Pressable onPress={() => void uploadPhoto()} disabled={uploading}>
          <Text className="text-sm text-[#3d5c0a] dark:text-[#c6f135]">{uploading ? "Subiendo foto…" : "Subir foto"}</Text>
        </Pressable>
        {photoNote ? <Text className="text-center text-sm text-[#c83b2d] dark:text-[#ff8d7a]">{photoNote}</Text> : null}
      </View>
      <View className="gap-3 rounded-3xl bg-[#fffcf6] dark:bg-[#1c241c] p-4">
        {facts.map(([label, value]) => (
          <View key={label}>
            <Text className="text-xs tracking-[2px] text-[#3d5c0a] dark:text-[#c6f135]">{label.toUpperCase()}</Text>
            <Text className="mt-1 text-base text-[#161915] dark:text-white">{value || "—"}</Text>
          </View>
        ))}
      </View>
      <View className="items-center rounded-3xl bg-white p-6">
        <Text className="text-center text-base font-semibold text-[#142000]">Registra tu asistencia</Text>
        <View className="mt-4">{token ? <MemberPass value={token} size={220} /> : <Text className="text-[#142000]">Sin pase en caché</Text>}</View>
      </View>
      <Text className="text-lg font-semibold text-[#161915] dark:text-white">Renovar membresía</Text>
      {(plans.data ?? []).map((plan) => (
        <Pressable key={plan.id} className={`rounded-3xl p-4 ${planId === plan.id ? "bg-[#c6f135]" : "bg-[#fffcf6] dark:bg-[#1c241c]"}`} onPress={() => setPlanId(plan.id)}>
          <Text className={planId === plan.id ? "text-[#142000]" : "text-[#161915] dark:text-white"}>{plan.name} · ₡{Number(plan.price).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        </Pressable>
      ))}
      <TextInput className="rounded-2xl bg-[#e6e8e0] dark:bg-white/10 px-4 py-3 text-[#161915] dark:text-white" placeholder="Código" placeholderTextColor={colors.muted} autoCapitalize="characters" value={code} onChangeText={setCode} />
      <Pressable className="items-center rounded-full border border-[#d7dacf] dark:border-white/20 py-3" onPress={() => void quote()}>
        <Text className="text-[#161915] dark:text-white">Ver beneficio</Text>
      </Pressable>
      {preview ? <Text className="text-[#5c655b] dark:text-[#c9d2c8]">{preview}</Text> : null}
      <Pressable className="items-center rounded-full bg-[#c6f135] py-3" onPress={() => void redeem()}>
        <Text className="font-semibold text-[#142000]">Activar</Text>
      </Pressable>
      {result ? <Text className="text-[#161915] dark:text-white">{result}</Text> : null}
    </ScrollView>
  );
}
