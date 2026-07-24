import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Notifications from "expo-notifications";
import { useAuth } from "@/context/AuthContext";
import { useRegisterDeviceInfo } from "@/hooks/useRegisterDeviceInfo";
import type { CrisisResource } from "@/api/client";

import SignupScreen from "@/screens/SignupScreen";
import VerifyOtpScreen from "@/screens/VerifyOtpScreen";
import WelcomeScreen from "@/screens/WelcomeScreen";
import TrialRoleSelectScreen from "@/screens/TrialRoleSelectScreen";
import TrialEndedScreen from "@/screens/TrialEndedScreen";
import HomeScreen from "@/screens/HomeScreen";
import RoleTopicScreen from "@/screens/RoleTopicScreen";
import MatchingScreen from "@/screens/MatchingScreen";
import ChatScreen from "@/screens/ChatScreen";
import RateConversationScreen from "@/screens/RateConversationScreen";
import CrisisResourcesScreen from "@/screens/CrisisResourcesScreen";
import BillingScreen from "@/screens/BillingScreen";
import ListenerProfileScreen from "@/screens/ListenerProfileScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import MeditationScreen from "@/screens/MeditationScreen";
import JournalScreen from "@/screens/JournalScreen";
import MoodTrackerScreen from "@/screens/MoodTrackerScreen";
import BreathingScreen from "@/screens/BreathingScreen";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type RootStackParamList = {
  Signup: undefined;
  VerifyOtp: { phoneE164: string };
  Welcome: undefined;
  TrialRoleSelect: undefined;
  TrialEnded: undefined;
  Home: undefined;
  RoleTopic: undefined;
  Matching: { matchRequestId: string };
  Chat: { conversationId: string };
  RateConversation: { conversationId: string; isTrial?: boolean };
  CrisisResources: { resources: CrisisResource[] };
  Billing: undefined;
  ListenerProfile: undefined;
  Settings: undefined;
  Meditation: undefined;
  Journal: undefined;
  MoodTracker: undefined;
  Breathing: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { token, isLoading } = useAuth();
  useRegisterDeviceInfo(token);

  if (isLoading) return null; // could swap in a splash/loading screen here

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: true }}>
        {!token ? (
          <>
            <Stack.Screen name="Signup" component={SignupScreen} options={{ title: "Confide" }} />
            <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} options={{ title: "Verify" }} />
          </>
        ) : (
          <>
            {/* Welcome is the landing screen post-auth — it checks
                subscription status itself and either forwards to Home
                (active subscription) or offers the free trial / subscribe
                paywall. See screens/WelcomeScreen.tsx. */}
            <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ title: "Confide" }} />
            <Stack.Screen
              name="TrialRoleSelect"
              component={TrialRoleSelectScreen}
              options={{ title: "Free trial" }}
            />
            <Stack.Screen
              name="TrialEnded"
              component={TrialEndedScreen}
              options={{ title: "Trial complete", headerBackVisible: false }}
            />
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Confide" }} />
            <Stack.Screen name="RoleTopic" component={RoleTopicScreen} options={{ title: "Talk" }} />
            <Stack.Screen name="Matching" component={MatchingScreen} options={{ title: "Finding a match…" }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ title: "Chat" }} />
            <Stack.Screen
              name="RateConversation"
              component={RateConversationScreen}
              options={{ title: "Rate this conversation" }}
            />
            <Stack.Screen
              name="CrisisResources"
              component={CrisisResourcesScreen}
              options={{ title: "Support resources", headerBackVisible: false }}
            />
            <Stack.Screen name="Billing" component={BillingScreen} options={{ title: "Choose your tier" }} />
            <Stack.Screen
              name="ListenerProfile"
              component={ListenerProfileScreen}
              options={{ title: "Your listener stats" }}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
            <Stack.Screen name="Meditation" component={MeditationScreen} options={{ title: "Meditation" }} />
            <Stack.Screen name="Journal" component={JournalScreen} options={{ title: "Journal" }} />
            <Stack.Screen name="MoodTracker" component={MoodTrackerScreen} options={{ title: "Mood tracker" }} />
            <Stack.Screen name="Breathing" component={BreathingScreen} options={{ title: "Breathing" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
