import { Tabs } from "expo-router";
import { View } from "react-native";
import { AppearanceSwitch } from "@/components/appearance-switch";
import { BrandLogo } from "@/components/brand-logo";
import { TabIcon, type TabIconName } from "@/components/tab-icon";
import { useTheme } from "@/lib/theme";

function HeaderLogo() {
  return (
    <View style={{ paddingLeft: 8 }}>
      <BrandLogo width={112} />
    </View>
  );
}

function HeaderAppearance() {
  return (
    <View style={{ paddingRight: 8 }}>
      <AppearanceSwitch />
    </View>
  );
}

function icon(name: TabIconName) {
  return ({ color, size }: { color: string; size: number }) => <TabIcon name={name} color={color} size={size} />;
}

export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.ink,
        headerLeft: HeaderLogo,
        headerTitle: "",
        headerRight: HeaderAppearance,
        tabBarStyle: { backgroundColor: colors.canvas, borderTopColor: colors.line },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio", tabBarIcon: icon("home") }} />
      <Tabs.Screen name="workout" options={{ title: "Entreno", tabBarIcon: icon("workout") }} />
      <Tabs.Screen name="classes" options={{ title: "Clases", tabBarIcon: icon("classes") }} />
      <Tabs.Screen name="progress" options={{ title: "Progreso", tabBarIcon: icon("progress") }} />
      <Tabs.Screen name="membership" options={{ title: "Tu perfil", tabBarIcon: icon("profile") }} />
    </Tabs>
  );
}
