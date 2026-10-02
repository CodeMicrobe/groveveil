import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { colors, typography, spacing } from "../theme/index";
import type { ReportTreeParamList } from "./types";
import { StepDetails } from "../screens/ReportTree/StepDetails";
import { StepProof } from "../screens/ReportTree/StepProof";
import { StepReview } from "../screens/ReportTree/StepReview";
import { ReportSuccessModal } from "../screens/ReportTree/ReportSuccessModal";
import { OfflineBanner } from "../components/OfflineBanner";

const Stack = createNativeStackNavigator<ReportTreeParamList>();

interface ReportTreeStepLayoutProps {
  step: 1 | 2 | 3;
  children: React.ReactNode;
}

export const ReportTreeStepLayout: React.FC<ReportTreeStepLayoutProps> = ({
  step,
  children,
}) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const handleClose = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) {
      parent.goBack();
    } else {
      navigation.goBack();
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {/* Offline notification banner if applicable */}
      <OfflineBanner />

      {/* Modal Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.headerTitle}>Report a Tree</Text>
        <Pressable
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.pressed,
          ]}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close report tree wizard"
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
      </View>

      {/* Progress Stepper Indicator */}
      <View style={styles.stepperContainer}>
        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, step >= 1 && styles.stepCircleActive]}>
            <Text style={[styles.stepNumber, step >= 1 && styles.stepNumberActive]}>
              1
            </Text>
          </View>
          <Text style={[styles.stepLabel, step >= 1 && styles.stepLabelActive]}>
            Details
          </Text>
        </View>

        <View
          style={[styles.stepConnector, step >= 2 && styles.stepConnectorActive]}
        />

        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, step >= 2 && styles.stepCircleActive]}>
            <Text style={[styles.stepNumber, step >= 2 && styles.stepNumberActive]}>
              2
            </Text>
          </View>
          <Text style={[styles.stepLabel, step >= 2 && styles.stepLabelActive]}>
            Proof
          </Text>
        </View>

        <View
          style={[styles.stepConnector, step >= 3 && styles.stepConnectorActive]}
        />

        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, step >= 3 && styles.stepCircleActive]}>
            <Text style={[styles.stepNumber, step >= 3 && styles.stepNumberActive]}>
              3
            </Text>
          </View>
          <Text style={[styles.stepLabel, step >= 3 && styles.stepLabelActive]}>
            Review
          </Text>
        </View>
      </View>

      {/* Step Screen Content */}
      <View style={styles.stepContent}>{children}</View>
    </View>
  );
};

const StepDetailsScreen: React.FC = () => (
  <ReportTreeStepLayout step={1}>
    <StepDetails />
  </ReportTreeStepLayout>
);

const StepProofScreen: React.FC = () => (
  <ReportTreeStepLayout step={2}>
    <StepProof />
  </ReportTreeStepLayout>
);

const StepReviewScreen: React.FC = () => (
  <ReportTreeStepLayout step={3}>
    <StepReview />
  </ReportTreeStepLayout>
);

const ReportSuccessScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const handleDone = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) {
      parent.goBack();
    } else {
      navigation.goBack();
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      <ReportSuccessModal onClose={handleDone} />
    </View>
  );
};

export const ReportTreeNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="StepDetails" component={StepDetailsScreen} />
      <Stack.Screen name="StepProof" component={StepProofScreen} />
      <Stack.Screen name="StepReview" component={StepReviewScreen} />
      <Stack.Screen
        name="ReportSuccess"
        component={ReportSuccessScreen}
        options={{
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  container: {
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
  pressed: {
    opacity: 0.75,
  },
});
