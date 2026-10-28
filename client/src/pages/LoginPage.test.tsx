import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { LoginPage } from "./LoginPage";

describe("LoginPage Component", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/login");
  });

  it("renders the separate login page with Google sign-in action", () => {
    render(<LoginPage />);

    expect(screen.getByText("Nexus Social")).toBeInTheDocument();
    expect(screen.getByText("Sign In to Your Account")).toBeInTheDocument();
    expect(screen.getByText(/Continue with Google/i)).toBeInTheDocument();
    expect(screen.getByText(/Guaranteed Access Protection/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Authentication is required to enter the platform/i)
    ).toBeInTheDocument();
  });

  it("displays oauth failure notice when error param is present", () => {
    window.history.replaceState({}, "", "/login?error=oauth_failed");

    render(<LoginPage />);

    expect(screen.getByText("Sign-in Notice")).toBeInTheDocument();
    expect(
      screen.getByText(/Google authentication failed. Please try again./i)
    ).toBeInTheDocument();
  });
});
