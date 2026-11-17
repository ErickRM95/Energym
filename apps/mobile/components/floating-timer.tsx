import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { playBeeps, unlockBeep } from "@/lib/beep";

const presets = [30, 45, 60, 90, 120, 180];
const intervals = [0, 10, 15, 30, 60];

function clock(total: number) {
  const safe = Math.max(0, total);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function presetLabel(total: number) {
  if (total < 60) return `${total} segundos`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (seconds === 0) return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function chipText(total: number, tone: string) {
  if (total > 0 && total < 60) {
    return (
      <Text className={tone}>
        {total}
        <Text className={tone}>s</Text>
      </Text>
    );
  }
  return <Text className={tone}>{presetLabel(total)}</Text>;
}

export function FloatingTimer() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState(90);
  const [remaining, setRemaining] = useState(90);
  const [running, setRunning] = useState(false);
  const [beepEvery, setBeepEvery] = useState(30);
  const [endBeeps, setEndBeeps] = useState(3);
  const armed = useRef(false);
  const lastBeep = useRef<number | null>(null);
  const remainingRef = useRef(remaining);
  const endBeepsRef = useRef(endBeeps);
  endBeepsRef.current = endBeeps;
  remainingRef.current = remaining;

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const next = remainingRef.current <= 1 ? 0 : remainingRef.current - 1;
      remainingRef.current = next;
      setRemaining(next);
    }, 1000);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!armed.current) return;
    if (remaining === 0) {
      armed.current = false;
      setRunning(false);
      void playBeeps(endBeepsRef.current, 587);
      return;
    }
    if (beepEvery > 0 && remaining % beepEvery === 0 && lastBeep.current !== remaining) {
      lastBeep.current = remaining;
      void playBeeps(1, 466);
    }
  }, [remaining, beepEvery]);

  function chooseDuration(next: number) {
    if (running) return;
    const safe = Math.max(0, Math.min(60 * 60, next));
    setDuration(safe);
    setRemaining(safe);
    armed.current = false;
    lastBeep.current = null;
  }

  async function begin() {
    const total = remainingRef.current > 0 ? remainingRef.current : duration;
    if (total <= 0) return;
    remainingRef.current = total;
    setRemaining(total);
    lastBeep.current = total;
    armed.current = true;
    await unlockBeep();
    setRunning(true);
  }

  function reset() {
    armed.current = false;
    lastBeep.current = null;
    remainingRef.current = duration;
    setRunning(false);
    setRemaining(duration);
  }

  const { height } = useWindowDimensions();
  const bottom = Math.max(insets.bottom, 16);
  const panelHeight = Math.max(220, height - bottom - 96);

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 30 }}>
      {open ? (
        <View className="absolute right-4 w-80 max-w-[90%] overflow-hidden rounded-3xl bg-[#fffcf6] dark:bg-[#1c241c]" style={{ bottom: bottom + 68, maxHeight: panelHeight }}>
          <ScrollView contentContainerClassName="p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-[#161915] dark:text-white">Cronómetro</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar cronómetro" onPress={() => setOpen(false)}>
              <Text className="text-[#5c655b] dark:text-[#c9d2c8]">Cerrar</Text>
            </Pressable>
          </View>
          <Text className="mt-2 text-center text-5xl font-semibold text-[#161915] dark:text-white">{clock(remaining)}</Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {presets.map((preset) => {
              const selected = duration === preset;
              return (
                <Pressable
                  key={preset}
                  accessibilityRole="button"
                  accessibilityLabel={`Duración ${presetLabel(preset)}`}
                  disabled={running}
                  className={`rounded-full px-3 py-2 ${selected ? "bg-[#c6f135]" : "bg-[#e6e8e0] dark:bg-black/30"}`}
                  onPress={() => chooseDuration(preset)}
                >
                  {chipText(preset, `text-sm font-semibold ${selected ? "text-[#142000]" : "text-[#161915] dark:text-white"}`)}
                </Pressable>
              );
            })}
          </View>
          <Text className="mt-4 text-sm text-[#5c655b] dark:text-[#c9d2c8]">Pitido cada</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {intervals.map((interval) => {
              const selected = beepEvery === interval;
              return (
                <Pressable
                  key={interval}
                  accessibilityRole="button"
                  accessibilityLabel={interval === 0 ? "Sin pitidos intermedios" : `Pitido cada ${presetLabel(interval)}`}
                  className={`rounded-full px-3 py-2 ${selected ? "bg-[#c6f135]" : "bg-[#e6e8e0] dark:bg-black/30"}`}
                  onPress={() => setBeepEvery(interval)}
                >
                  {interval === 0 ? <Text className={`text-sm font-semibold ${selected ? "text-[#142000]" : "text-[#161915] dark:text-white"}`}>Solo al final</Text> : chipText(interval, `text-sm font-semibold ${selected ? "text-[#142000]" : "text-[#161915] dark:text-white"}`)}
                </Pressable>
              );
            })}
          </View>
          <Text className="mt-4 text-sm text-[#5c655b] dark:text-[#c9d2c8]">Pitidos al terminar</Text>
          <View className="mt-2 flex-row gap-2">
            {[1, 2, 3].map((count) => {
              const selected = endBeeps === count;
              return (
                <Pressable
                  key={count}
                  accessibilityRole="button"
                  accessibilityLabel={count === 1 ? "1 pitido al terminar" : `${count} pitidos al terminar`}
                  className={`rounded-full px-4 py-2 ${selected ? "bg-[#c6f135]" : "bg-[#e6e8e0] dark:bg-black/30"}`}
                  onPress={() => setEndBeeps(count)}
                >
                  <Text className={`text-sm font-semibold ${selected ? "text-[#142000]" : "text-[#161915] dark:text-white"}`}>{count}</Text>
                </Pressable>
              );
            })}
          </View>
          <View className="mt-4 flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={running ? "Pausar cronómetro" : "Iniciar cronómetro"}
              className="flex-1 items-center rounded-full bg-[#c6f135] py-3"
              onPress={() => void (running ? setRunning(false) : begin())}
            >
              <Text className="font-semibold text-[#142000]">{running ? "Pausar" : "Iniciar"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Reiniciar cronómetro" className="items-center rounded-full border border-[#d7dacf] dark:border-white/20 px-4 py-3" onPress={reset}>
              <Text className="font-semibold text-[#161915] dark:text-white">Reiniciar</Text>
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Probar pitido" className="mt-2 items-center py-2" onPress={() => void playBeeps(1, 466)}>
            <Text className="text-sm text-[#3d5c0a] dark:text-[#c6f135]">Probar pitido</Text>
          </Pressable>
          </ScrollView>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={running ? `Cronómetro ${clock(remaining)}` : "Abrir cronómetro"}
        className="absolute right-4 h-14 min-w-14 items-center justify-center rounded-full bg-[#c6f135] px-3"
        style={{ bottom }}
        onPress={() => setOpen((value) => !value)}
      >
        {running ? (
          <Text className="font-semibold text-[#142000]">{clock(remaining)}</Text>
        ) : (
          <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="13" r="7.5" stroke="#142000" strokeWidth={1.8} />
            <Path d="M12 13V9.5M12 6.5v-1M10 4h4M15.5 7.5l1-1" stroke="#142000" strokeWidth={1.8} strokeLinecap="round" />
          </Svg>
        )}
      </Pressable>
    </View>
  );
}
