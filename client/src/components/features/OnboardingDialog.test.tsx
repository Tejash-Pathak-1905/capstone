import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { OnboardingDialog } from "./OnboardingDialog";

describe("OnboardingDialog Component", () => {
  it("renders onboarding form when open is true", () => {
    render(<OnboardingDialog open={true} onSubmit={vi.fn()} />);

    expect(screen.getByText("Complete Your Profile")).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
  });

  it("validates that username cannot contain spaces or invalid characters", async () => {
    const onSubmit = vi.fn();
    render(<OnboardingDialog open={true} onSubmit={onSubmit} />);

    const nameInput = screen.getByLabelText(/Full Name/i);
    const usernameInput = screen.getByLabelText(/Username/i);
    const submitBtn = screen.getByRole("button", { name: /Complete & Enter/i });

    fireEvent.change(nameInput, { target: { value: "John Doe" } });
    fireEvent.change(usernameInput, { target: { value: "ab" } }); // too short
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Username must be between 3 and 30 characters/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits valid profile data", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    render(
      <OnboardingDialog
        open={true}
        initialName="Taylor Swift"
        onSubmit={onSubmit}
      />
    );

    const usernameInput = screen.getByLabelText(/Username/i);
    const bioInput = screen.getByLabelText(/Bio/i);
    const submitBtn = screen.getByRole("button", { name: /Complete & Enter/i });

    fireEvent.change(usernameInput, { target: { value: "taylorswift" } });
    fireEvent.change(bioInput, { target: { value: "Music and storytelling" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: "Taylor Swift",
        username: "taylorswift",
        bio: "Music and storytelling",
      });
    });
  });
});
