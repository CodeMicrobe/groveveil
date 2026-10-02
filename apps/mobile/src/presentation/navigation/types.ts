import type { NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";

/**
 * Root Stack Navigator Parameter List
 */
export type RootStackParamList = {
  Welcome: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  ReportTree: NavigatorScreenParams<ReportTreeParamList> | undefined;
};

/**
 * Main Bottom Tab Navigator Parameter List
 */
export type MainTabParamList = {
  Home: undefined;
  Map: undefined;
  Achievements: undefined;
  Profile: undefined;
};

/**
 * Report Tree Wizard Modal Stack Parameter List
 */
export type ReportTreeParamList = {
  StepDetails: undefined;
  StepProof: undefined;
  StepReview: undefined;
  ReportSuccess: undefined;
};

/**
 * Screen Props for Root Stack Screens
 */
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

/**
 * Screen Props for Main Tab Screens
 */
export type MainTabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    NativeStackScreenProps<RootStackParamList>
  >;

/**
 * Screen Props for Report Tree Wizard Screens
 */
export type ReportTreeScreenProps<T extends keyof ReportTreeParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<ReportTreeParamList, T>,
    NativeStackScreenProps<RootStackParamList>
  >;

/**
 * Type declaration to strongly type navigation globally across the app
 */
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
