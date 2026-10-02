import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography, spacing, radii } from "../theme/index";
import { useConnectivity } from "../../domain/connectivity.service";

export interface OfflineBannerProps {
  isOffline?: boolean;
}

const OfflineBannerView: React.FC = () => (
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

const OfflineBannerConnected: React.FC = () => {
  const connectivity = useConnectivity();
  if (!connectivity.isOffline) return null;
  return <OfflineBannerView />;
};

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOffline: isOfflineProp,
}) => {
  // 1. Explicit prop override: bypass subscription when caller supplies explicit state
  if (isOfflineProp !== undefined) {
    if (!isOfflineProp) return null;
    return <OfflineBannerView />;
  }

  // 2. Dynamic mode: subscribe to native connectivity changes
  return <OfflineBannerConnected />;
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
