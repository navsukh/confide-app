import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { api } from "@/api/client";

/**
 * Fills the gap between the backend's push/spatial-matching features and
 * the mobile client: without this, `sendPushNotifications` in the backend
 * has no token to send to, and radius matching has no coordinates to filter
 * on. Both are best-effort — a person can decline both permissions and the
 * app should degrade gracefully (no push, no distance filtering) rather
 * than block anything.
 */
export function useRegisterDeviceInfo(token: string | null) {
  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    (async () => {
      const updates: { expoPushToken?: string; latitude?: number; longitude?: number } = {};

      try {
        if (Device.isDevice) {
          let { granted } = await Notifications.getPermissionsAsync();
          if (!granted) {
            ({ granted } = await Notifications.requestPermissionsAsync());
          }
          if (granted) {
            // Requires an EAS project id in a real build (app.json ->
            // extra.eas.projectId) — this will throw in an unconfigured
            // local dev build, which is why it's wrapped in its own catch.
            const pushToken = await Notifications.getExpoPushTokenAsync();
            updates.expoPushToken = pushToken.data;
          }
          if (Platform.OS === "android") {
            await Notifications.setNotificationChannelAsync("default", {
              name: "default",
              importance: Notifications.AndroidImportance.DEFAULT,
            });
          }
        }
      } catch (err) {
        console.warn("Push token registration skipped:", err);
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          updates.latitude = position.coords.latitude;
          updates.longitude = position.coords.longitude;
        }
      } catch (err) {
        console.warn("Location registration skipped:", err);
      }

      if (!cancelled && (updates.expoPushToken || updates.latitude !== undefined)) {
        await api.updateMe(token, updates).catch((err) => console.warn("Failed to sync device info:", err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);
}
