import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "TrialEnded">;

const LOCKED_FEATURES = [
  { title: "Unlimited conversations", description: "Talk or listen as much as you'd like" },
  { title: "Meditate", description: "Guided timers for calm and focus" },
  { title: "Journal", description: "A private space to write down what's on your mind" },
  { title: "Mood tracker", description: "See how you're feeling over time" },
  { title: "Breathing", description: "A simple guided breathing exercise" },
];

export default function TrialEndedScreen({ navigation }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>That's a wrap on your free trial</Text>
      <Text style={styles.subtitle}>Hope that was helpful. Here's what's waiting for you with a subscription:</Text>

      {LOCKED_FEATURES.map((f) => (
        <View key={f.title} style={styles.tile}>
          <Text style={styles.lockIcon}>🔒</Text>
          <View style={styles.tileTextWrap}>
            <Text style={styles.tileTitle}>{f.title}</Text>
            <Text style={styles.tileDescription}>{f.description}</Text>
          </View>
        </View>
      ))}

      <Pressable style={styles.subscribeButton} onPress={() => navigation.navigate("Billing")}>
        <Text style={styles.subscribeButtonText}>Subscribe now</Text>
      </Pressable>
      <Pressable style={styles.laterButton} onPress={() => navigation.replace("Welcome")}>
        <Text style={styles.laterButtonText}>Maybe later</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#151220", padding: 24, gap: 10 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700", marginTop: 12 },
  subtitle: { color: "#a39cb5", fontSize: 14, marginBottom: 12 },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#221e33",
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
    opacity: 0.8,
  },
  lockIcon: { fontSize: 18, marginRight: 12 },
  tileTextWrap: { flex: 1 },
  tileTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  tileDescription: { color: "#a39cb5", fontSize: 13, marginTop: 2 },
  subscribeButton: { backgroundColor: "#7c5cff", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 20 },
  subscribeButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  laterButton: { alignItems: "center", paddingVertical: 14 },
  laterButtonText: { color: "#a39cb5", fontSize: 14 },
});
