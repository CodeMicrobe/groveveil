import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography, spacing } from "../theme/index";
import { ScreenContainer } from "../components/ScreenContainer";
import { Button } from "../components/Button";
import { useAuthStore } from "../../application/useAuthStore";
import { googleAuthService } from "../../domain/auth/google-auth.service";

export const WelcomeScreen: React.FC = () => {
  const { loginWithGoogleIdToken, isLoading, error, setError } = useAuthStore();

  const handleGoogleSignIn = async () => {
    try {
      console.log("[WelcomeScreen] 'Continue with Google' tapped");
      const result = await googleAuthService.signIn();
      console.log("[WelcomeScreen] Google sign-in completed:", {
        cancelled: result.cancelled,
        hasIdToken: Boolean(result.idToken),
      });

      if (result.cancelled) {
        // User dismissed the native account picker; cleanly return without error
        return;
      }

      if (result.idToken) {
        console.log("[WelcomeScreen] Forwarding ID token to backend...");
        await loginWithGoogleIdToken(result.idToken);
        console.log("[WelcomeScreen] Backend authentication successful!");
      }
    } catch (err: any) {
      console.error("[WelcomeScreen] Sign-In workflow caught error:", err);
      setError(err?.message || "Google Sign-In failed");
    }
  };

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.badgeText}>GROVEVEIL</Text>
        <Text style={typography.h1}>A Greener Tomorrow Together</Text>
        <Text style={[typography.body, styles.subtitle]}>
          Plant real trees, record verifiable proof, earn milestone achievements,
          and amplify community environmental impact.
        </Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.actions}>
          <Button
            title="Continue with Google"
            onPress={handleGoogleSignIn}
            loading={isLoading}
            size="large"
          />
        </View>

        <Text style={[typography.caption, styles.disclaimer]}>
          By continuing, you agree to Groveveil Terms of Service and Privacy Policy.
        </Text>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
  },
  content: {
    paddingVertical: spacing.xl,
  },
  badgeText: {
    ...typography.badge,
    color: colors.primary,
    marginBottom: spacing.sm,
    letterSpacing: 1.5,
  },
  subtitle: {
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
  actions: {
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  disclaimer: {
    textAlign: "center",
    color: colors.textMuted,
  },
});
