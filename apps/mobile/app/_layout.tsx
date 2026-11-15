import "../global.css";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { Session } from "@supabase/supabase-js";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { appStorage, supabase } from "@/lib/supabase";
import { ThemeProvider, useTheme } from "@/lib/theme";

const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: 1000 * 60 * 60 * 24 } },
});
const persister = createAsyncStoragePersister({ storage: appStorage });

export default function RootLayout() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <ThemeProvider>
        <AuthStack />
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

function AuthStack() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const { colors } = useTheme();
  if (session === undefined) return null;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Protected guard={!session} redirectTo="/">
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={!!session} redirectTo="/login">
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}
