import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { ChatPage } from "./ChatPage";
import { api } from "@/lib/api";

// Mock AuthContext
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", name: "Current User", username: "current" },
    isAuthenticated: true,
  }),
}));

// Mock SocketContext
vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    socket: null,
    isConnected: true,
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
    sendSocketMessage: vi.fn(),
  }),
}));

// Mock API
vi.mock("@/lib/api", () => ({
  api: {
    getUserConversations: vi.fn(),
    getConversationMessages: vi.fn(),
    sendMessage: vi.fn(),
  },
}));

describe("ChatPage Component", () => {
  const mockConversations = [
    {
      id: "conv-1",
      recipient: { id: "user-2", name: "Alice Wonderland", username: "alice" },
      lastMessage: { content: "Hey there!", sentAt: new Date().toISOString() },
    },
    {
      id: "conv-2",
      recipient: { id: "user-3", name: "Bob Builder", username: "bob" },
      lastMessage: { content: "See you tomorrow", sentAt: new Date().toISOString() },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (api.getUserConversations as any).mockResolvedValue({
      success: true,
      conversations: mockConversations,
    });
    (api.getConversationMessages as any).mockResolvedValue({
      success: true,
      messages: [],
    });
  });

  it("does NOT auto-open any chat on load, showing placeholder state", async () => {
    render(<ChatPage />);

    // Shows conversation sidebar list
    await waitFor(() => {
      expect(screen.getByText("Alice Wonderland")).toBeInTheDocument();
      expect(screen.getByText("Bob Builder")).toBeInTheDocument();
    });

    // Right pane displays empty state placeholder
    expect(screen.getByText("Your Direct Messages")).toBeInTheDocument();
    expect(
      screen.getByText(/Select a conversation from the left pane/i)
    ).toBeInTheDocument();
  });

  it("opens the selected chat when a conversation item is clicked", async () => {
    render(<ChatPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Wonderland")).toBeInTheDocument();
    });

    // Click on Alice's conversation
    fireEvent.click(screen.getByText("Alice Wonderland"));

    // Active chat opens for Alice
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
    });
    expect(api.getConversationMessages).toHaveBeenCalledWith("conv-1");
  });

  it("allows returning to conversations list via back button", async () => {
    render(<ChatPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Wonderland")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Alice Wonderland"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Back to conversations" })).toBeInTheDocument();
    });

    // Click back button
    fireEvent.click(screen.getByRole("button", { name: "Back to conversations" }));

    // Back to placeholder state
    await waitFor(() => {
      expect(screen.getByText("Your Direct Messages")).toBeInTheDocument();
    });
  });
});
