import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert, TextInput } from "react-native";
import { colors, typography, spacing, radii } from "../theme/index";
import { ScreenContainer } from "../components/ScreenContainer";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { useAuthStore } from "../../application/useAuthStore";
import { gpgMobileService, GpgStatusResponse } from "../../domain/gpg.service";

export const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuthStore();
  const [gpgStatus, setGpgStatus] = useState<GpgStatusResponse | null>(null);
  const [isLoadingGpg, setIsLoadingGpg] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showAuthCodeInput, setShowAuthCodeInput] = useState(false);
  const [authCodeInput, setAuthCodeInput] = useState("");
  const [gpgMessage, setGpgMessage] = useState<string | null>(null);

  useEffect(() => {
    loadGpgStatus();
  }, []);

  const loadGpgStatus = async () => {
    setIsLoadingGpg(true);
    try {
      const status = await gpgMobileService.getStatus();
      setGpgStatus(status);
    } catch {
      // Offline or network error; keep status null
    } finally {
      setIsLoadingGpg(false);
    }
  };

  const handleLinkGpg = async (codeToUse?: string) => {
    const code = codeToUse || authCodeInput;
    if (!code.trim()) {
      setShowAuthCodeInput(true);
      return;
    }

    setIsActionLoading(true);
    setGpgMessage(null);
    try {
      const res = await gpgMobileService.linkWithServerAuthCode(code.trim());
      setGpgMessage(`Successfully linked as ${res.displayName}! (${res.reconciledCount} achievements synced)`);
      setShowAuthCodeInput(false);
      setAuthCodeInput("");
      await loadGpgStatus();
    } catch (err: any) {
      setGpgMessage(err.message || "Failed to link Google Play Games account.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUnlinkGpg = async () => {
    setIsActionLoading(true);
    setGpgMessage(null);
    try {
      await gpgMobileService.unlink();
      setGpgMessage("Google Play Games unlinked successfully.");
      await loadGpgStatus();
    } catch (err: any) {
      setGpgMessage(err.message || "Failed to unlink account.");
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={typography.h2}>{user?.displayName || "Planter Profile"}</Text>
        <Text style={typography.caption}>@{user?.publicHandle || "planter"}</Text>
      </View>

      <Card style={styles.card}>
        <Text style={typography.bodyBold}>Account Details</Text>
        <Text style={typography.body}>{user?.email}</Text>
      </Card>

      {/* Google Play Games Services Integration */}
      <Card style={styles.card}>
        <View style={styles.gpgHeader}>
          <View>
            <Text style={typography.bodyBold}>Google Play Games</Text>
            <Text style={typography.caption}>Android Cloud Achievement Sync</Text>
          </View>
          {isLoadingGpg ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Badge
              label={gpgStatus?.linked ? "Linked" : "Not Linked"}
              variant={gpgStatus?.linked ? "verified" : "neutral"}
            />
          )}
        </View>

        {gpgStatus?.linked ? (
          <View style={styles.gpgBody}>
            <Text style={styles.gpgInfo}>
              Player: <Text style={styles.boldText}>{gpgStatus.displayName || "Connected"}</Text>
            </Text>
            <Text style={styles.gpgSubtext}>
              Your verified Groveveil milestones automatically synchronize with your Google Play Games profile.
            </Text>
            <Button
              title="Unlink Google Play Games"
              variant="outline"
              size="small"
              loading={isActionLoading}
              onPress={handleUnlinkGpg}
              style={styles.actionBtn}
            />
          </View>
        ) : (
          <View style={styles.gpgBody}>
            <Text style={styles.gpgSubtext}>
              Link your Google Play Games account to sync unlocked milestones and badges to your Android profile.
            </Text>
            {showAuthCodeInput ? (
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter Server Auth Code"
                  placeholderTextColor={colors.textMuted}
                  value={authCodeInput}
                  onChangeText={setAuthCodeInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={styles.inlineActions}>
                  <Button
                    title="Submit Code"
                    size="small"
                    loading={isActionLoading}
                    onPress={() => handleLinkGpg()}
                    style={styles.inlineBtn}
                  />
                  <Button
                    title="Cancel"
                    variant="ghost"
                    size="small"
                    onPress={() => setShowAuthCodeInput(false)}
                    style={styles.inlineBtn}
                  />
                </View>
              </View>
            ) : (
              <Button
                title="Connect Google Play Games"
                variant="secondary"
                size="small"
                loading={isActionLoading}
                onPress={() => setShowAuthCodeInput(true)}
                style={styles.actionBtn}
              />
            )}
          </View>
        )}

        {gpgMessage ? (
          <Text style={[styles.feedbackText, gpgMessage.includes("Successfully") ? styles.successText : styles.errorText]}>
            {gpgMessage}
          </Text>
        ) : null}
      </Card>

      <View style={styles.actions}>
        <Button title="Logout" variant="outline" onPress={logout} />
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingVertical: spacing.lg,
  },
  card: {
    marginVertical: spacing.sm,
  },
  gpgHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  gpgBody: {
    marginTop: spacing.sm,
  },
  gpgInfo: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  boldText: {
    fontWeight: "600",
    color: colors.primaryDark,
  },
  gpgSubtext: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  actionBtn: {
    alignSelf: "flex-start",
  },
  inputContainer: {
    marginTop: spacing.xs,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.sm,
  },
  inlineActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  inlineBtn: {
    minWidth: 100,
  },
  feedbackText: {
    marginTop: spacing.sm,
    fontSize: 12,
    fontWeight: "500",
  },
  successText: {
    color: colors.primary,
  },
  errorText: {
    color: colors.danger,
  },
  actions: {
    marginTop: spacing.xl,
  },
});
