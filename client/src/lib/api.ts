const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const config: RequestInit = {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  };

  const res = await fetch(`${BASE_URL}${endpoint}`, config);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data?.error || data?.message || `Request failed with status ${res.status}`;
    const err = new Error(errorMsg);
    (err as any).status = res.status;
    (err as any).data = data;
    throw err;
  }

  return data as T;
}

export const api = {
  // Auth
  getAuthStatus: () => request<{ success: boolean; authenticated: boolean; user?: any }>("/api/auth/status"),
  logout: () => request<{ success: boolean }>("/api/auth/logout", { method: "POST" }),

  // User & Onboarding
  getMe: () => request<{ success: boolean; user: any }>("/api/users/me"),
  completeProfile: (payload: { name: string; username: string; bio?: string }) =>
    request<{ success: boolean; message: string; token: string; user: any }>("/api/users/complete-profile", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateProfile: (payload: { name: string; bio?: string }) =>
    request<{ success: boolean; user: any }>("/api/users/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  getUserProfile: (userId: string) =>
    request<{ success: boolean; user: any }>(`/api/users/profile/${userId}`),
  getDiscoverUsers: (cursor?: string, limit: number = 20) => {
    const query = new URLSearchParams();
    if (cursor) query.set("cursor", cursor);
    query.set("limit", String(limit));
    return request<{ success: boolean; users: any[]; nextCursor: string | null; hasMore: boolean }>(
      `/api/users/discover?${query.toString()}`
    );
  },

  // Conversations & Messaging
  initiateConversation: (recipientId: string) =>
    request<{ success: boolean; conversation: any }>("/api/conversations/initiate", {
      method: "POST",
      body: JSON.stringify({ recipientId }),
    }),
  getUserConversations: () =>
    request<{ success: boolean; conversations: any[] }>("/api/conversations"),
  getConversationMessages: (conversationId: string) =>
    request<{ success: boolean; messages: any[] }>(`/api/conversations/${conversationId}/messages`),
  sendMessage: (conversationId: string, content: string) =>
    request<{ success: boolean; message: any }>(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
};
