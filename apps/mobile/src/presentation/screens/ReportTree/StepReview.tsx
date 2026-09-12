import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { colors, typography, spacing, radii, shadows } from "../../theme/index";
import { useTreeDraftStore } from "../../../application/useTreeDraftStore";

export const StepReview: React.FC = () => {
  const {
    speciesName,
    scientificName,
    plantedAt,
    latitude,
    longitude,
    locationAccuracy,
    locationName,
    context,
    notes,
    photo,
    isSubmitting,
    submitError,
    submitReport,
    setStep,
  } = useTreeDraftStore();

  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!hasConfirmed) {
      setConfirmError("Please confirm that this report reflects genuine real-world planting activity.");
      return;
    }
    setConfirmError(null);
    await submitReport();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[typography.h2, styles.title]}>Step 3 — Review & Submit</Text>
      <Text style={[typography.body, styles.subtitle]}>
        Review your tree planting report details before authoritative submission.
      </Text>

      {submitError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{submitError}</Text>
        </View>
      )}

      {confirmError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{confirmError}</Text>
        </View>
      )}

      {/* Summary Card */}
      <View style={[styles.summaryCard, shadows.paper]}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.speciesTitle}>{speciesName}</Text>
            <Text style={styles.scientificSubtitle}>{scientificName}</Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>PENDING REVIEW</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Details list */}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Planting Date</Text>
          <Text style={styles.rowValue}>{plantedAt}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Display Location</Text>
          <Text style={styles.rowValue}>{locationName}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Authoritative GPS</Text>
          <Text style={styles.rowValue}>
            {latitude?.toFixed(6)}°, {longitude?.toFixed(6)}°
          </Text>
        </View>

        {locationAccuracy != null && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>GPS Accuracy</Text>
            <Text style={styles.rowValue}>± {locationAccuracy.toFixed(1)}m (DEVICE_GPS)</Text>
          </View>
        )}

        {context && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Context</Text>
            <Text style={styles.rowValue}>{context}</Text>
          </View>
        )}

        {notes ? (
          <View style={styles.notesBlock}>
            <Text style={styles.rowLabel}>Notes</Text>
            <Text style={styles.notesValue}>{notes}</Text>
          </View>
        ) : null}

        <View style={styles.divider} />

        {/* Photo preview */}
        <Text style={styles.rowLabel}>Photographic Proof</Text>
        {photo?.localUri ? (
          <Image source={{ uri: photo.localUri }} style={styles.photoThumbnail} />
        ) : (
          <Text style={styles.noPhotoText}>No photo attached</Text>
        )}
      </View>

      {/* Explicit Confirmation Checkbox */}
      <TouchableOpacity
        style={styles.confirmRow}
        onPress={() => setHasConfirmed(!hasConfirmed)}
      >
        <View style={[styles.checkbox, hasConfirmed && styles.checkboxChecked]}>
          {hasConfirmed && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.confirmText}>
          I confirm that this report documents a real-world sapling I personally planted with genuine GPS evidence.
        </Text>
      </TouchableOpacity>

      {/* Navigation Buttons */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setStep(2)}
          disabled={isSubmitting}
        >
          <Text style={styles.backButtonText}>← Edit Proof</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Tree Report ✓</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.hero,
  },
  title: {
    ...typography.h2,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  speciesTitle: {
    ...typography.h3,
    color: colors.primaryDark,
  },
  scientificSubtitle: {
    ...typography.caption,
    fontStyle: "italic",
    color: colors.textSecondary,
  },
  statusPill: {
    backgroundColor: colors.pendingSurface,
    borderWidth: 1,
    borderColor: colors.pendingBorder,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  statusPillText: {
    ...typography.badge,
    color: colors.pending,
    fontSize: 10,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  rowLabel: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textMuted,
  },
  rowValue: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  notesBlock: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  notesValue: {
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 2,
  },
  photoThumbnail: {
    width: "100%",
    height: 180,
    borderRadius: radii.md,
    marginTop: spacing.xs,
  },
  noPhotoText: {
    ...typography.caption,
    color: colors.rejected,
    marginTop: 2,
  },
  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: "700",
  },
  confirmText: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
  navRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  backButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  backButtonText: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
  submitButton: {
    flex: 2,
    backgroundColor: colors.primaryDark,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: colors.border,
  },
  submitButtonText: {
    ...typography.bodyBold,
    color: colors.textInverse,
  },
  errorBanner: {
    backgroundColor: colors.rejectedSurface,
    borderLeftWidth: 4,
    borderLeftColor: colors.rejected,
    padding: spacing.md,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    ...typography.body,
    color: colors.rejected,
    fontWeight: "600",
  },
});
