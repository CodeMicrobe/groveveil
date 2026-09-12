import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { colors, typography, radii, spacing } from "../theme/index";

export interface BadgeProps {
  label: string;
  variant?: "verified" | "pending" | "rejected" | "milestone" | "neutral";
  style?: ViewStyle;
}

export const Badge = ({
  label,
  variant = "neutral",
  style,
}: BadgeProps): React.ReactElement => {
  const getStyles = () => {
    switch (variant) {
      case "verified":
        return {
          bg: colors.verifiedSurface,
          text: colors.verified,
          border: colors.verifiedBorder,
        };
      case "pending":
        return {
          bg: colors.pendingSurface,
          text: colors.pending,
          border: colors.pendingBorder,
        };
      case "rejected":
        return {
          bg: colors.rejectedSurface,
          text: colors.rejected,
          border: colors.rejectedBorder,
        };
      case "milestone":
        return {
          bg: colors.badgeBg,
          text: colors.goldBadgeDark,
          border: colors.goldBadge,
        };
      default:
        return {
          bg: colors.surfaceMuted,
          text: colors.textSecondary,
          border: colors.border,
        };
    }
  };

  const current = getStyles();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: current.bg, borderColor: current.border },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${variant} badge: ${label}`}
    >
      <Text style={[typography.badge, { color: current.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
});
