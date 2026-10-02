import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { colors, typography, spacing } from "../theme/index";
import { useAuthStore } from "../../application/useAuthStore";
import type { RootStackParamList } from "./types";
import { WelcomeScreen } from "../screens/WelcomeScreen";
import { MainTabNavigator } from "./MainTabNavigator";
import { ReportTreeNavigator } from "./ReportTreeNavigator";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.borderLight,
    primary: colors.primary,
  },
};

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuthStore();

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

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen
            name="Welcome"
            component={WelcomeScreen}
            options={{
              animationTypeForReplace: "pop",
            }}
          />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabNavigator} />
            <Stack.Screen
              name="ReportTree"
              component={ReportTreeNavigator}
              options={{
                presentation: "modal",
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
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
});
