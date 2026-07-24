import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Easing } from "react-native";

/**
 * Box breathing (4-4-4-4): inhale 4s, hold 4s, exhale 4s, hold 4s, repeat.
 * Purely client-side animation — no backend, no audio dependency.
 */
type Phase = "inhale" | "hold1" | "exhale" | "hold2";

const PHASES: Array<{ phase: Phase; label: string; durationMs: number; targetScale: number }> = [
  { phase: "inhale", label: "Breathe in", durationMs: 4000, targetScale: 1.4 },
  { phase: "hold1", label: "Hold", durationMs: 4000, targetScale: 1.4 },
  { phase: "exhale", label: "Breathe out", durationMs: 4000, targetScale: 0.85 },
  { phase: "hold2", label: "Hold", durationMs: 4000, targetScale: 0.85 },
];

export default function BreathingScreen() {
  const [running, setRunning] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const scale = useRef(new Animated.Value(0.85)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const runPhase = (index: number) => {
    const step = PHASES[index % PHASES.length];
    setPhaseIndex(index % PHASES.length);
    Animated.timing(scale, {
      toValue: step.targetScale,
      duration: step.durationMs,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
    timeoutRef.current = setTimeout(() => runPhase(index + 1), step.durationMs);
  };

  const start = () => {
    setRunning(true);
    runPhase(0);
  };

  const stop = () => {
    setRunning(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    scale.stopAnimation();
    Animated.timing(scale, { toValue: 0.85, duration: 400, useNativeDriver: true }).start();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Breathing exercise</Text>
      <Text style={styles.subtitle}>4 seconds in, hold, 4 seconds out, hold — repeat.</Text>

      <View style={styles.circleWrap}>
        <Animated.View style={[styles.circle, { transform: [{ scale }] }]} />
        {running && <Text style={styles.phaseLabel}>{PHASES[phaseIndex].label}</Text>}
      </View>

      <Pressable style={styles.button} onPress={running ? stop : start}>
        <Text style={styles.buttonText}>{running ? "Stop" : "Start"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#151220", padding: 24, alignItems: "center", justifyContent: "center", gap: 16 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700" },
  subtitle: { color: "#a39cb5", fontSize: 14, textAlign: "center", marginBottom: 24 },
  circleWrap: { width: 220, height: 220, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  circle: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#7c5cff",
    opacity: 0.85,
  },
  phaseLabel: { color: "#fff", fontSize: 16, fontWeight: "700" },
  button: { backgroundColor: "#221e33", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
