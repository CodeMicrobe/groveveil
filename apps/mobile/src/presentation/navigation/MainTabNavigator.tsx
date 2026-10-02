import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors, typography, spacing, shadows } from "../theme/index";
import type { MainTabParamList, RootStackParamList } from "./types";
import { HomeScreen } from "../screens/HomeScreen";
import { MapScreen } from "../screens/MapScreen";
import { AchievementsScreen } from "../screens/AchievementsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
  insets,
}) => {
  const onTabPress = (route: (typeof state.routes)[number], isFocused: boolean) => {
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  const onTabLongPress = (route: (typeof state.routes)[number]) => {
    navigation.emit({
      type: "tabLongPress",
      target: route.key,
    });
  };

  const onReportTreePress = () => {
    const parent = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (parent) {
      parent.navigate("ReportTree");
    }
  };

  const renderTabItem = (route: (typeof state.routes)[number], index: number) => {
    const { options } = descriptors[route.key];
    const isFocused = state.index === index;
    const label =
      typeof options.tabBarLabel === "string"
        ? options.tabBarLabel
        : options.title !== undefined
        ? options.title
        : route.name === "Achievements"
        ? "Badges"
        : route.name;

    const accessibilityLabel =
      options.tabBarAccessibilityLabel ||
      (typeof label === "string" ? label : route.name);

    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={accessibilityLabel}
        testID={options.tabBarButtonTestID}
        style={styles.tabItem}
        onPress={() => onTabPress(route, isFocused)}
        onLongPress={() => onTabLongPress(route)}
      >
        <Text
          style={[
            styles.tabLabel,
            isFocused && styles.tabLabelActive,
          ]}
        >
          {typeof label === "string" ? label : route.name}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.tabBarContainer,
        shadows.paper,
        {
          paddingBottom: insets.bottom,
          height: 64 + insets.bottom,
        },
      ]}
    >
      <View style={styles.tabBarContent}>
        {/* Tab 0: Home */}
        {renderTabItem(state.routes[0], 0)}

        {/* Tab 1: Map */}
        {renderTabItem(state.routes[1], 1)}

        {/* Central Botanical Action Launcher Button */}
        <View style={styles.centralButtonContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Report a tree"
            style={[styles.centralButton, shadows.floating]}
            onPress={onReportTreePress}
          >
            <Text style={styles.centralButtonText}>+</Text>
          </Pressable>
        </View>

        {/* Tab 2: Achievements / Badges */}
        {renderTabItem(state.routes[2], 2)}

        {/* Tab 3: Profile */}
        {renderTabItem(state.routes[3], 3)}
      </View>
    </View>
  );
};

export const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <MainTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
      backBehavior="firstRoute"
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Achievements" component={AchievementsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    overflow: "visible",
  },
  tabBarContent: {
    flexDirection: "row",
    height: 64,
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: spacing.sm,
    overflow: "visible",
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
  centralButtonContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 60,
    height: "100%",
    overflow: "visible",
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
