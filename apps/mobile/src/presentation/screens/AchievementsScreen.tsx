import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { colors, typography, spacing, radii, shadows } from "../theme/index";
import { ScreenContainer } from "../components/ScreenContainer";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { ProgressBar } from "../components/ProgressBar";
import { useAchievementsStore } from "../../application/useAchievementsStore";

export const AchievementsScreen: React.FC = () => {
  const {
    currentVerifiedTreeCount,
    distinctSpeciesCount,
    nextMilestone,
    achievements,
    isLoading,
    error,
    fetchAchievements,
  } = useAchievementsStore();

  const [activeTab, setActiveTab] = useState<"ALL" | "UNLOCKED" | "IN_PROGRESS">("ALL");

  useEffect(() => {
    fetchAchievements();
  }, []);

  const unlockedList = achievements.filter((a) => a.status === "UNLOCKED");
  const inProgressList = achievements.filter((a) => a.status !== "UNLOCKED");

  const displayedList =
    activeTab === "ALL"
      ? achievements
      : activeTab === "UNLOCKED"
      ? unlockedList
      : inProgressList;

  return (
    <ScreenContainer>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchAchievements}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={typography.h2}>Milestones & Impact</Text>
          <Text style={typography.body}>
            Verified real-world environmental actions earn authoritative milestones.
          </Text>
        </View>

        {/* Hero Next Milestone Card */}
        {nextMilestone ? (
          <Card style={[styles.heroCard, shadows.card]}>
            <View style={styles.heroRow}>
              <Badge label="NEXT MILESTONE" variant="milestone" />
              <Text style={styles.heroTarget}>
                {nextMilestone.currentProgress} / {nextMilestone.targetValue}
              </Text>
            </View>
            <Text style={[typography.h3, styles.heroTitle]}>{nextMilestone.name}</Text>
            <Text style={typography.caption}>{nextMilestone.description}</Text>

            <View style={styles.progressSection}>
              <ProgressBar
                progress={nextMilestone.currentProgress / nextMilestone.targetValue}
                height={10}
                fillColor={colors.primary}
              />
              <Text style={styles.remainingText}>
                🌱 {nextMilestone.remainingTrees} more verified tree
                {nextMilestone.remainingTrees > 1 ? "s" : ""} to unlock
              </Text>
            </View>
          </Card>
        ) : currentVerifiedTreeCount > 0 ? (
          <Card style={[styles.heroCard, shadows.card]}>
            <Badge label="ALL MILESTONES COMPLETE" variant="verified" />
            <Text style={[typography.h3, styles.heroTitle]}>Forest Guardian</Text>
            <Text style={typography.body}>
              You have completed all current planting milestones with{" "}
              {currentVerifiedTreeCount} verified trees across {distinctSpeciesCount} species!
            </Text>
          </Card>
        ) : null}

        {/* Filter Pills */}
        <View style={styles.filterBar}>
          <Pressable
            style={({ pressed }) => [
              styles.filterPill,
              activeTab === "ALL" ? styles.filterPillActive : undefined,
              pressed && styles.pressed,
            ]}
            onPress={() => setActiveTab("ALL")}
            accessibilityRole="button"
            accessibilityState={{ selected: activeTab === "ALL" }}
            accessibilityLabel={`All ${achievements.length}`}
          >
            <Text
              style={[
                styles.filterPillText,
                activeTab === "ALL" ? styles.filterPillTextActive : undefined,
              ]}
            >
              All ({achievements.length})
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.filterPill,
              activeTab === "UNLOCKED" ? styles.filterPillActive : undefined,
              pressed && styles.pressed,
            ]}
            onPress={() => setActiveTab("UNLOCKED")}
            accessibilityRole="button"
            accessibilityState={{ selected: activeTab === "UNLOCKED" }}
            accessibilityLabel={`Unlocked ${unlockedList.length}`}
          >
            <Text
              style={[
                styles.filterPillText,
                activeTab === "UNLOCKED" ? styles.filterPillTextActive : undefined,
              ]}
            >
              Unlocked ({unlockedList.length})
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.filterPill,
              activeTab === "IN_PROGRESS" ? styles.filterPillActive : undefined,
              pressed && styles.pressed,
            ]}
            onPress={() => setActiveTab("IN_PROGRESS")}
            accessibilityRole="button"
            accessibilityState={{ selected: activeTab === "IN_PROGRESS" }}
            accessibilityLabel={`In Progress ${inProgressList.length}`}
          >
            <Text
              style={[
                styles.filterPillText,
                activeTab === "IN_PROGRESS" ? styles.filterPillTextActive : undefined,
              ]}
            >
              In Progress ({inProgressList.length})
            </Text>
          </Pressable>
        </View>

        {/* Loading Spinner */}
        {isLoading && achievements.length === 0 ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[typography.caption, styles.loadingText]}>
              Loading milestones...
            </Text>
          </View>
        ) : null}

        {Boolean(error) && achievements.length === 0 ? (
          <Card style={styles.errorCard}>
            <Text style={[typography.bodyBold, { color: colors.danger }]}>
              {error}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.retryBtn,
                pressed && styles.pressed,
              ]}
              onPress={fetchAchievements}
              accessibilityRole="button"
              accessibilityLabel="Retry loading milestones"
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </Card>
        ) : null}

        {/* Milestone Cards List */}
        {displayedList.map((item) => {
          const isUnlocked = item.status === "UNLOCKED";
          const ratio = Math.min(1, item.progress / item.targetValue);

          return (
            <Card
              key={item.id}
              style={[
                styles.milestoneCard,
                isUnlocked ? styles.unlockedCardBorder : undefined,
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.titleRow}>
                  <Text style={typography.bodyBold}>{item.name}</Text>
                  {isUnlocked ? (
                    <Badge label="UNLOCKED" variant="verified" />
                  ) : (
                    <Badge
                      label={`${item.progress} / ${item.targetValue}`}
                      variant="milestone"
                    />
                  )}
                </View>
                <Text style={[typography.caption, styles.descText]}>
                  {item.description}
                </Text>
              </View>

              {isUnlocked ? (
                <View style={styles.unlockedFooter}>
                  <Text style={styles.unlockedDate}>
                    🏆 Unlocked{" "}
                    {item.unlockedAt
                      ? new Date(item.unlockedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Verified"}
                  </Text>
                  {item.gpgSynced ? (
                    <Badge label="PLAY GAMES" variant="milestone" style={styles.gpgBadge} />
                  ) : null}
                </View>
              ) : (
                <View style={styles.progressContainer}>
                  <ProgressBar progress={ratio} height={6} />
                  <Text style={styles.progressDetail}>
                    {item.targetValue - item.progress} more needed
                  </Text>
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingVertical: spacing.md,
  },
  heroCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  heroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroTarget: {
    ...typography.bodyBold,
    color: colors.primaryDark,
  },
  heroTitle: {
    marginTop: spacing.xs,
    color: colors.primaryDark,
  },
  progressSection: {
    marginTop: spacing.md,
  },
  remainingText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: "600",
    marginTop: spacing.xs,
  },
  filterBar: {
    flexDirection: "row",
    gap: spacing.xs,
    marginVertical: spacing.sm,
  },
  filterPill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
  },
  filterPillActive: {
    backgroundColor: colors.primaryDark,
  },
  filterPillText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  filterPillTextActive: {
    color: colors.textInverse,
  },
  loadingArea: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  loadingText: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
  },
  errorCard: {
    borderColor: colors.danger,
    marginVertical: spacing.md,
    alignItems: "center",
  },
  retryBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primaryDark,
    borderRadius: radii.sm,
  },
  retryText: {
    color: colors.textInverse,
    fontWeight: "600",
  },
  milestoneCard: {
    marginBottom: spacing.sm,
  },
  unlockedCardBorder: {
    borderLeftWidth: 4,
    borderLeftColor: colors.goldBadge,
  },
  cardHeader: {
    marginBottom: spacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  descText: {
    marginTop: 2,
  },
  unlockedFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
  },
  unlockedDate: {
    ...typography.caption,
    color: colors.goldBadge,
    fontWeight: "700",
  },
  gpgBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  progressContainer: {
    marginTop: spacing.xs,
  },
  progressDetail: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: "right",
  },
  pressed: {
    opacity: 0.75,
  },
});
