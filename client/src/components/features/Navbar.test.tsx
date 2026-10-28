import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { Navbar } from "./Navbar";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", name: "Current User", username: "current" },
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));

describe("Navbar Component", () => {
  it("does not render blue unread circle when hasUnreadMessages is false", () => {
    const { container } = render(
      <Navbar currentTab="discover" onTabChange={vi.fn()} hasUnreadMessages={false} />
    );

    const blueDots = container.querySelectorAll(".bg-blue-500");
    expect(blueDots.length).toBe(0);
  });

  it("renders small blue circle on top corner of message icon when hasUnreadMessages is true", () => {
    const { container } = render(
      <Navbar currentTab="discover" onTabChange={vi.fn()} hasUnreadMessages={true} />
    );

    const blueDots = container.querySelectorAll(".bg-blue-500");
    // One for desktop navbar and one for mobile bottom navigation bar
    expect(blueDots.length).toBeGreaterThanOrEqual(1);
  });
});
