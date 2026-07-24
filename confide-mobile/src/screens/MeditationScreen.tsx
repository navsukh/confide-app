import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Vibration } from "react-native";

/**
 * No real audio is bundled here — I can't source or verify licensing for
 * meditation audio, and generating audio content is out of scope for this
 * build. This is a timer + calming visual + a vibration cue at the end.
 *
 * To add real audio: install `expo-av` (or the newer `expo-audio`), drop
 * royalty-free tracks under `assets/meditation/`, and play/pause them
 * alongside the timer state below (`isRunning`). Everything else — session
 * list, countdown, completion handling — stays the same.
 */
interface Session {
  id: string;
  title: string;
  description: string;
  durationSeconds: number;
}

const SESSIONS: Session[] = [
  { id: "focus-3", title: "Focus reset", description: "A quick reset between conversations", durationSeconds: 3 * 60 },
  { id: "calm-5", title: "Calm breathing", description: "Settle a racing mind", durationSeconds: 5 * 60 },
  { id: "wind-down-10", title: "Sleep wind-down", description: "Ease into rest", durationSeconds: 10 * 60 },
];

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function MeditationScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const start = (s: Session) => {
    setSession(s);
    setRemaining(s.durationSeconds);
    setIsRunning(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setIsRunning(false);
          Vibration.vibrate(400);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
    setSession(null);
  };

  if (session) {
    return (
      <View style={styles.container}>
        <View style={styles.circle}>
          <Text style={styles.timerText}>{formatTime(remaining)}</Text>
        </View>
        <Text style={styles.sessionTitle}>{session.title}</Text>
        <Pressable style={styles.stopButton} onPress={stop}>
          <Text style={styles.stopButtonText}>{remaining === 0 ? "Done" : "End early"}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meditation</Text>
      <Text style={styles.subtitle}>Pick a length that fits right now.</Text>
      {SESSIONS.map((s) => (
        <Pressable key={s.id} style={styles.sessionTile} onPress={() => start(s)}>
          <Text style={styles.sessionTileTitle}>{s.title}</Text>
          <Text style={styles.sessionTileDescription}>
            {s.description} · {Math.round(s.durationSeconds / 60)} min
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#151220", padding: 24, gap: 10, justifyContent: "center" },
  title: { color: "#fff", fontSize: 22, fontWeight: "700" },
  subtitle: { color: "#a39cb5", fontSize: 14, marginBottom: 12 },
  sessionTile: { backgroundColor: "#221e33", borderRadius: 12, padding: 16, marginBottom: 4 },
  sessionTileTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  sessionTileDescription: { color: "#a39cb5", fontSize: 13, marginTop: 2 },
  circle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 4,
    borderColor: "#7c5cff",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 24,
  },
  timerText: { color: "#fff", fontSize: 40, fontWeight: "700" },
  sessionTitle: { color: "#fff", fontSize: 18, fontWeight: "600", textAlign: "center" },
  stopButton: { alignItems: "center", marginTop: 24, paddingVertical: 14 },
  stopButtonText: { color: "#a39cb5", fontSize: 15 },
});
