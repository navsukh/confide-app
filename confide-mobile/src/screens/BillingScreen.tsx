import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Linking, Alert, AppState, ActivityIndicator } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "Billing">;

const TIERS = [
  { id: "SILVER", label: "Silver", blurb: "Get started" },
  { id: "GOLD", label: "Gold", blurb: "More matches, faster" },
  { id: "DIAMOND", label: "Diamond", blurb: "Priority listener access" },
  { id: "PLATINUM", label: "Platinum", blurb: "Everything, top priority" },
] as const;

// Opens Stripe Checkout in the system browser rather than embedding a
// WebView — simpler, and avoids the App/Play Store scrutiny that comes with
// in-app web-based payment flows that could be read as bypassing IAP.
// NOTE (Section 10): Apple/Google may still require their own IAP for
// digital-good subscriptions depending on how "Confide tiers" are
// classified — confirm with both stores' guidelines before shipping this
// Stripe-only flow, rather than assuming it's acceptable as-is.
export default function BillingScreen({ navigation }: Props) {
  const { token } = useAuth();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const wentToBrowserRef = useRef(false);

  // The webhook that actually activates a subscription (routes/billing.ts
  // on the backend) fires after Stripe redirects back, which happens
  // outside this app entirely — so the only reliable signal we have here
  // is "did the app just come back to the foreground after we sent someone
  // to the browser." Re-check on that transition, with a couple of
  // retries since the webhook can lag the browser redirect slightly.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && wentToBrowserRef.current && token) {
        wentToBrowserRef.current = false;
        checkStatusWithRetries();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const checkStatusWithRetries = async (attemptsLeft = 3) => {
    if (!token) return;
    setCheckingStatus(true);
    try {
      const status = await api.getSubscriptionStatus(token);
      if (status.active) {
        navigation.replace("Home");
        return;
      }
      if (attemptsLeft > 0) {
        setTimeout(() => checkStatusWithRetries(attemptsLeft - 1), 2000);
        return;
      }
    } catch {
      // ignore — manual "I've subscribed" button below covers this
    } finally {
      setCheckingStatus(false);
    }
  };

  const onChoose = async (tier: (typeof TIERS)[number]["id"]) => {
    if (!token) return;
    setLoadingTier(tier);
    try {
      const { checkoutUrl } = await api.createCheckoutSession(token, tier);
      wentToBrowserRef.current = true;
      await Linking.openURL(checkoutUrl);
    } catch {
      Alert.alert("Couldn't start checkout", "Please try again in a moment.");
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose your tier</Text>
      <Text style={styles.hint}>Opens Stripe Checkout in your browser.</Text>

      {checkingStatus && (
        <View style={styles.checkingBanner}>
          <ActivityIndicator color="#7c5cff" size="small" />
          <Text style={styles.checkingText}>Checking your subscription…</Text>
        </View>
      )}

      {TIERS.map((tier) => (
        <Pressable
          key={tier.id}
          style={styles.card}
          onPress={() => onChoose(tier.id)}
          disabled={loadingTier !== null}
        >
          <Text style={styles.cardTitle}>{tier.label}</Text>
          <Text style={styles.cardBlurb}>{tier.blurb}</Text>
          {loadingTier === tier.id && <Text style={styles.loading}>Opening checkout…</Text>}
        </Pressable>
      ))}

      <Pressable onPress={() => checkStatusWithRetries()} style={styles.refreshButton}>
        <Text style={styles.refreshButtonText}>I've already subscribed — refresh</Text>
      </Pressable>

      <Pressable onPress={() => navigation.goBack()} style={styles.back}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#151220", padding: 24, gap: 12 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700", marginTop: 12 },
  hint: { color: "#a39cb5", fontSize: 13, marginBottom: 8 },
  card: { backgroundColor: "#221e33", borderRadius: 12, padding: 16, gap: 2 },
  cardTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },
  cardBlurb: { color: "#a39cb5", fontSize: 13 },
  loading: { color: "#7c5cff", fontSize: 12, marginTop: 4 },
  checkingBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#2e2647", borderRadius: 10, padding: 10, marginBottom: 4 },
  checkingText: { color: "#c9b8ff", fontSize: 12, fontWeight: "600" },
  refreshButton: { alignItems: "center", paddingVertical: 12, marginTop: 8 },
  refreshButtonText: { color: "#7c5cff", fontSize: 13, fontWeight: "600" },
  back: { alignItems: "center", marginTop: 4 },
  backText: { color: "#a39cb5", fontSize: 14 },
});
