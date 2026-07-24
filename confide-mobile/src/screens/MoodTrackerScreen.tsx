import React, { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, type MoodEntry } from "@/api/client";
import { useAuth } from "@/context/AuthContext";

const MOOD_SCALE: Array<{ score: number; emoji: string; label: string }> = [
  { score: 1, emoji: "😞", label: "Very low" },
  { score: 2, emoji: "😕", label: "Low" },
  { score: 3, emoji: "😐", label: "Okay" },
  { score: 4, emoji: "🙂", label: "Good" },
  { score: 5, emoji: "😄", label: "Very good" },
];

export default function MoodTrackerScreen() {
  const { token } = useAuth();
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { entries: fetched } = await api.getMoodEntries(token);
      setEntries(fetched);
    } catch {
      Alert.alert("Couldn't load your mood history", "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onLog = async (score: number) => {
    if (!token) return;
    setLogging(true);
    try {
      await api.createMoodEntry(token, { score });
      await load();
    } catch {
      Alert.alert("Couldn't save", "Please try again.");
    } finally {
      setLogging(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>How are you feeling right now?</Text>
      <View style={styles.scaleRow}>
        {MOOD_SCALE.map((m) => (
          <Pressable key={m.score} style={styles.moodButton} onPress={() => onLog(m.score)} disabled={logging}>
            <Text style={styles.moodEmoji}>{m.emoji}</Text>
            <Text style={styles.moodLabel}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.historyTitle}>Recent history</Text>
      {loading ? (
        <ActivityIndicator color="#7c5cff" style={{ marginTop: 16 }} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          ListEmptyComponent={<Text style={styles.emptyText}>No entries yet.</Text>}
          renderItem={({ item }) => {
            const mood = MOOD_SCALE.find((m) => m.score === item.score);
            return (
              <View style={styles.historyRow}>
                <Text style={styles.historyEmoji}>{mood?.emoji ?? "•"}</Text>
                <View style={styles.historyBarTrack}>
                  <View style={[styles.historyBarFill, { width: `${(item.score / 5) * 100}%` }]} />
                </View>
                <Text style={styles.historyDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#151220", padding: 24 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 16 },
  scaleRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },
  moodButton: { alignItems: "center", flex: 1 },
  moodEmoji: { fontSize: 32 },
  moodLabel: { color: "#a39cb5", fontSize: 10, marginTop: 4, textAlign: "center" },
  historyTitle: { color: "#a39cb5", fontSize: 13, marginBottom: 8, fontWeight: "600" },
  emptyText: { color: "#6b6580", textAlign: "center", marginTop: 16 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  historyEmoji: { fontSize: 18, width: 28 },
  historyBarTrack: { flex: 1, height: 8, backgroundColor: "#221e33", borderRadius: 4, overflow: "hidden" },
  historyBarFill: { height: 8, backgroundColor: "#7c5cff", borderRadius: 4 },
  historyDate: { color: "#6b6580", fontSize: 11, width: 70, textAlign: "right" },
});
