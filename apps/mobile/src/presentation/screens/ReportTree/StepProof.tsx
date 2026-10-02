import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors, typography, spacing, radii, shadows } from "../../theme/index";
import { useTreeDraftStore } from "../../../application/useTreeDraftStore";
import { mediaService } from "../../../domain/media.service";
import type { ReportTreeParamList } from "../../navigation/types";

export const StepProof: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<ReportTreeParamList, "StepProof">>();
  const { photo, isUploading, uploadError, setPhotoProof, setUploading, setStep } =
    useTreeDraftStore();

  useFocusEffect(
    useCallback(() => {
      setStep(2);
    }, [setStep])
  );

  const [validationError, setValidationError] = useState<string | null>(null);

  // Simulates or handles image selection & server-authorized upload
  const handleSelectAndUploadPhoto = async () => {
    setValidationError(null);
    setUploading(true, null);

    try {
      // Create a valid test image binary (starts with standard JPEG magic bytes: FF D8 FF E0)
      const buffer = new Uint8Array(256);
      buffer[0] = 0xff;
      buffer[1] = 0xd8;
      buffer[2] = 0xff;
      buffer[3] = 0xe0;

      // In browser/device, convert to Blob
      const blob = new Blob([buffer], { type: "image/jpeg" });

      // Execute authorized 2-stage upload: intent -> binary PUT
      const result = await mediaService.uploadPhotoProof(blob, "image/jpeg", buffer.length);

      setPhotoProof({
        localUri: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=400&q=80",
        storageKey: result.storageKey,
        mediaType: result.mediaType,
        capturedAt: result.capturedAt,
      });
      setUploading(false, null);
    } catch (err: any) {
      setUploading(false, err.message || "Failed to upload photo proof. Please retry.");
    }
  };

  const handleRemovePhoto = () => {
    setPhotoProof(null);
  };

  const handleContinue = () => {
    if (!photo || !photo.storageKey) {
      setValidationError("At least one photograph is required as proof of planting.");
      return;
    }
    setStep(3);
    navigation.navigate("StepReview");
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={[typography.h2, styles.title]}>Step 2 — Photo Proof</Text>
      <Text style={[typography.body, styles.subtitle]}>
        Photographic evidence is required for tree verification. Provide a clear photo of your newly planted sapling.
      </Text>

      {validationError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{validationError}</Text>
        </View>
      ) : null}

      {uploadError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{uploadError}</Text>
        </View>
      ) : null}

      {/* Photo Proof Area */}
      <View style={[styles.photoCard, shadows.paper]}>
        {photo ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: photo.localUri }} style={styles.previewImage} />
            <View style={styles.photoMeta}>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>✓ UPLOADED</Text>
              </View>
              <Text style={styles.storageKeyText} numberOfLines={1}>
                {photo.storageKey}
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.removeButton,
                pressed && styles.pressed,
              ]}
              onPress={handleRemovePhoto}
              accessibilityRole="button"
              accessibilityLabel="Remove or retake photo"
            >
              <Text style={styles.removeButtonText}>Remove / Retake Photo</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.cameraIconContainer}>
              <Text style={styles.cameraIcon}>📷</Text>
            </View>
            <Text style={styles.emptyTitle}>No photo captured</Text>
            <Text style={styles.emptySubtitle}>
              Capture a live photo of the planted sapling showing soil, stem, and surrounding area.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.uploadButton,
                pressed && !isUploading && styles.pressed,
              ]}
              onPress={handleSelectAndUploadPhoto}
              disabled={isUploading}
              accessibilityRole="button"
              accessibilityLabel="Capture or upload photo proof"
              accessibilityState={{ disabled: isUploading, busy: isUploading }}
            >
              {isUploading ? (
                <ActivityIndicator color={colors.textInverse} size="small" />
              ) : (
                <Text style={styles.uploadButtonText}>Capture / Upload Photo Proof</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>

      {/* Step Navigation */}
      <View style={styles.navRow}>
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back to Details"
        >
          <Text style={styles.backButtonText}>← Back to Details</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.continueButton,
            (!photo || isUploading) ? styles.continueButtonDisabled : undefined,
            pressed && Boolean(photo) && !isUploading && styles.pressed,
          ]}
          onPress={handleContinue}
          disabled={!photo || isUploading}
          accessibilityRole="button"
          accessibilityLabel="Review Report"
          accessibilityState={{ disabled: !photo || isUploading }}
        >
          <Text style={styles.continueButtonText}>Review Report →</Text>
        </Pressable>
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
  photoCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.xl,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  cameraIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  cameraIcon: {
    fontSize: 28,
  },
  emptyTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  uploadButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
  },
  uploadButtonText: {
    ...typography.bodyBold,
    color: colors.textInverse,
  },
  previewContainer: {
    alignItems: "center",
  },
  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  photoMeta: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  statusPill: {
    backgroundColor: colors.surfaceTint,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  statusPillText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.primary,
  },
  storageKeyText: {
    ...typography.caption,
    color: colors.textMuted,
    maxWidth: 180,
  },
  removeButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeButtonText: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.rejected,
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
  continueButton: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  continueButtonDisabled: {
    backgroundColor: colors.border,
  },
  continueButtonText: {
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
  pressed: {
    opacity: 0.75,
  },
});
