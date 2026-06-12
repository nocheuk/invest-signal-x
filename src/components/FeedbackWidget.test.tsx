import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackWidget } from "@/components/FeedbackWidget";

const submitFeedback = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  user: { id: "user-1", email: "user@example.com" } as Record<string, unknown> | null,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: authState.user }),
}));

vi.mock("@/lib/usageTracking", async () => {
  const actual = await vi.importActual<typeof import("@/lib/usageTracking")>("@/lib/usageTracking");
  return {
    ...actual,
    useUsageTracking: () => ({
      submitFeedback,
      trackEvent: vi.fn(),
    }),
  };
});

describe("FeedbackWidget", () => {
  beforeEach(() => {
    cleanup();
    submitFeedback.mockReset();
    authState.user = { id: "user-1", email: "user@example.com" };
  });

  it("submits feedback with current page context", async () => {
    submitFeedback.mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={["/deal/deal-123"]}>
        <FeedbackWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    fireEvent.change(screen.getByPlaceholderText("What should we know?"), { target: { value: "The rent looks wrong." } });
    fireEvent.change(screen.getByPlaceholderText("https://..."), { target: { value: "https://source.example/listing" } });
    fireEvent.click(screen.getByRole("button", { name: /send feedback/i }));

    await waitFor(() => expect(submitFeedback).toHaveBeenCalledWith(expect.objectContaining({
      type: "general_feedback",
      message: "The rent looks wrong.",
      dealId: "deal-123",
      sourceUrl: "https://source.example/listing",
    })));
    expect(await screen.findByText("Thanks, feedback sent.")).toBeInTheDocument();
  });

  it("shows feedback errors without closing the dialog", async () => {
    submitFeedback.mockRejectedValue(new Error("RLS denied"));
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <FeedbackWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    fireEvent.change(screen.getByPlaceholderText("What should we know?"), { target: { value: "Something broke." } });
    fireEvent.click(screen.getByRole("button", { name: /send feedback/i }));

    expect(await screen.findByText("RLS denied")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send feedback/i })).toBeInTheDocument();
  });

  it("is hidden for signed-out users", () => {
    authState.user = null;
    render(
      <MemoryRouter>
        <FeedbackWidget />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: /feedback/i })).not.toBeInTheDocument();
  });
});
