import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppLayout } from "@/components/AppLayout";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isConfigured: true,
    user: { id: "real-user-id", email: "real@example.com", user_metadata: { full_name: "Real User" }, app_metadata: {} },
    signOut: vi.fn(),
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ data: { full_name: "Real User", company: null } }),
}));

vi.mock("@/lib/watchlist", () => ({
  useWatchlist: () => ({ ids: [] }),
}));

describe("AppLayout", () => {
  it("shows the authenticated Supabase user identity", () => {
    render(
      <MemoryRouter>
        <AppLayout><div>body</div></AppLayout>
      </MemoryRouter>
    );

    expect(screen.getByText("Real User")).toBeInTheDocument();
    expect(screen.getByText("real@example.com")).toBeInTheDocument();
    expect(screen.queryByText("JS")).not.toBeInTheDocument();
    expect(screen.queryByText("Investor plan")).not.toBeInTheDocument();
    expect(screen.queryByText(/AI summaries/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /pricing/i })).not.toBeInTheDocument();
    expect(screen.getByText("Live sources ready")).toBeInTheDocument();
  });
});
