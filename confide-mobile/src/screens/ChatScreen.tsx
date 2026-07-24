import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { WS_BASE_URL, api, type CrisisResource } from "@/api/client";
import { useAuth } from "@/context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  sentAt: string;
  mine: boolean;
}

type ServerEvent =
  | { type: "matched"; conversationId: string; isTrial?: boolean; trialEndsAt?: string | null }
  | { type: "message"; messageId: string; senderId: string; content: string; sentAt: string }
  | { type: "blocked"; reason: string; appealHint: string }
  | { type: "crisis_resources"; resources: CrisisResource[] }
  | { type: "trial_info"; trialEndsAt: string }
  | { type: "conversation_ended"; reason: "manual" | "trial_expired" };

function formatCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ChatScreen({ route, navigation }: Props) {
  const { conversationId } = route.params;
  const { token } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [connected, setConnected] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null);
  const [countdownLabel, setCountdownLabel] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const myUserIdRef = useRef<string | null>(null);
  const isTrialRef = useRef(false);

  // Client-side ticking display only — the actual 10-minute cap is enforced
  // server-side (see the backend's routes/chat.ts trial timer), so there's
  // nothing to "cheat" by messing with this.
  useEffect(() => {
    if (!trialEndsAt) {
      setCountdownLabel(null);
      return;
    }
    const tick = () => setCountdownLabel(formatCountdown(trialEndsAt.getTime() - Date.now()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [trialEndsAt]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={onOpenMenu}>
          <Text style={{ color: "#7c5cff", fontWeight: "600" }}>•••</Text>
        </Pressable>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  useEffect(() => {
    if (!token) return;

    // Decode the JWT payload just to know our own user id for rendering
    // "mine vs theirs" bubbles — not for anything security-sensitive.
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      myUserIdRef.current = payload.sub;
    } catch {
      // ignore — bubbles will just all render as "theirs"
    }

    const ws = new WebSocket(`${WS_BASE_URL}/ws/chat/${conversationId}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const data: ServerEvent = JSON.parse(event.data);
      if (data.type === "message") {
        setMessages((prev) => [
          ...prev,
          {
            id: data.messageId,
            senderId: data.senderId,
            content: data.content,
            sentAt: data.sentAt,
            mine: data.senderId === myUserIdRef.current,
          },
        ]);
      } else if (data.type === "blocked") {
        Alert.alert("Message not sent", data.appealHint);
      } else if (data.type === "crisis_resources") {
        // Section 9.1: surface resources without ending the conversation or
        // treating the sender as if they've done something wrong.
        navigation.navigate("CrisisResources", { resources: data.resources });
      } else if (data.type === "trial_info") {
        isTrialRef.current = true;
        setTrialEndsAt(new Date(data.trialEndsAt));
      } else if (data.type === "conversation_ended") {
        if (data.reason === "trial_expired") {
          navigation.replace("TrialEnded");
        } else {
          navigation.replace("RateConversation", { conversationId, isTrial: isTrialRef.current });
        }
      }
    };

    return () => ws.close();
  }, [token, conversationId, navigation]);

  const onSend = () => {
    if (!draft.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "send", text: draft.trim() }));
    setDraft("");
  };

  const onOpenMenu = () => {
    Alert.alert("Conversation options", undefined, [
      { text: "End & rate", onPress: onEndConversation },
      { text: "Report", onPress: onReport },
      { text: "Block", onPress: onBlock, style: "destructive" },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const onEndConversation = () => {
    // Tell the server so the other party's socket also gets a
    // conversation_ended event and closes cleanly — navigating away locally
    // without this would leave the other person's chat open with no idea
    // the conversation is over.
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "end" }));
    }
    // The server's conversation_ended broadcast (handled above) will
    // navigate us onward — but navigate immediately too in case the socket
    // is already gone, so the button never feels unresponsive.
    navigation.replace("RateConversation", { conversationId, isTrial: isTrialRef.current });
  };

  const onReport = () => {
    // In a full build this opens a reason picker; simplified to one flow here.
    Alert.alert("Report this conversation?", undefined, [
      {
        text: "Report",
        style: "destructive",
        onPress: async () => {
          if (!token) return;
          const otherUserId = messages.find((m) => !m.mine)?.senderId;
          if (!otherUserId) {
            Alert.alert("Nothing to report yet");
            return;
          }
          await api.report(token, { reportedUserId: otherUserId, conversationId, reason: "OTHER" }).catch(() => {});
          Alert.alert("Report submitted");
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const onBlock = async () => {
    if (!token) return;
    const otherUserId = messages.find((m) => !m.mine)?.senderId;
    if (!otherUserId) return;
    await api.block(token, otherUserId).catch(() => {});
    if (isTrialRef.current) {
      navigation.reset({ index: 0, routes: [{ name: "TrialEnded" }] });
    } else {
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {!connected && <Text style={styles.connecting}>Connecting…</Text>}
      {countdownLabel && (
        <View style={styles.trialBanner}>
          <Text style={styles.trialBannerText}>Free trial · {countdownLabel} remaining</Text>
        </View>
      )}
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.mine ? styles.bubbleMine : styles.bubbleTheirs]}>
            <Text style={styles.bubbleText}>{item.content}</Text>
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Type a message…"
          placeholderTextColor="#8a8598"
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <Pressable style={styles.sendButton} onPress={onSend}>
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#151220" },
  connecting: { color: "#a39cb5", textAlign: "center", padding: 6, fontSize: 12 },
  trialBanner: { backgroundColor: "#2e2647", paddingVertical: 8, alignItems: "center" },
  trialBannerText: { color: "#c9b8ff", fontSize: 12, fontWeight: "600" },
  messageList: { padding: 16, gap: 8 },
  bubble: { maxWidth: "78%", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: "#7c5cff", alignSelf: "flex-end" },
  bubbleTheirs: { backgroundColor: "#221e33", alignSelf: "flex-start" },
  bubbleText: { color: "#fff", fontSize: 15 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#2f2a44",
  },
  input: {
    flex: 1,
    backgroundColor: "#221e33",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
  },
  sendButton: { backgroundColor: "#7c5cff", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  sendButtonText: { color: "#fff", fontWeight: "600" },
});
