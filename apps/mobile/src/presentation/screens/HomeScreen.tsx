import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { colors, typography, spacing, radii } from "../theme/index";
import { ScreenContainer } from "../components/ScreenContainer";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { ProgressBar } from "../components/ProgressBar";
import { useAuthStore } from "../../application/useAuthStore";
import { useAchievementsStore } from "../../application/useAchievementsStore";
import { apiClient } from "../../data/api/api-client";

interface TreeJournalItem {
  id: string;
  plantedAt: string;
  locationName: string;
  latitude: number;
  longitude: number;
  status: string;
  verificationStatus: "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";
  species: {
    id: string;
    commonName: string;
    scientificName: string;
  };
  media: Array<{
    id: string;
    storageKey: string;
    mediaType: string;
  }>;
}

export const HomeScreen: React.FC = () => {
  const { user } = useAuthStore();
  const { nextMilestone, fetchAchievements } = useAchievementsStore();
  const [trees, setTrees] = useState<TreeJournalItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTrees = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get<TreeJournalItem[]>("/trees/me");
      setTrees(data);
    } catch {
      // Gracefully handled
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrees();
    fetchAchievements();
  }, []);

  const renderBadgeVariant = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return "verified";
      case "PENDING_VERIFICATION":
        return "pending";
      default:
        return "rejected";
    }
  };

  const renderBadgeLabel = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return "VERIFIED";
      case "PENDING_VERIFICATION":
        return "PENDING";
      default:
        return "REJECTED";
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={typography.caption}>WELCOME BACK</Text>
        <Text style={typography.h2}>{user?.displayName || "Tree Champion"}</Text>
      </View>

      <Card variant="tint" style={styles.summaryCard}>
        <Text style={typography.caption}>VERIFIED IMPACT</Text>
        <Text style={typography.h1}>{user?.stats?.verifiedTreesCount || 0} Trees</Text>
        <Text style={typography.body}>
          Real-world planting activity verified on-chain and in-person.
        </Text>
      </Card>

      {/* Next Milestone Banner */}
      {nextMilestone ? (
        <Card style={styles.milestoneBanner}>
          <View style={styles.milestoneRow}>
            <Text style={styles.milestoneTag}>🏆 NEXT MILESTONE</Text>
            <Text style={styles.milestoneFraction}>
              {nextMilestone.currentProgress} / {nextMilestone.targetValue}
            </Text>
          </View>
          <Text style={typography.bodyBold}>{nextMilestone.name}</Text>
          <View style={{ marginTop: spacing.xs }}>
            <ProgressBar
              progress={nextMilestone.currentProgress / nextMilestone.targetValue}
              height={6}
            />
          </View>
        </Card>
      ) : null}

      {/* My Trees Section Header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={typography.h3}>My Tree Journal</Text>
        <Text style={typography.caption}>{trees.length} Reported</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginVertical: spacing.lg }} color={colors.primary} />
      ) : trees.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🌱</Text>
          <Text style={typography.bodyBold}>No Trees Reported Yet</Text>
          <Text style={[typography.caption, styles.emptyText]}>
            Tap the + button below to report your first real-world planted tree with photo proof and GPS.
          </Text>
        </Card>
      ) : (
        <View style={styles.treeList}>
          {trees.map((item) => (
            <Card key={item.id} style={styles.treeCard}>
              <View style={styles.treeHeaderRow}>
                <View>
                  <Text style={typography.bodyBold}>{item.species.commonName}</Text>
                  <Text style={styles.scientificName}>{item.species.scientificName}</Text>
                </View>
                <Badge
                  label={renderBadgeLabel(item.verificationStatus)}
                  variant={renderBadgeVariant(item.verificationStatus)}
                />
              </View>

              <Text style={styles.locationText}>📍 {item.locationName}</Text>
              <Text style={styles.dateText}>
                Planted: {new Date(item.plantedAt).toLocaleDateString()}
              </Text>
            </Card>
          ))}
        </View>
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingVertical: spacing.lg,
  },
  summaryCard: {
    marginVertical: spacing.md,
  },
  milestoneBanner: {
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryDark,
  },
  milestoneRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  milestoneTag: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  milestoneFraction: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  emptyText: {
    textAlign: "center",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  treeList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  treeCard: {
    marginBottom: spacing.sm,
  },
  treeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.xs,
  },
  scientificName: {
    ...typography.caption,
    fontStyle: "italic",
    color: colors.textSecondary,
  },
  locationText: {
    ...typography.caption,
    color: colors.textPrimary,
    marginTop: 2,
  },
  dateText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
});
