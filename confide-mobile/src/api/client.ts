// Points at the confide-backend service. Override with an env-based config
// (e.g. expo-constants + app.config.ts) before shipping to a device that
// isn't on the same machine as the API — "localhost" only works in the
// simulator/emulator talking to a locally-run backend.
export const API_BASE_URL = "https://humorless-genetics-possum.ngrok-free.dev";
export const WS_BASE_URL = "wss://humorless-genetics-possum.ngrok-free.dev";

export type Gender = "MALE" | "FEMALE" | "NON_BINARY" | "UNSPECIFIED";
export type MatchRole = "SPEAKER" | "LISTENER";

export interface CrisisResource {
  name: string;
  description: string;
  phone?: string;
  url?: string;
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  console.log("PATH:", path);
console.log("TOKEN:", token);
console.log("AUTH:", token ? `Bearer ${token}` : "NO TOKEN");
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = { error: res.statusText };
    }
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(typeof body === "object" && body && "error" in body ? String((body as any).error) : `HTTP ${status}`);
  }
}

export const api = {
  signup: (data: {
    displayHandle: string;
    dob: string; // YYYY-MM-DD
    phoneE164: string;
    gender?: Gender;
    region?: string;
    languages?: string[];
  }) => request<{ userId: string; otpSent: boolean }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(data),
  }),

  verifyOtp: (data: { phoneE164: string; code: string }) =>
    request<{ token: string }>("/auth/verify-otp", { method: "POST", body: JSON.stringify(data) }),

  login: (data: { phoneE164: string }) =>
    request<{ token: string }>("/auth/login", { method: "POST", body: JSON.stringify(data) }),

  createMatchRequest: (
    token: string,
    data: {
      role: MatchRole;
      topicTag: string;
      genderPref?: Gender;
      languagePref?: string;
    },
  ) =>
    request<
      | { matchRequestId: string; expiresAt: string }
      | { routedToCrisisResources: true; resources: CrisisResource[] }
    >("/match/request", { method: "POST", token, body: JSON.stringify(data) }),

  getMatchStatus: (token: string, id: string) =>
    request<{ state: string; conversationId: string | null; expiresAt: string }>(
      `/match/request/${id}`,
      { token },
    ),

  cancelMatchRequest: (token: string, id: string) =>
    request<void>(`/match/request/${id}`, { method: "DELETE", token }),

  report: (
    token: string,
    data: { reportedUserId: string; conversationId?: string; reason: string; details?: string },
  ) => request<{ reportId: string }>("/reports", { method: "POST", token, body: JSON.stringify(data) }),

  block: (token: string, blockedUserId: string) =>
    request<void>("/blocks", { method: "POST", token, body: JSON.stringify({ blockedUserId }) }),

  rate: (token: string, data: { conversationId: string; score: number; comment?: string }) =>
    request<{ ratingId: string }>("/ratings", { method: "POST", token, body: JSON.stringify(data) }),

  getMe: (token: string) =>
    request<{
      displayHandle: string;
      gender: Gender;
      region: string | null;
      languages: string[];
      latitude: number | null;
      longitude: number | null;
    }>("/me", { token }),

  updateMe: (
    token: string,
    data: {
      expoPushToken?: string;
      latitude?: number;
      longitude?: number;
      displayHandle?: string;
      languages?: string[];
    },
  ) => request<void>("/me", { method: "PATCH", token, body: JSON.stringify(data) }),

  getListenerProfile: (token: string) =>
    request<{
      level: number;
      points: number;
      totalSessions: number;
      avgRating: number | null;
      priorityEligible: boolean;
    }>("/listener-profile/me", { token }),

  createCheckoutSession: (token: string, tier: "SILVER" | "GOLD" | "DIAMOND" | "PLATINUM") =>
    request<{ checkoutUrl: string }>("/billing/checkout-session", {
      method: "POST",
      token,
      body: JSON.stringify({ tier }),
    }),

  getSubscriptionStatus: (token: string) =>
    request<{
      active: boolean;
      tier: "SILVER" | "GOLD" | "DIAMOND" | "PLATINUM" | null;
      renewsAt: string | null;
      trialAvailable: boolean;
    }>("/subscription/status", { token }),

  startTrial: (token: string, role: MatchRole) =>
    request<{ matchRequestId: string; expiresAt: string }>("/trial/start", {
      method: "POST",
      token,
      body: JSON.stringify({ role }),
    }),

  createJournalEntry: (token: string, data: { content: string; mood?: string }) =>
    request<{ entry: JournalEntry }>("/journal", { method: "POST", token, body: JSON.stringify(data) }),

  getJournalEntries: (token: string) => request<{ entries: JournalEntry[] }>("/journal", { token }),

  updateJournalEntry: (token: string, id: string, data: { content?: string; mood?: string }) =>
    request<{ entry: JournalEntry }>(`/journal/${id}`, { method: "PATCH", token, body: JSON.stringify(data) }),

  deleteJournalEntry: (token: string, id: string) =>
    request<void>(`/journal/${id}`, { method: "DELETE", token }),

  createMoodEntry: (token: string, data: { score: number; note?: string }) =>
    request<{ entry: MoodEntry }>("/mood", { method: "POST", token, body: JSON.stringify(data) }),

  getMoodEntries: (token: string) => request<{ entries: MoodEntry[] }>("/mood", { token }),
};

export interface JournalEntry {
  id: string;
  content: string;
  mood: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MoodEntry {
  id: string;
  score: number;
  note: string | null;
  createdAt: string;
}
