import React, { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

/**
 * Landing screen right after OTP verification, and also wherever the app
 * discovers a subscription isn't active (e.g. after a trial ends). Per the
 * product decision, this is a hard gate: nothing past this screen is
 * reachable without either starting the one-time free trial or subscribing.
 *
 * FLAGGING AGAIN (see prior conversation): a zero-free-usage paywall in
 * front of BOTH sides of a two-sided marketplace is a real App Store /
 * Play Store review risk. This screen implements the product decision as
 * given, not a recommendation.
 */
const FEATURE_OVERVIEW = [
  { title: "Talk", description: "Get matched with someone to speak with, or volunteer to listen" },
  { title: "Meditate", description: "Guided timers for calm and focus" },
  { title: "Journal", description: "A private space to write down what's on your mind" },
  { title: "Mood tracker", description: "See how you're feeling over time" },
  { title: "Breathing", description: "A simple guided breathing exercise for anxious moments" },
];

export default function WelcomeScreen({ navigation }: Props) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [trialAvailable, setTrialAvailable] = useState(false);

  // useFocusEffect, not useEffect: this screen stays mounted underneath
  // Billing in the stack, so navigation.goBack() from Billing wouldn't
  // remount it — without this, returning from a completed Stripe checkout
  // would show stale "not subscribed" state until a full app restart.
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      setLoading(true);
      api
        .getSubscriptionStatus(token)
        .then((status) => {
          if (status.active) {
            navigation.replace("Home");
            return;
          }
          setTrialAvailable(status.trialAvailable);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [token, navigation]),
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#7c5cff" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Welcome to Confide</Text>
      <Text style={styles.subtitle}>Here's everything included with a subscription:</Text>

      {FEATURE_OVERVIEW.map((f) => (
        <View key={f.title} style={styles.tile}>
          <Text style={styles.tileTitle}>{f.title}</Text>
          <Text style={styles.tileDescription}>{f.description}</Text>
        </View>
      ))}

      {trialAvailable && (
        <Pressable style={styles.trialButton} onPress={() => navigation.navigate("TrialRoleSelect")}>
          <Text style={styles.trialButtonTitle}>Start your free 10-minute trial</Text>
          <Text style={styles.trialButtonSubtitle}>One conversation, on us — no subscription needed yet</Text>
        </Pressable>
      )}

      <Pressable style={styles.subscribeButton} onPress={() => navigation.navigate("Billing")}>
        <Text style={styles.subscribeButtonText}>
          {trialAvailable ? "Subscribe now instead" : "Subscribe to continue"}
        </Text>
      </Pressable>

      {!trialAvailable && (
        <Text style={styles.usedHint}>You've already used your free trial — subscribe to keep going.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: "#151220", alignItems: "center", justifyContent: "center" },
  container: { flexGrow: 1, backgroundColor: "#151220", padding: 24, gap: 10 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700", marginTop: 12 },
  subtitle: { color: "#a39cb5", fontSize: 14, marginBottom: 8 },
  tile: { backgroundColor: "#221e33", borderRadius: 12, padding: 14, marginBottom: 4 },
  tileTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  tileDescription: { color: "#a39cb5", fontSize: 13, marginTop: 2 },
  trialButton: { backgroundColor: "#7c5cff", borderRadius: 12, padding: 18, marginTop: 20 },
  trialButtonTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  trialButtonSubtitle: { color: "#e4dcff", fontSize: 12, marginTop: 4 },
  subscribeButton: {
    backgroundColor: "#221e33",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  subscribeButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  usedHint: { color: "#6b6580", fontSize: 12, textAlign: "center", marginTop: 8 },
});
