import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { AppearanceSwitch } from "@/components/appearance-switch";
import { BrandLogo } from "@/components/brand-logo";
import { InstallShortcut } from "@/components/install-shortcut";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const params = useLocalSearchParams<{ correo?: string; clave?: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { colors } = useTheme();

  useEffect(() => {
    if (typeof params.correo === "string") setEmail(params.correo);
    if (typeof params.clave === "string") setPassword(params.clave);
  }, [params.correo, params.clave]);

  async function enter() {
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setError(authError ? "Correo o contraseña incorrectos." : "");
  }

  return (
    <View className="flex-1 bg-[#f3f4ef] dark:bg-[#101410] px-6 pt-8">
      <View className="items-end">
        <AppearanceSwitch />
      </View>
      <View className="flex-1 justify-center">
      <BrandLogo width={250} />
      <Text className="mt-6 text-4xl font-semibold text-[#161915] dark:text-white">Tu pase</Text>
      <TextInput className="mt-8 rounded-2xl bg-[#e6e8e0] dark:bg-white/10 px-4 py-3 text-[#161915] dark:text-white" autoCapitalize="none" placeholder="Correo" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} />
      <TextInput className="mt-3 rounded-2xl bg-[#e6e8e0] dark:bg-white/10 px-4 py-3 text-[#161915] dark:text-white" secureTextEntry placeholder="Contraseña" placeholderTextColor={colors.muted} value={password} onChangeText={setPassword} />
      {error ? <Text className="mt-3 text-[#c83b2d] dark:text-[#ff8d7a]">{error}</Text> : null}
      <Pressable className="mt-6 items-center rounded-full bg-[#c6f135] py-3" onPress={() => void enter()}>
        <Text className="font-semibold text-[#142000]">Entrar</Text>
      </Pressable>
      <InstallShortcut />
      </View>
    </View>
  );
}
