import React, { useState } from "react";
import { Text } from "react-native";
import { NavigationContainer, type CompositeScreenProps } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";
import {
  createBottomTabNavigator,
  type BottomTabScreenProps,
} from "@react-navigation/bottom-tabs";
import { useAuth } from "@/context/AuthContext";
import { AuthScreen } from "@/screens/AuthScreen";
import { NeedsOnboardingScreen } from "@/screens/NeedsOnboardingScreen";
import { MapScreen } from "@/screens/MapScreen";
import { VenueDetailScreen } from "@/screens/VenueDetailScreen";
import { AddReviewScreen } from "@/screens/AddReviewScreen";
import { AssistantScreen } from "@/screens/AssistantScreen";
import { PaywallScreen } from "@/screens/PaywallScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { Loading } from "@/components/ui";
import { colors } from "@/lib/theme";

export type RootStackParamList = {
  Tabs: undefined;
  VenueDetail: { venueId: string };
  AddReview: { venueId: string };
  Paywall: undefined;
};

export type TabParamList = {
  Map: undefined;
  Assistant: undefined;
  Profile: undefined;
};

/** Tab screens can navigate to stack routes, so their props compose both. */
export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type StackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Decorative only — the tab's text label is what assistive tech should announce.
function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {label}
    </Text>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          title: "Explore",
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon label="📍" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Assistant"
        component={AssistantScreen}
        options={{
          title: "Assistant",
          tabBarIcon: ({ focused }) => <TabIcon label="💬" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon label="👤" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { session, profile, loading } = useAuth();
  // Lets someone skip the needs step without being asked again every launch.
  const [skippedOnboarding, setSkippedOnboarding] = useState(false);

  if (loading) return <Loading label="Starting AccessMap" />;
  if (!session) return <AuthScreen />;

  const needsOnboarding =
    profile !== null && profile.accessibility_needs.length === 0 && !skippedOnboarding;

  if (needsOnboarding) {
    return <NeedsOnboardingScreen onDone={() => setSkippedOnboarding(true)} />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="VenueDetail"
          component={VenueDetailScreen}
          options={{ title: "Accessibility" }}
        />
        <Stack.Screen
          name="AddReview"
          component={AddReviewScreen}
          options={{ title: "Add review" }}
        />
        <Stack.Screen
          name="Paywall"
          component={PaywallScreen}
          options={{ title: "Premium" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
