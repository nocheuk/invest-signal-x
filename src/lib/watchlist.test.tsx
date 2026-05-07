import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { WatchlistProvider, useWatchlist } from "@/lib/watchlist";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: false,
}));

function Probe() {
  const watchlist = useWatchlist();
  return (
    <div>
      <div>Items: {watchlist.ids.join(",")}</div>
      <div>Note: {watchlist.notes["ds-004"] || ""}</div>
      <button onClick={() => void watchlist.toggle("ds-004")}>Toggle</button>
      <button onClick={() => void watchlist.setNote("ds-004", "Call agent")}>Note</button>
      <button onClick={() => void watchlist.remove("ds-004")}>Remove</button>
    </div>
  );
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <WatchlistProvider>{children}</WatchlistProvider>
    </QueryClientProvider>
  );
}

describe("WatchlistProvider", () => {
  it("adds and removes deals with optimistic state", async () => {
    render(<Probe />, { wrapper });
    screen.getByText("Toggle").click();
    await waitFor(() => expect(screen.getByText(/ds-004/)).toBeInTheDocument());
    screen.getByText("Remove").click();
    await waitFor(() => expect(screen.queryByText(/ds-004/)).not.toBeInTheDocument());
  });

  it("adds and edits notes through the mutation path", async () => {
    render(<Probe />, { wrapper });
    screen.getByText("Note").click();
    await waitFor(() => expect(screen.getByText("Note: Call agent")).toBeInTheDocument());
  });
});
