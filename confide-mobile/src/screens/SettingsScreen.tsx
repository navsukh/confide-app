import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { api, ApiError } from "@/api/client";
import { useAuth } from "@/context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

// Deliberately does NOT expose dob/phoneE164/gender-as-editable here: dob and
// phone are verification-only fields the backend never returns for editing
// (see routes/profile.ts's GET /me comment), and letting gender change
// freely would undercut the gender-preference matching filter's meaning.
// If you want gender to be editable, that's a product decision worth its
// own thought, not a default to slip in here.
export default function SettingsScreen({ navigation }: Props) {
  const { token, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [displayHandle, setDisplayHandle] = useState("");
  const [languagesInput, setLanguagesInput] = useState(""); // comma-separated in the UI
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .getMe(token)
      .then((me) => {
        setDisplayHandle(me.displayHandle);
        setLanguagesInput(me.languages.join(", "));
      })
      .catch(() => Alert.alert("Couldn't load your profile"))
      .finally(() => setLoading(false));
  }, [token]);

  const onSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await api.updateMe(token, {
        displayHandle: displayHandle.trim(),
        languages: languagesInput
          .split(",")
          .map((l) => l.trim())
          .filter(Boolean),
      });
      Alert.alert("Saved");
    } catch (err) {
      if (err instanceof ApiError && (err.body as any)?.error === "handle_taken") {
        Alert.alert("Handle taken", "Someone already has that handle — try another.");
      } else {
        Alert.alert("Couldn't save", "Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const onSignOut = () => {
    Alert.alert("Sign out?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#7c5cff" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Display handle</Text>
      <TextInput
        style={styles.input}
        value={displayHandle}
        onChangeText={setDisplayHandle}
        autoCapitalize="none"
        placeholder="Display handle"
        placeholderTextColor="#8a8598"
      />

      <Text style={styles.label}>Languages (comma-separated)</Text>
      <TextInput
        style={styles.input}
        value={languagesInput}
        onChangeText={setLanguagesInput}
        placeholder="en, hi, pa"
        placeholderTextColor="#8a8598"
        autoCapitalize="none"
      />

      <Pressable style={styles.button} onPress={onSave} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? "Saving…" : "Save changes"}</Text>
      </Pressable>

      <Pressable
        style={styles.secondaryButton}
        onPress={() => navigation.navigate("ListenerProfile")}
      >
        <Text style={styles.secondaryButtonText}>View listener stats</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("Billing")}>
        <Text style={styles.secondaryButtonText}>Manage subscription</Text>
      </Pressable>

      <Pressable style={styles.signOut} onPress={onSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#151220", padding: 24, gap: 10 },
  label: { color: "#a39cb5", fontSize: 13, marginTop: 12 },
  input: {
    backgroundColor: "#221e33",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: { backgroundColor: "#7c5cff", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  secondaryButton: {
    backgroundColor: "#221e33",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  signOut: { alignItems: "center", marginTop: 28 },
  signOutText: { color: "#e5484d", fontSize: 14, fontWeight: "600" },
});
