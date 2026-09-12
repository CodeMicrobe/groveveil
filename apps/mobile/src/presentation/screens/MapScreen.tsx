import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { typography, spacing } from "../theme/index";
import { ScreenContainer } from "../components/ScreenContainer";
import { Card } from "../components/Card";

export const MapScreen: React.FC = () => {
  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={typography.h2}>Explore Nearby</Text>
        <Text style={typography.body}>
          Discover verified trees planted by your community.
        </Text>
      </View>
      <Card variant="paper" style={styles.card}>
        <Text style={typography.bodyBold}>Privacy-Preserving Map Foundation</Text>
        <Text style={typography.caption}>
          Exact GPS coordinates are protected with ~150m spatial grid rounding.
        </Text>
      </Card>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingVertical: spacing.lg,
  },
  card: {
    marginTop: spacing.md,
  },
});
