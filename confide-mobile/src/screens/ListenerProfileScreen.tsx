import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/api/client";

interface Profile {
  level: number;
  points: number;
  totalSessions: number;
  avgRating: number | null;
  priorityEligible: boolean;
}

const POINTS_PER_LEVEL = 100; // mirrors backend services/leveling-math.ts

export default function ListenerProfileScreen() {
  const { token } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api
      .getListenerProfile(token)
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#7c5cff" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.hint}>Couldn't load your stats right now.</Text>
      </View>
    );
  }

  const progressInLevel = profile.points % POINTS_PER_LEVEL;

  return (
    <View style={styles.container}>
      <Text style={styles.level}>Level {profile.level}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(progressInLevel / POINTS_PER_LEVEL) * 100}%` }]} />
      </View>
      <Text style={styles.hint}>
        {profile.level >= 4 ? "Max level reached" : `${progressInLevel} / ${POINTS_PER_LEVEL} points to next level`}
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile.totalSessions}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile.avgRating ? profile.avgRating.toFixed(1) : "—"}</Text>
          <Text style={styles.statLabel}>Avg rating</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile.priorityEligible ? "Yes" : "No"}</Text>
          <Text style={styles.statLabel}>Priority match</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#151220", padding: 24, gap: 12 },
  level: { color: "#fff", fontSize: 26, fontWeight: "800", marginTop: 12 },
  progressTrack: { height: 8, backgroundColor: "#221e33", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, backgroundColor: "#7c5cff" },
  hint: { color: "#a39cb5", fontSize: 13 },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  statCard: { flex: 1, backgroundColor: "#221e33", borderRadius: 12, padding: 14, alignItems: "center", gap: 4 },
  statValue: { color: "#fff", fontSize: 20, fontWeight: "700" },
  statLabel: { color: "#a39cb5", fontSize: 12 },
});
