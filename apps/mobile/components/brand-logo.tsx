import Svg, { Path, Text } from "react-native-svg";
import { useTheme } from "@/lib/theme";

export function BrandLogo({ width = 220 }: { width?: number }) {
  const { colors } = useTheme();
  const height = (width * 96) / 280;
  return (
    <Svg width={width} height={height} viewBox="0 0 280 96" accessibilityRole="image" accessibilityLabel="Energym">
      <Text
        x="0"
        y="54"
        fill={colors.logo}
        fontFamily="Arial"
        fontSize="48"
        fontWeight="800"
        textLength="100"
        lengthAdjust="spacingAndGlyphs"
      >
        ENE
      </Text>
      <Path fill="#2f7cff" d="M128 4h34L140 32h22L110 66l20-28h-22z" />
      <Text
        x="172"
        y="54"
        fill={colors.logo}
        fontFamily="Arial"
        fontSize="48"
        fontWeight="800"
        textLength="100"
        lengthAdjust="spacingAndGlyphs"
      >
        GYM
      </Text>
      <Text x="140" y="84" fill={colors.logoSub} fontFamily="Arial" fontSize="11" fontWeight="700" letterSpacing={3.2} textAnchor="middle">
        FITNESS CENTER
      </Text>
    </Svg>
  );
}
