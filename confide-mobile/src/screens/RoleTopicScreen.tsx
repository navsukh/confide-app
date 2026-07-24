import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { api, type Gender, type MatchRole } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import TopicPickerModal, { type Topic } from "@/components/TopicPickerModal";

type Props = NativeStackScreenProps<RootStackParamList, "RoleTopic">;

const GENDERS: Gender[] = ["UNSPECIFIED", "MALE", "FEMALE", "NON_BINARY"];

export default function RoleTopicScreen({ navigation }: Props) {
  const { token } = useAuth();
  const [role, setRole] = useState<MatchRole>("SPEAKER");
  const [topic, setTopic] = useState<Topic | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [genderPref, setGenderPref] = useState<Gender>("UNSPECIFIED");
  const [submitting, setSubmitting] = useState(false);

  const onFindMatch = async () => {
    if (!token) return;
    if (!topic) {
      Alert.alert("Pick a topic", "What do you want to talk about?");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.createMatchRequest(token, {
        role,
        topicTag: topic.tag,
        genderPref: genderPref === "UNSPECIFIED" ? undefined : genderPref,
      });

      if ("routedToCrisisResources" in result) {
        // Hard server-side rule (Section 1.1/9): this topic never enters
        // peer matching — the client can't opt around it.
        navigation.navigate("CrisisResources", { resources: result.resources });
        return;
      }

      navigation.navigate("Matching", { matchRequestId: result.matchRequestId });
    } catch (err: any) {
      if (err?.status === 402) {
        Alert.alert("Subscription required", "Your subscription isn't active. Head to Billing to subscribe.");
      } else {
        Alert.alert("Couldn't start matching", "Please try again in a moment.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What would you like to do?</Text>

      <View style={styles.rolePicker}>
        {(["SPEAKER", "LISTENER"] as const).map((r) => (
          <Pressable
            key={r}
            onPress={() => setRole(r)}
            style={[styles.roleButton, role === r && styles.roleButtonActive]}
          >
            <Text style={[styles.roleButtonText, role === r && styles.roleButtonTextActive]}>
              {r === "SPEAKER" ? "I want to talk" : "I want to listen"}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.topicButton} onPress={() => setPickerVisible(true)}>
        <Text style={topic ? styles.topicButtonTextSelected : styles.topicButtonTextPlaceholder}>
          {topic ? topic.label : "Choose a topic"}
        </Text>
      </Pressable>
      <TopicPickerModal
        visible={pickerVisible}
        selectedTag={topic?.tag ?? null}
        onSelect={setTopic}
        onClose={() => setPickerVisible(false)}
      />

      <Text style={styles.label}>Preferred listener/speaker gender (optional)</Text>
      <View style={styles.genderRow}>
        {GENDERS.map((g) => (
          <Pressable
            key={g}
            onPress={() => setGenderPref(g)}
            style={[styles.genderChip, genderPref === g && styles.genderChipActive]}
          >
            <Text style={[styles.genderChipText, genderPref === g && styles.genderChipTextActive]}>
              {g === "UNSPECIFIED" ? "No preference" : g}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.button} onPress={onFindMatch} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? "Starting…" : "Find a match"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#151220", padding: 24, gap: 12, justifyContent: "center" },
  title: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 8 },
  rolePicker: { flexDirection: "row", gap: 10, marginBottom: 8 },
  roleButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#221e33",
  },
  roleButtonActive: { backgroundColor: "#7c5cff" },
  roleButtonText: { color: "#a39cb5", fontWeight: "600" },
  roleButtonTextActive: { color: "#fff" },
  topicButton: {
    backgroundColor: "#221e33",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  topicButtonTextPlaceholder: { color: "#8a8598", fontSize: 16 },
  topicButtonTextSelected: { color: "#fff", fontSize: 16 },
  label: { color: "#a39cb5", fontSize: 13, marginTop: 4 },
  genderRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  genderChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#221e33",
  },
  genderChipActive: { backgroundColor: "#7c5cff" },
  genderChipText: { color: "#a39cb5", fontSize: 13 },
  genderChipTextActive: { color: "#fff" },
  button: {
    backgroundColor: "#7c5cff",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
