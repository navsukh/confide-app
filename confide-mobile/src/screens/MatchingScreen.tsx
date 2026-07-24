import React, { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "Matching">;

const POLL_INTERVAL_MS = 1500;

// Deliberately a simple poll rather than a dedicated "waiting room" WebSocket
// channel — the matching worker publishes over the chat conversation channel
// once a match exists, so there's nothing to subscribe to before that. If
// polling proves too chatty at scale, add a per-user waiting-room channel.
export default function MatchingScreen({ route, navigation }: Props) {
  const { matchRequestId } = route.params;
  const { token } = useAuth();
  const [status, setStatus] = useState<"queued" | "expired">("queued");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) return;

    const poll = async () => {
      try {
        const result = await api.getMatchStatus(token, matchRequestId);
        if (result.state === "MATCHED" && result.conversationId) {
          if (timerRef.current) clearInterval(timerRef.current);
          navigation.replace("Chat", { conversationId: result.conversationId });
        } else if (result.state === "EXPIRED" || result.state === "CANCELLED") {
          if (timerRef.current) clearInterval(timerRef.current);
          setStatus("expired");
        }
      } catch {
        // transient network error — let the next poll try again
      }
    };

    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [token, matchRequestId, navigation]);

  const onCancel = async () => {
    if (!token) return;
    if (timerRef.current) clearInterval(timerRef.current);
    await api.cancelMatchRequest(token, matchRequestId).catch(() => {});
    navigation.goBack();
  };

  if (status === "expired") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No match found in time</Text>
        <Text style={styles.hint}>Try a different topic or check back in a bit.</Text>
        <Pressable style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#7c5cff" />
      <Text style={styles.title}>Looking for someone to talk with…</Text>
      <Pressable style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#151220", alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  title: { color: "#fff", fontSize: 17, fontWeight: "600", textAlign: "center" },
  hint: { color: "#a39cb5", fontSize: 14, textAlign: "center" },
  button: { backgroundColor: "#7c5cff", borderRadius: 10, paddingVertical: 14, paddingHorizontal: 32, marginTop: 8 },
  buttonText: { color: "#fff", fontWeight: "600" },
  cancelButton: { marginTop: 24 },
  cancelButtonText: { color: "#a39cb5", fontSize: 14 },
});
