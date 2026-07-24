import React from "react";
import { View, Text, Pressable, Linking, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "CrisisResources">;

// Reached either from RoleTopicScreen (crisis topic chosen up front), from
// TrialRoleSelectScreen's matching flow, or from ChatScreen (crisis content
// flagged mid-conversation — including during a free trial). Either way,
// this is meant to be supportive, not a dead end — the person can always go
// back to the app afterward (see Section 9.1: don't freeze people out).
//
// Navigates back to Welcome rather than straight to RoleTopic: RoleTopic
// now sits behind the subscription gate, and a trial user hitting this
// screen mid-trial doesn't have a subscription yet. Welcome re-checks
// status itself and forwards to Home if one exists, so this is correct for
// both subscribed and not-yet-subscribed people.
export default function CrisisResourcesScreen({ route, navigation }: Props) {
  const { resources } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>You're not alone</Text>
      <Text style={styles.subtitle}>
        This isn't something peer chat is set up to help with safely — here are some resources
        that are.
      </Text>

      {resources.map((r) => (
        <View key={r.name} style={styles.card}>
          <Text style={styles.cardTitle}>{r.name}</Text>
          <Text style={styles.cardDescription}>{r.description}</Text>
          {r.phone && (
            <Pressable onPress={() => Linking.openURL(`tel:${r.phone}`)}>
              <Text style={styles.link}>{r.phone}</Text>
            </Pressable>
          )}
          {r.url && (
            <Pressable onPress={() => Linking.openURL(r.url!)}>
              <Text style={styles.link}>{r.url}</Text>
            </Pressable>
          )}
        </View>
      ))}

      <Pressable style={styles.button} onPress={() => navigation.navigate("Welcome")}>
        <Text style={styles.buttonText}>Back to Confide</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#151220", padding: 24, gap: 12 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700", marginTop: 12 },
  subtitle: { color: "#a39cb5", fontSize: 14, marginBottom: 12 },
  card: { backgroundColor: "#221e33", borderRadius: 12, padding: 16, gap: 4 },
  cardTitle: { color: "#fff", fontWeight: "600", fontSize: 15 },
  cardDescription: { color: "#a39cb5", fontSize: 13 },
  link: { color: "#7c5cff", fontSize: 14, marginTop: 4, fontWeight: "600" },
  button: { backgroundColor: "#7c5cff", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
