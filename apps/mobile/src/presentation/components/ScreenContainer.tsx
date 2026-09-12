import React from "react";
import { View, StyleSheet, ViewStyle, SafeAreaView } from "react-native";
import { colors, spacing } from "../theme/index";

export interface ScreenContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const ScreenContainer = ({
  children,
  style,
}: ScreenContainerProps): React.ReactElement => {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.container, style]}>{children}</View>
    </SafeAreaView>
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
