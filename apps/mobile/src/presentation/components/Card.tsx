import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { colors, radii, shadows, spacing } from "../theme/index";

export interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: "surface" | "tint" | "paper";
}

export const Card = ({
  children,
  style,
  variant = "surface",
}: CardProps): React.ReactElement => {
  const getBackgroundColor = () => {
    switch (variant) {
      case "tint":
        return colors.surfaceTint;
      case "paper":
        return colors.surfaceMuted;
      default:
        return colors.surface;
    }
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: getBackgroundColor() },
        shadows.paper,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
});
