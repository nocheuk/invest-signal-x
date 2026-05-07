import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const authState = vi.hoisted(() => ({
  value: { isConfigured: true, loading: false, user: null },
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => authState.value,
}));

describe("ProtectedRoute", () => {
  it("redirects unauthenticated users to auth in Supabase mode", () => {
    authState.value = { isConfigured: true, loading: false, user: null };

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
});
