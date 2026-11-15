import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import type { Database } from "@energym/shared";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

const serverRender = Platform.OS === "web" && typeof window === "undefined";

export const appStorage = {
  getItem: (storageKey: string) => (serverRender ? Promise.resolve(null) : AsyncStorage.getItem(storageKey)),
  setItem: (storageKey: string, value: string) => (serverRender ? Promise.resolve() : AsyncStorage.setItem(storageKey, value)),
  removeItem: (storageKey: string) => (serverRender ? Promise.resolve() : AsyncStorage.removeItem(storageKey)),
};

export const supabase = createClient<Database>(url, key, {
  auth: {
    storage: appStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const cacheKeys = {
  qr: "energym.qr",
  routine: "energym.routine",
};
