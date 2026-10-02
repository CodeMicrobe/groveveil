import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from "react-native";
import { useNavigation, useScrollToTop } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors, typography, spacing, radii } from "../theme/index";
import { ScreenContainer } from "../components/ScreenContainer";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { ProgressBar } from "../components/ProgressBar";
import { useAuthStore } from "../../application/useAuthStore";
import { useAchievementsStore } from "../../application/useAchievementsStore";
import { apiClient, ApiClientError } from "../../data/api/api-client";
import type { RootStackParamList } from "../navigation/types";

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

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const formatPlantedDate = (isoString: string): string => {
  try {
    const parsed = new Date(isoString);
    if (isNaN(parsed.getTime())) return isoString;
    return dateFormatter.format(parsed);
  } catch {
    return isoString;
  }
};

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const flatListRef = useRef<FlatList<TreeJournalItem>>(null);
  useScrollToTop(flatListRef);

  const { user } = useAuthStore();
  const { nextMilestone, fetchAchievements } = useAchievementsStore();
  const [trees, setTrees] = useState<TreeJournalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrees = async (isPullToRefresh = false) => {
    if (isPullToRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const data = await apiClient.get<TreeJournalItem[]>("/trees/me");
      setTrees(data);
    } catch (err: any) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : err?.message || "Failed to load tree journal. Please check your connection.";
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrees();
    fetchAchievements();
  }, []);

  const handleRefresh = async () => {
    await Promise.all([fetchTrees(true), fetchAchievements()]);
  };

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

  const renderHeader = () => (
    <View style={styles.headerContainer}>
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

      {error && trees.length > 0 ? (
        <View style={styles.refreshErrorBanner}>
          <Text style={styles.refreshErrorText}>{error}</Text>
        </View>
      ) : null}

      {/* My Trees Section Header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={typography.h3}>My Tree Journal</Text>
        <Text style={typography.caption}>{trees.length} Reported</Text>
      </View>
    </View>
  );

  const renderEmptyOrStatus = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[typography.caption, styles.loadingText]}>
            Loading your tree journal...
          </Text>
        </View>
      );
    }

    if (error && trees.length === 0) {
      return (
        <Card style={styles.errorCard}>
          <Text style={[typography.bodyBold, styles.errorTitle]}>
            Unable to Load Journal
          </Text>
          <Text style={[typography.caption, styles.errorText]}>{error}</Text>
          <Button
            title="Retry"
            size="small"
            onPress={() => fetchTrees()}
            style={styles.retryButton}
          />
        </Card>
      );
    }

    return (
      <Card style={styles.emptyCard}>
        <Text style={styles.emptyIcon}>🌱</Text>
        <Text style={typography.bodyBold}>No Trees Reported Yet</Text>
        <Text style={[typography.caption, styles.emptyText]}>
          Tap the + button below to report your first real-world planted tree with photo proof and GPS.
        </Text>
        <Button
          title="Report Your First Tree"
          size="small"
          onPress={() => navigation.navigate("ReportTree")}
          style={styles.emptyButton}
        />
      </Card>
    );
  };

  const renderTreeItem = ({ item }: { item: TreeJournalItem }) => (
    <Card key={item.id} style={styles.treeCard}>
      <View style={styles.treeHeaderRow}>
        <View style={styles.speciesInfo}>
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
        Planted: {formatPlantedDate(item.plantedAt)}
      </Text>
    </Card>
  );

  return (
    <ScreenContainer>
      <FlatList
        ref={flatListRef}
        contentInsetAdjustmentBehavior="automatic"
        data={isLoading && trees.length === 0 ? [] : trees}
        keyExtractor={(item) => item.id}
        renderItem={renderTreeItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyOrStatus}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacing.xxl + 48,
  },
  headerContainer: {
    paddingBottom: spacing.sm,
  },
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
  refreshErrorBanner: {
    backgroundColor: colors.rejectedSurface,
    borderWidth: 1,
    borderColor: colors.rejectedBorder,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  refreshErrorText: {
    ...typography.caption,
    color: colors.rejected,
    textAlign: "center",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  loadingArea: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
  },
  errorCard: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    borderColor: colors.rejectedBorder,
    borderWidth: 1,
  },
  errorTitle: {
    color: colors.rejected,
    marginBottom: spacing.xs,
  },
  errorText: {
    textAlign: "center",
    marginBottom: spacing.md,
    color: colors.textSecondary,
  },
  retryButton: {
    minWidth: 100,
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
  emptyButton: {
    marginTop: spacing.md,
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
  speciesInfo: {
    flex: 1,
    marginRight: spacing.sm,
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
