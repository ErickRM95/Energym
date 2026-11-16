import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function appBase() {
  return window.location.pathname.startsWith("/movil") ? "/movil/" : "/";
}

export function InstallShortcut() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState("");

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const ios = navigator as Navigator & { standalone?: boolean };
    if (window.matchMedia("(display-mode: standalone)").matches || ios.standalone) {
      setInstalled(true);
      return;
    }
    const base = appBase();
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]') ?? document.createElement("link");
    manifest.rel = "manifest";
    manifest.href = `${base}manifest.webmanifest`;
    document.head.appendChild(manifest);
    const touch = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]') ?? document.createElement("link");
    touch.rel = "apple-touch-icon";
    touch.href = `${base}apple-touch-icon.png`;
    document.head.appendChild(touch);
    void navigator.serviceWorker?.register(`${base}sw.js`);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (Platform.OS !== "web" || installed) return null;

  async function download() {
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setPrompt(null);
      return;
    }
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    setHelp(ios ? "Toca Compartir y elige Agregar a inicio." : "Abre el menú del navegador y elige Instalar app o Agregar a pantalla de inicio.");
  }

  return (
    <View className="mt-4">
      <Pressable accessibilityRole="button" className="items-center rounded-full border border-[#c6f135] py-3" onPress={() => void download()}>
        <Text className="font-semibold text-[#3d5c0a] dark:text-[#c6f135]">Descargar</Text>
      </Pressable>
      {help ? <Text className="mt-2 text-center text-sm leading-5 text-[#5c655b] dark:text-[#c9d2c8]">{help}</Text> : null}
    </View>
  );
}
