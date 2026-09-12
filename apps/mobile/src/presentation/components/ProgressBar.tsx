import React from "react";
import { View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { colors } from "../theme/index";

interface ProgressBarProps {
  progress: number; // 0 to 1
  style?: StyleProp<ViewStyle>;
  fillColor?: string;
  backgroundColor?: string;
  height?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  style,
  fillColor = colors.primaryDark,
  backgroundColor = colors.surfaceMuted,
  height = 8,
}) => {
  const clampedProgress = Math.max(0, Math.min(1, progress));

  return (
    <View
      style={[
        styles.track,
        { backgroundColor, height, borderRadius: height / 2 },
        style,
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            backgroundColor: fillColor,
            width: `${clampedProgress * 100}%`,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: "100%",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
  },
});
