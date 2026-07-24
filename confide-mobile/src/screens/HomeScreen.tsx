import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

interface FeatureTile {
  title: string;
  description: string;
  route: keyof RootStackParamList;
}

const FEATURES: FeatureTile[] = [
  { title: "Talk", description: "Speak with someone, or listen", route: "RoleTopic" },
  { title: "Meditate", description: "Guided timers for calm and focus", route: "Meditation" },
  { title: "Journal", description: "Write down what's on your mind", route: "Journal" },
  { title: "Mood tracker", description: "Log how you're feeling over time", route: "MoodTracker" },
  { title: "Breathing", description: "A simple guided breathing exercise", route: "Breathing" },
];

export default function HomeScreen({ navigation }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Confide</Text>
      <Text style={styles.subtitle}>What would you like to do today?</Text>

      {FEATURES.map((f) => (
        <Pressable key={f.route} style={styles.tile} onPress={() => navigation.navigate(f.route as never)}>
          <Text style={styles.tileTitle}>{f.title}</Text>
          <Text style={styles.tileDescription}>{f.description}</Text>
        </Pressable>
      ))}

      <View style={styles.secondaryRow}>
        <Pressable onPress={() => navigation.navigate("ListenerProfile")} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Your stats</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("Billing")} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Manage subscription</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => navigation.navigate("Settings")} style={styles.settingsLink}>
        <Text style={styles.settingsLinkText}>Settings</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#151220", padding: 24, gap: 12 },
  title: { color: "#fff", fontSize: 26, fontWeight: "700", marginTop: 12 },
  subtitle: { color: "#a39cb5", fontSize: 14, marginBottom: 12 },
  tile: {
    backgroundColor: "#221e33",
    borderRadius: 14,
    padding: 18,
    marginBottom: 4,
  },
  tileTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  tileDescription: { color: "#a39cb5", fontSize: 13, marginTop: 4 },
  secondaryRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  secondaryButton: { flex: 1, alignItems: "center", paddingVertical: 12, backgroundColor: "#1c1830", borderRadius: 10 },
  secondaryButtonText: { color: "#a39cb5", fontSize: 13, fontWeight: "600" },
  settingsLink: { alignItems: "center", marginTop: 20 },
  settingsLinkText: { color: "#6b6580", fontSize: 13 },
});
