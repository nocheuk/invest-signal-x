import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "@/components/ThemeToggle";

function renderToggle() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="dark" storageKey="dealsignal-theme" enableSystem>
      <ThemeToggle />
    </ThemeProvider>
  );
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("defaults to dark and persists light/system preferences", async () => {
    renderToggle();

    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true));
    expect(screen.getByRole("button", { name: "Use dark theme" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Use light theme" }));
    await waitFor(() => expect(document.documentElement.classList.contains("light")).toBe(true));
    expect(localStorage.getItem("dealsignal-theme")).toBe("light");
    expect(screen.getByRole("button", { name: "Use light theme" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Use system theme" }));
    await waitFor(() => expect(localStorage.getItem("dealsignal-theme")).toBe("system"));
    expect(screen.getByRole("button", { name: "Use system theme" })).toHaveAttribute("aria-pressed", "true");
  });
});
