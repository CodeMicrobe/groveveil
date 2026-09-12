import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, typography, spacing, radii, shadows } from "../../theme/index";
import { useTreeDraftStore } from "../../../application/useTreeDraftStore";

interface ReportSuccessModalProps {
  onClose: () => void;
}

export const ReportSuccessModal: React.FC<ReportSuccessModalProps> = ({ onClose }) => {
  const { submittedTree, speciesName, locationName, resetDraft } = useTreeDraftStore();

  const handleDone = () => {
    resetDraft();
    onClose();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.card, shadows.card]}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>🌱</Text>
        </View>

        <Text style={[typography.h2, styles.title]}>Report Submitted!</Text>

        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>PENDING VERIFICATION</Text>
        </View>

        <Text style={[typography.body, styles.message]}>
          Your tree report was submitted and is pending verification.
        </Text>

        <View style={styles.detailsCard}>
          <Text style={styles.speciesName}>{speciesName || submittedTree?.species?.commonName}</Text>
          <Text style={styles.locationText}>📍 {locationName || submittedTree?.locationName}</Text>
        </View>

        <Text style={styles.disclaimer}>
          Our team and community reviewers will inspect the photographic proof and GPS coordinates.
          Achievements and public impact metrics are awarded only once your tree is officially verified.
        </Text>

        <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneButtonText}>Return to Journal</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  iconText: {
    fontSize: 36,
  },
  title: {
    ...typography.h2,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  statusPill: {
    backgroundColor: colors.pendingSurface,
    borderWidth: 1,
    borderColor: colors.pendingBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.full,
    marginBottom: spacing.md,
  },
  statusPillText: {
    ...typography.badge,
    color: colors.pending,
    fontSize: 11,
  },
  message: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  detailsCard: {
    width: "100%",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  speciesName: {
    ...typography.h3,
    color: colors.primaryDark,
  },
  locationText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  disclaimer: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: spacing.xl,
  },
  doneButton: {
    width: "100%",
    backgroundColor: colors.primaryDark,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  doneButtonText: {
    ...typography.bodyBold,
    color: colors.textInverse,
  },
});
