import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { ChatMessages, ChatMessage } from "./chat-messages";

describe("ChatMessages Component", () => {
  const sampleMessages: ChatMessage[] = [
    { id: "1", sender: "assistant", content: "Welcome to Nexus Social" },
    { id: "2", sender: "user", variant: "solid", content: "Excited to test this" },
    { id: "3", sender: "user", variant: "outline", content: "Outline pill option" },
  ];

  it("renders messages with peer and user styling", () => {
    render(
      <ChatMessages
        messages={sampleMessages}
        autoPlay={false}
        interactive={true}
        peerName="Nexus AI"
      />
    );

    expect(screen.getByText("Welcome to Nexus Social")).toBeInTheDocument();
    expect(screen.getByText("Excited to test this")).toBeInTheDocument();
    expect(screen.getByText("Outline pill option")).toBeInTheDocument();
    expect(screen.getByText("Nexus AI")).toBeInTheDocument();
  });

  it("fires onSendMessage callback when user types and submits", () => {
    const handleSend = vi.fn();
    render(
      <ChatMessages
        messages={sampleMessages}
        autoPlay={false}
        interactive={true}
        onSendMessage={handleSend}
      />
    );

    const input = screen.getByPlaceholderText("Type a message...");
    const sendButton = screen.getByRole("button", { name: "Send message" });

    fireEvent.change(input, { target: { value: "Hello from test" } });
    fireEvent.click(sendButton);

    expect(handleSend).toHaveBeenCalledWith("Hello from test");
  });

  it("disables send button when input is empty", () => {
    const handleSend = vi.fn();
    render(
      <ChatMessages
        messages={sampleMessages}
        autoPlay={false}
        interactive={true}
        onSendMessage={handleSend}
      />
    );

    const sendButton = screen.getByRole("button", { name: "Send message" });
    expect(sendButton).toBeDisabled();
  });
});
