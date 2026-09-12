import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { colors, typography, spacing, shadows } from "../theme/index";
import { useAuthStore } from "../../application/useAuthStore";
import { WelcomeScreen } from "../screens/WelcomeScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { MapScreen } from "../screens/MapScreen";
import { AchievementsScreen } from "../screens/AchievementsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ReportTreeModal } from "../screens/ReportTree/ReportTreeModal";

type TabName = "home" | "map" | "achievements" | "profile";

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabName>("home");
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[typography.body, styles.loadingText]}>
          Connecting to Groveveil...
        </Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <WelcomeScreen />;
  }

  const renderActiveScreen = () => {
    switch (activeTab) {
      case "home":
        return <HomeScreen />;
      case "map":
        return <MapScreen />;
      case "achievements":
        return <AchievementsScreen />;
      case "profile":
        return <ProfileScreen />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.screenArea}>{renderActiveScreen()}</View>

      {/* Botanical Bottom Navigation Bar */}
      <View style={[styles.tabBar, shadows.paper]}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab("home")}
        >
          <Text style={[styles.tabLabel, activeTab === "home" && styles.tabLabelActive]}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab("map")}
        >
          <Text style={[styles.tabLabel, activeTab === "map" && styles.tabLabelActive]}>
            Map
          </Text>
        </TouchableOpacity>

        {/* Central Action Launcher Button */}
        <TouchableOpacity
          style={[styles.centralButton, shadows.floating]}
          onPress={() => setIsReportModalVisible(true)}
        >
          <Text style={styles.centralButtonText}>+</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab("achievements")}
        >
          <Text style={[styles.tabLabel, activeTab === "achievements" && styles.tabLabelActive]}>
            Badges
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab("profile")}
        >
          <Text style={[styles.tabLabel, activeTab === "profile" && styles.tabLabelActive]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>

      {/* Report a Tree 3-Step Wizard Modal */}
      <ReportTreeModal
        visible={isReportModalVisible}
        onClose={() => setIsReportModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
  },
  tabBar: {
    flexDirection: "row",
    height: 64,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: spacing.sm,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    height: "100%",
  },
  tabLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "500",
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  centralButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -16,
  },
  centralButtonText: {
    fontSize: 26,
    color: colors.textInverse,
    fontWeight: "300",
    lineHeight: 28,
  },
});
