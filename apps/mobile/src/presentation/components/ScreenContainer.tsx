import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useSafeAreaInsets, type Edge } from "react-native-safe-area-context";
import { colors, spacing } from "../theme/index";

export interface ScreenContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: readonly Edge[];
}

export const ScreenContainer = ({
  children,
  style,
  edges = ["top", "left", "right"],
}: ScreenContainerProps): React.ReactElement => {
  const insets = useSafeAreaInsets();
  const edgeSet = new Set(edges);

  return (
    <View
      style={[
        styles.safe,
        {
          paddingTop: edgeSet.has("top") ? insets.top : 0,
          paddingBottom: edgeSet.has("bottom") ? insets.bottom : 0,
          paddingLeft: edgeSet.has("left") ? insets.left : 0,
          paddingRight: edgeSet.has("right") ? insets.right : 0,
        },
      ]}
    >
      <View style={[styles.container, style]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
});

