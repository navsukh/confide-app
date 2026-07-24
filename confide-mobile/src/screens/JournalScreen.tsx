import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, type JournalEntry } from "@/api/client";
import { useAuth } from "@/context/AuthContext";

export default function JournalScreen() {
  const { token } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { entries: fetched } = await api.getJournalEntries(token);
      setEntries(fetched);
    } catch {
      // gated behind an active subscription server-side — a 402 here means
      // the paywall gate above this screen let someone through it shouldn't
      // have, which would be a bug elsewhere, not something to paper over.
      Alert.alert("Couldn't load your journal", "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onSave = async () => {
    if (!token || !draft.trim()) return;
    setSaving(true);
    try {
      await api.createJournalEntry(token, { content: draft.trim() });
      setDraft("");
      await load();
    } catch {
      Alert.alert("Couldn't save", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (id: string) => {
    if (!token) return;
    Alert.alert("Delete this entry?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api.deleteJournalEntry(token, id).catch(() => {});
          load();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.container}>
        <Text style={styles.title}>Journal</Text>

        <TextInput
          style={styles.input}
          placeholder="What's on your mind?"
          placeholderTextColor="#8a8598"
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <Pressable style={styles.saveButton} onPress={onSave} disabled={saving || !draft.trim()}>
          <Text style={styles.saveButtonText}>{saving ? "Saving…" : "Save entry"}</Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator color="#7c5cff" style={{ marginTop: 24 }} />
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(e) => e.id}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
            ListEmptyComponent={<Text style={styles.emptyText}>No entries yet — write your first one above.</Text>}
            renderItem={({ item }) => (
              <Pressable style={styles.entry} onLongPress={() => onDelete(item.id)}>
                <Text style={styles.entryDate}>{new Date(item.createdAt).toLocaleString()}</Text>
                <Text style={styles.entryContent}>{item.content}</Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#151220" },
  container: { flex: 1, padding: 24 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 12 },
  input: {
    backgroundColor: "#221e33",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 90,
    textAlignVertical: "top",
  },
  saveButton: { backgroundColor: "#7c5cff", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 8 },
  saveButtonText: { color: "#fff", fontWeight: "600" },
  emptyText: { color: "#6b6580", textAlign: "center", marginTop: 24 },
  entry: { backgroundColor: "#221e33", borderRadius: 10, padding: 14, marginBottom: 8 },
  entryDate: { color: "#6b6580", fontSize: 11, marginBottom: 4 },
  entryContent: { color: "#fff", fontSize: 14 },
});
