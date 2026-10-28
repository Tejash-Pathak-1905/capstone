import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { MessageNotificationToast } from "./MessageNotificationToast";

describe("MessageNotificationToast Component", () => {
  const sampleNotification = {
    id: "notif-1",
    conversationId: "conv-123",
    senderName: "Sarah Connor",
    content: "Are you ready for the deployment?",
  };

  it("renders notification popup with sender name, message snippet, and indicator", () => {
    render(
      <MessageNotificationToast
        notification={sampleNotification}
        onDismiss={vi.fn()}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText(/new message/i)).toBeInTheDocument();
    expect(screen.getByText("Sarah Connor")).toBeInTheDocument();
    expect(screen.getByText("Are you ready for the deployment?")).toBeInTheDocument();
  });

  it("calls onClick callback when toast is clicked", () => {
    const handleClick = vi.fn();
    render(
      <MessageNotificationToast
        notification={sampleNotification}
        onDismiss={vi.fn()}
        onClick={handleClick}
      />
    );

    fireEvent.click(screen.getByText("Sarah Connor"));
    expect(handleClick).toHaveBeenCalledWith("conv-123", "Sarah Connor");
  });

  it("calls onDismiss when close button is clicked", () => {
    const handleDismiss = vi.fn();
    render(
      <MessageNotificationToast
        notification={sampleNotification}
        onDismiss={handleDismiss}
        onClick={vi.fn()}
      />
    );

    const closeBtn = screen.getByRole("button", { name: "Dismiss notification" });
    fireEvent.click(closeBtn);
    expect(handleDismiss).toHaveBeenCalled();
  });
});
