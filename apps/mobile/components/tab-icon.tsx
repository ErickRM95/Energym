import Svg, { Circle, Path, Rect } from "react-native-svg";

export type TabIconName = "home" | "workout" | "classes" | "progress" | "profile";

export function TabIcon({ name, color, size }: { name: TabIconName; color: string; size: number }) {
  const shared = { width: size, height: size, viewBox: "0 0 24 24", fill: "none" as const };
  if (name === "home") {
    return (
      <Svg {...shared}>
        <Path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      </Svg>
    );
  }
  if (name === "workout") {
    return (
      <Svg {...shared}>
        <Path d="M6 9v6M18 9v6M3 10v4M21 10v4M6 12h12" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    );
  }
  if (name === "classes") {
    return (
      <Svg {...shared}>
        <Rect x="4" y="5" width="16" height="15" rx="2" stroke={color} strokeWidth={1.8} />
        <Path d="M8 3.5V7M16 3.5V7M4 10h16" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    );
  }
  if (name === "progress") {
    return (
      <Svg {...shared}>
        <Path d="M5 19V11M12 19V7M19 19v-5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    );
  }
  return (
    <Svg {...shared}>
      <Circle cx="12" cy="8" r="3" stroke={color} strokeWidth={1.8} />
      <Path d="M6 19.5c1.2-3 3.4-4.5 6-4.5s4.8 1.5 6 4.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
