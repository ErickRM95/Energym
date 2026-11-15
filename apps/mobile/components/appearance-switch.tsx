import { Pressable, Text, View } from "react-native";
import { useTheme, type ThemeName } from "@/lib/theme";

const options: { id: ThemeName; label: string }[] = [
  { id: "light", label: "Claro" },
  { id: "dark", label: "Oscuro" },
];

export function AppearanceSwitch() {
  const { scheme, choose } = useTheme();
  return (
    <View className="flex-row rounded-full bg-[#e6e8e0] p-1 dark:bg-[#243024]" accessibilityRole="radiogroup" accessibilityLabel="Apariencia">
      {options.map((option) => {
        const selected = scheme === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            className={`rounded-full px-3 py-1.5 ${selected ? "bg-[#c6f135]" : ""}`}
            onPress={() => choose(option.id)}
          >
            <Text className={`text-xs ${selected ? "font-semibold text-[#142000]" : "text-[#161915] dark:text-white"}`}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
