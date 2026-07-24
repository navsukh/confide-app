import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { config } from "../config.js";

const expo = new Expo({ accessToken: config.push.expoAccessToken });

export async function sendPushNotifications(
  messages: Array<{ to: string; title: string; body: string; data?: Record<string, unknown> }>,
): Promise<void> {
  const validMessages: ExpoPushMessage[] = messages.filter((m) => Expo.isExpoPushToken(m.to));
  if (validMessages.length === 0) return;

  const chunks = expo.chunkPushNotifications(validMessages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      console.error("Failed to send a push notification chunk", err);
    }
  }
}
