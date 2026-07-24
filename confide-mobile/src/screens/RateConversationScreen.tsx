import React, { useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "RateConversation">;

export default function RateConversationScreen({ route, navigation }: Props) {
  const { conversationId, isTrial } = route.params;
  const { token } = useAuth();
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // A trial conversation ended manually (not just auto-expired) still leads
  // to the locked-features/subscribe screen, per the product decision —
  // "on ending their free trial automatically or of their own [choosing],
  // they can see other features but aren't able to access them." A regular
  // (non-trial) conversation returns to Home, not RoleTopic — RoleTopic is
  // a sub-screen reached via Home's "Talk" tile now, not a landing point.
  const onDone = () => {
    if (isTrial) {
      navigation.reset({ index: 0, routes: [{ name: "TrialEnded" }] });
    } else {
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    }
  };

  const onSubmit = async () => {
    if (!token || !score) return;
    setSubmitting(true);
    try {
      await api.rate(token, { conversationId, score, comment: comment || undefined });
    } finally {
      setSubmitting(false);
      onDone();
    }
  };

  const onSkip = () => {
    onDone();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>How was that conversation?</Text>

      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setScore(n)}>
            <Text style={[styles.star, score !== null && n <= score && styles.starActive]}>★</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={styles.input}
        placeholder="Optional comment"
        placeholderTextColor="#8a8598"
        value={comment}
        onChangeText={setComment}
        multiline
      />

      <Pressable style={[styles.button, !score && styles.buttonDisabled]} onPress={onSubmit} disabled={!score || submitting}>
        <Text style={styles.buttonText}>{submitting ? "Submitting…" : "Submit rating"}</Text>
      </Pressable>
      <Pressable onPress={onSkip} style={styles.skip}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#151220", padding: 24, justifyContent: "center", gap: 16 },
  title: { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center" },
  stars: { flexDirection: "row", justifyContent: "center", gap: 8 },
  star: { fontSize: 36, color: "#3a3450" },
  starActive: { color: "#f5c451" },
  input: {
    backgroundColor: "#221e33",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: "top",
  },
  button: { backgroundColor: "#7c5cff", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  skip: { alignItems: "center", marginTop: 4 },
  skipText: { color: "#a39cb5", fontSize: 14 },
});
