import { render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/lib/auth";

const authMock = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: { auth: authMock },
}));

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <div>configured:{String(auth.isConfigured)}</div>
      <div>user:{auth.user?.email || "none"}</div>
      <button onClick={() => void auth.signIn("bad@example.com", "wrong").catch(() => undefined)}>Login</button>
    </div>
  );
}

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("AuthProvider production mode", () => {
  it("does not create a demo user when Supabase env vars are present", async () => {
    authMock.getSession.mockResolvedValue({ data: { session: null } });
    authMock.getUser.mockResolvedValue({ data: { user: null } });
    authMock.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });

    render(<Probe />, { wrapper });

    await waitFor(() => expect(screen.getByText("configured:true")).toBeInTheDocument());
    expect(screen.getByText("user:none")).toBeInTheDocument();
  });

  it("failed login does not create a demo session", async () => {
    authMock.getSession.mockResolvedValue({ data: { session: null } });
    authMock.getUser.mockResolvedValue({ data: { user: null } });
    authMock.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    authMock.signInWithPassword.mockResolvedValue({ data: { session: null, user: null }, error: new Error("Invalid login") });

    render(<Probe />, { wrapper });
    screen.getByText("Login").click();

    await waitFor(() => expect(authMock.signInWithPassword).toHaveBeenCalled());
    expect(screen.getByText("user:none")).toBeInTheDocument();
  });
});
