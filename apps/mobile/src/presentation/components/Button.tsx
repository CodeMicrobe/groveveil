import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from "react-native";
import { colors, typography, radii, spacing } from "../theme/index";

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
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
  const isInteractive = !disabled && !loading;

  const sizeStyle = sizeStyles[size] || sizeStyles.medium;
  const variantStyle =
    disabled && variant === "primary"
      ? styles.variantPrimaryDisabled
      : variantStyles[variant] || variantStyles.primary;

  const textVariantStyle =
    disabled && variant === "primary"
      ? styles.textPrimaryDisabled
      : textStyles[variant] || textStyles.primary;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        sizeStyle,
        variantStyle,
        pressed && isInteractive && styles.pressed,
        style,
      ]}
      onPress={onPress}
      disabled={!isInteractive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
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
          <Text
            style={[
              textVariantStyle,
              icon ? styles.iconSpacing : undefined,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
};

const sizeStyles = StyleSheet.create({
  small: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  medium: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  large: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.primaryDark,
  },
  secondary: {
    backgroundColor: colors.surfaceTint,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: "transparent",
  },
});

const textStyles = StyleSheet.create({
  primary: {
    ...typography.bodyBold,
    color: colors.textInverse,
  },
  secondary: {
    ...typography.bodyBold,
    color: colors.primaryDark,
  },
  outline: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  ghost: {
    ...typography.bodyBold,
    color: colors.primaryDark,
  },
});

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
  },
  variantPrimaryDisabled: {
    backgroundColor: colors.border,
  },
  textPrimaryDisabled: {
    ...typography.bodyBold,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.75,
  },
  iconSpacing: {
    marginLeft: spacing.sm,
  },
});
