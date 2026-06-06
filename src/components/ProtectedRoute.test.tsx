import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const authState = vi.hoisted(() => ({
  value: { isConfigured: true, loading: false, user: null },
}));

const profileState = vi.hoisted(() => ({
  value: { data: { preferences: { onboarding_completed: true } }, isLoading: false, isError: false },
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => authState.value,
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => profileState.value,
}));

describe("ProtectedRoute", () => {
  it("redirects unauthenticated users to auth in Supabase mode", () => {
    authState.value = { isConfigured: true, loading: false, user: null };
    profileState.value = { data: { preferences: { onboarding_completed: true } }, isLoading: false, isError: false };

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/auth" element={<div>Auth page</div>} />
          <Route path="/dashboard" element={<ProtectedRoute><div>Dashboard</div></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Auth page")).toBeInTheDocument();
  });

  it("renders protected content for authenticated users", () => {
    authState.value = { isConfigured: true, loading: false, user: { id: "user-1" } };
    profileState.value = { data: { preferences: { onboarding_completed: true } }, isLoading: false, isError: false };

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/auth" element={<div>Auth page</div>} />
          <Route path="/dashboard" element={<ProtectedRoute><div>Dashboard</div></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("redirects authenticated users to onboarding until their brief is complete", () => {
    authState.value = { isConfigured: true, loading: false, user: { id: "user-1" } };
    profileState.value = { data: { preferences: {} }, isLoading: false, isError: false };

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/onboarding" element={<div>Onboarding page</div>} />
          <Route path="/dashboard" element={<ProtectedRoute><div>Dashboard</div></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Onboarding page")).toBeInTheDocument();
  });
});
