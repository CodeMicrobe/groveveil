import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from "react-native";
import { colors, typography, radii, spacing } from "../theme/index";

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button = ({
  title,
  onPress,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}: ButtonProps): React.ReactElement => {
  const getContainerStyle = (): ViewStyle => {
    let base: ViewStyle = styles.base;
    if (size === "small") base = { ...base, paddingVertical: spacing.xs, paddingHorizontal: spacing.md };
    if (size === "large") base = { ...base, paddingVertical: spacing.lg, paddingHorizontal: spacing.xl };

    switch (variant) {
      case "primary":
        return { ...base, backgroundColor: disabled ? colors.border : colors.primaryDark };
      case "secondary":
        return { ...base, backgroundColor: colors.surfaceTint };
      case "outline":
        return { ...base, backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.primary };
      case "ghost":
        return { ...base, backgroundColor: "transparent" };
      default:
        return base;
    }
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case "primary":
        return { ...typography.bodyBold, color: disabled ? colors.textMuted : colors.textInverse };
      case "secondary":
        return { ...typography.bodyBold, color: colors.primaryDark };
      case "outline":
        return { ...typography.bodyBold, color: colors.primary };
      case "ghost":
        return { ...typography.bodyBold, color: colors.primaryDark };
      default:
        return typography.bodyBold;
    }
  };

  return (
    <TouchableOpacity
      style={[getContainerStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      accessibilityLabel={title}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? colors.textInverse : colors.primary}
        />
      ) : (
        <>
          {icon}
          <Text style={[getTextStyle(), icon ? { marginLeft: spacing.sm } : undefined, textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
  },
});
