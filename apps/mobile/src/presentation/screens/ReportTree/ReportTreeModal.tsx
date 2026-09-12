import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, SafeAreaView } from "react-native";
import { colors, typography, spacing, radii } from "../../theme/index";
import { useTreeDraftStore } from "../../../application/useTreeDraftStore";
import { StepDetails } from "./StepDetails";
import { StepProof } from "./StepProof";
import { StepReview } from "./StepReview";
import { ReportSuccessModal } from "./ReportSuccessModal";
import { OfflineBanner } from "../../components/OfflineBanner";

interface ReportTreeModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ReportTreeModal: React.FC<ReportTreeModalProps> = ({ visible, onClose }) => {
  const { step } = useTreeDraftStore();
  const isOffline =
    typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
      ? !navigator.onLine
      : false;

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea}>
        {/* Offline notification banner if applicable */}
        <OfflineBanner isOffline={isOffline} />

        {/* Modal Top Bar */}
        <View style={styles.topBar}>
          <Text style={styles.headerTitle}>Report a Tree</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Stepper Indicator (for Steps 1, 2, 3) */}
        {step <= 3 && (
          <View style={styles.stepperContainer}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, step >= 1 && styles.stepCircleActive]}>
                <Text style={[styles.stepNumber, step >= 1 && styles.stepNumberActive]}>1</Text>
              </View>
              <Text style={[styles.stepLabel, step >= 1 && styles.stepLabelActive]}>Details</Text>
            </View>

            <View style={[styles.stepConnector, step >= 2 && styles.stepConnectorActive]} />

            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, step >= 2 && styles.stepCircleActive]}>
                <Text style={[styles.stepNumber, step >= 2 && styles.stepNumberActive]}>2</Text>
              </View>
              <Text style={[styles.stepLabel, step >= 2 && styles.stepLabelActive]}>Proof</Text>
            </View>

            <View style={[styles.stepConnector, step >= 3 && styles.stepConnectorActive]} />

            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, step >= 3 && styles.stepCircleActive]}>
                <Text style={[styles.stepNumber, step >= 3 && styles.stepNumberActive]}>3</Text>
              </View>
              <Text style={[styles.stepLabel, step >= 3 && styles.stepLabelActive]}>Review</Text>
            </View>
          </View>
        )}

        {/* Current Step Content */}
        <View style={styles.stepContent}>
          {step === 1 && <StepDetails />}
          {step === 2 && <StepProof />}
          {step === 3 && <StepReview />}
          {step === 4 && <ReportSuccessModal onClose={onClose} />}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.primaryDark,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingHorizontal: spacing.xl,
  },
  stepItem: {
    alignItems: "center",
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stepCircleActive: {
    backgroundColor: colors.primaryDark,
  },
  stepNumber: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textMuted,
  },
  stepNumberActive: {
    color: colors.textInverse,
  },
  stepLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "600",
  },
  stepLabelActive: {
    color: colors.primaryDark,
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.borderLight,
    marginHorizontal: spacing.sm,
    marginTop: -14,
  },
  stepConnectorActive: {
    backgroundColor: colors.primaryDark,
  },
  stepContent: {
    flex: 1,
  },
});
