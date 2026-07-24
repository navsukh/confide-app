import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "VerifyOtp">;

export default function VerifyOtpScreen({ route }: Props) {
  const { phoneE164 } = route.params;
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { signIn } = useAuth();

  const onSubmit = async () => {
    if (code.length !== 6) {
      Alert.alert("Enter the 6-digit code");
      return;
    }
    setSubmitting(true);
    try {
      const { token } = await api.verifyOtp({ phoneE164, code });
      await signIn(token); // navigator swaps to the authenticated stack automatically
    } catch {
      Alert.alert("Invalid or expired code", "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Enter the code we sent to</Text>
        <Text style={styles.phone}>{phoneE164}</Text>
        <Text style={styles.hint}>
          (In this local dev build, the code is logged in the backend server's console —
          SMS delivery isn't wired up yet.)
        </Text>

        <TextInput
          style={styles.input}
          placeholder="123456"
          placeholderTextColor="#8a8598"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
        />

        <Pressable style={styles.button} onPress={onSubmit} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? "Verifying…" : "Verify"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#151220" },
  container: { flexGrow: 1, padding: 24, justifyContent: "center", gap: 12 },
  title: { color: "#fff", fontSize: 18, fontWeight: "600" },
  phone: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 4 },
  hint: { color: "#a39cb5", fontSize: 13, marginBottom: 16 },
  input: {
    backgroundColor: "#221e33",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 22,
    letterSpacing: 4,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#7c5cff",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
