import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { api, type MatchRole } from "@/api/client";
import { useAuth } from "@/context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "TrialRoleSelect">;

/**
 * Per the product decision, the trial skips topic selection entirely —
 * picking Speak or Listen here goes straight into matching on a fixed
 * "general" topic, capped at 10 minutes server-side (see the backend's
 * routes/trial.ts and routes/chat.ts).
 */
export default function TrialRoleSelectScreen({ navigation }: Props) {
  const { token } = useAuth();
  const [submitting, setSubmitting] = useState<MatchRole | null>(null);

  const onSelect = async (role: MatchRole) => {
    if (!token) return;
    setSubmitting(role);
    try {
      const result = await api.startTrial(token, role);
      navigation.replace("Matching", { matchRequestId: result.matchRequestId });
    } catch (err: any) {
      if (err?.status === 409) {
        Alert.alert("Trial already used", "You've already used your one-time free trial.");
        navigation.replace("Welcome");
      } else {
        Alert.alert("Couldn't start trial", "Please try again in a moment.");
      }
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Free 10-minute trial</Text>
      <Text style={styles.subtitle}>Pick one — you'll be matched right away.</Text>

      <Pressable style={styles.button} onPress={() => onSelect("SPEAKER")} disabled={submitting !== null}>
        <Text style={styles.buttonText}>{submitting === "SPEAKER" ? "Finding a match…" : "I want to talk"}</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={() => onSelect("LISTENER")} disabled={submitting !== null}>
        <Text style={styles.buttonText}>{submitting === "LISTENER" ? "Finding a match…" : "I want to listen"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#151220", padding: 24, justifyContent: "center", gap: 12 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700" },
  subtitle: { color: "#a39cb5", fontSize: 14, marginBottom: 16 },
  button: {
    backgroundColor: "#221e33",
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 4,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
