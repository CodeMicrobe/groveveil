import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography, spacing, radii } from "../theme/index";

export interface OfflineBannerProps {
  isOffline: boolean;
}

export const OfflineBanner = ({
  isOffline,
}: OfflineBannerProps): React.ReactElement | null => {
  if (!isOffline) return null;

  return (
    <View
      style={styles.banner}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text}>
        📡 You are currently offline. Report drafts are safely preserved on device.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warningSurface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    marginVertical: spacing.sm,
    alignItems: "center",
  },
  text: {
    ...typography.caption,
    color: colors.warningText,
    fontWeight: "600",
  },
});
